import { useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  APPROVAL_STEP_TYPE,
  getApprovalStepTypeLabel,
  type ApprovalStepType,
} from '../../../constants/approval';
import { APP_MODULE, type LinkableModule } from '../../../constants/module';
import { DOC_STATUS } from '../../../constants/status';
import { approvalApi } from '../approval.api';
import type {
  ApprovalLine,
  ApprovalStep,
  ApprovalUser,
} from '../approval.types';
import { toastApiError } from '../../../utils/apiError';
import { requestConfirmation } from '../../../utils/userActionDialog';
import { formatDateTimeSeconds } from '../../../utils/datetime';
import {
  createEmptyRichTextDocument,
  isRichTextDocument,
  isRichTextEmpty,
  type RichTextDocument,
} from '../../../types/richText';
import FileUpload from '../../files/components/FileUpload';
import RichTextEditor from '../../../components/RichTextEditor';

interface ApprovalDraftModalProps {
  open: boolean;
  mode: 'standalone' | 'linked';
  users: ApprovalUser[];
  currentUserId?: string;
  approvalId?: string | null;
  refModule?: LinkableModule | null;
  refNo?: string | null;
  defaultTitle?: string;
  defaultContent?: RichTextDocument;
  onClose: () => void;
  onSaved?: (approvalId: string) => void;
  onSubmitted?: (approvalId: string) => void;
}

type SelectableStepType = Exclude<ApprovalStepType, 'D'>;
type CachedApprovalLine = Partial<ApprovalLine> & {
  approverId?: string;
  type?: SelectableStepType;
};

export default function ApprovalDraftModal({
  open,
  mode,
  users,
  currentUserId,
  approvalId,
  refModule = null,
  refNo = null,
  defaultTitle = '',
  defaultContent,
  onClose,
  onSaved,
  onSubmitted,
}: ApprovalDraftModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState<RichTextDocument>(createEmptyRichTextDocument);
  const [lines, setLines] = useState<ApprovalLine[]>([]);
  const [lineUserId, setLineUserId] = useState('');
  const [lineType, setLineType] = useState<SelectableStepType>(
    APPROVAL_STEP_TYPE.APPROVAL,
  );
  const [fileGroupId, setFileGroupId] = useState<number | null>(null);
  const [fileUploading, setFileUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const initialize = async () => {
      setTitle(defaultTitle);
      setContent(defaultContent ?? createEmptyRichTextDocument());
      setLines([]);
      setLineUserId('');
      setLineType(APPROVAL_STEP_TYPE.APPROVAL);
      setFileGroupId(null);

      if (approvalId) {
        setIsLoading(true);
        try {
          const detail = await approvalApi.getDetail(approvalId);
          if (!active) return;
          setTitle(detail.approval.title || '');
          setContent(
            isRichTextDocument(detail.approval.content)
              ? detail.approval.content
              : createEmptyRichTextDocument(),
          );
          setFileGroupId(detail.approval.fileGroupId ?? null);
          setLines(
            detail.steps
              .filter((step: ApprovalStep) => step.stepNo > 0)
              .map((step: ApprovalStep) => ({
                approverId: step.approverId,
                approvalType: step.approvalType as SelectableStepType,
              })),
          );
        } catch (error) {
          toastApiError(error, '결재 문서 정보를 불러오지 못했습니다.');
          onCloseRef.current();
        } finally {
          if (active) setIsLoading(false);
        }
        return;
      }

      if (mode === 'standalone') {
        const saved = localStorage.getItem('approval-draft-new');
        if (saved) {
          try {
            const draft = JSON.parse(saved);
            const autoTime = draft.autoSavedAt
              ? formatDateTimeSeconds(draft.autoSavedAt)
              : '';
            if (
              (draft.title || draft.content) &&
              (await requestConfirmation(
                `자동 저장된 초안이 있습니다.${autoTime ? ` (${autoTime})` : ''}\n복원하시겠습니까?`,
                '복원',
              ))
            ) {
              if (!active) return;
              setTitle(draft.title || '');
              setContent(
                isRichTextDocument(draft.content)
                  ? draft.content
                  : createEmptyRichTextDocument(),
              );
              setLines(
                (Array.isArray(draft.steps) ? draft.steps : [])
                  .map((line: CachedApprovalLine) => ({
                    approverId: line.approverId || '',
                    // 기존 자동저장본의 `type` 필드는 `approvalType`으로 이관한다.
                    approvalType:
                      line.approvalType
                      ?? line.type
                      ?? APPROVAL_STEP_TYPE.APPROVAL,
                  }))
                  .filter((line: ApprovalLine) => line.approverId),
              );
              setFileGroupId(draft.fileGroupId ?? null);
            } else {
              localStorage.removeItem('approval-draft-new');
            }
          } catch {
            localStorage.removeItem('approval-draft-new');
          }
        }
      }
    };
    void initialize();
    return () => {
      active = false;
    };
  }, [open, approvalId, mode, defaultTitle, defaultContent]);

  useEffect(() => {
    if (!open || mode !== 'standalone') return;
    const key = `approval-draft-${approvalId || 'new'}`;
    const timer = setTimeout(() => {
      if (title || !isRichTextEmpty(content)) {
        localStorage.setItem(
          key,
          JSON.stringify({
            title,
            content,
            steps: lines,
            fileGroupId,
            autoSavedAt: new Date().toISOString(),
          }),
        );
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [open, mode, approvalId, title, content, lines, fileGroupId]);

  if (!open) return null;

  const addLine = () => {
    if (!lineUserId || lines.some((line) => line.approverId === lineUserId)) return;
    setLines((current) => [
      ...current,
      { approverId: lineUserId, approvalType: lineType },
    ]);
    setLineUserId('');
  };

  const submit = async (temporary: boolean) => {
    if (!title.trim()) {
      toast.error('결재 제목을 입력하세요.');
      return;
    }
    if (
      !temporary
      && !lines.some(
        (line) => line.approvalType === APPROVAL_STEP_TYPE.APPROVAL,
      )
    ) {
      toast.error('최소 한 명 이상의 결재선(A)을 지정해야 합니다.');
      return;
    }
    if (fileUploading) {
      toast.error('첨부파일 업로드가 끝난 뒤 처리해 주세요.');
      return;
    }
    setIsLoading(true);
    try {
      const request = {
        approval: {
          title: title.trim(),
          content,
          fileGroupId,
          ...(temporary ? { status: DOC_STATUS.TEMP } : {}),
        },
        steps: lines,
        refNo: refNo || null,
        refModule: refModule || null,
      };
      const saved = approvalId
        ? await approvalApi.update(approvalId, request)
        : await approvalApi.create(request);
      const savedId = saved.id;
      localStorage.removeItem(`approval-draft-${approvalId || 'new'}`);
      if (temporary) {
        toast.success('임시저장되었습니다.');
        onSaved?.(savedId);
      } else {
        toast.success(approvalId ? '결재 문서가 수정·상신되었습니다.' : '결재 문서가 상신되었습니다.');
        onSubmitted?.(savedId);
      }
    } catch (error) {
      toastApiError(error, temporary ? '임시저장에 실패했습니다.' : '상신에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-200">
              {approvalId ? '결재 기안서 수정' : mode === 'linked' ? '연계 결재 기안 상신' : '일반 결재 기안서 상신'}
            </h2>
            {mode === 'linked' && (
              <p className="text-[11px] text-slate-500 mt-1">{refModule} / {refNo}</p>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-300 border-0 cursor-pointer bg-transparent">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          <div>
            <label className="block text-slate-400 mb-1.5 font-semibold">품의 제목 *</label>
            <input value={title} onChange={(event) => setTitle(event.target.value)} className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none" />
          </div>

          <div>
            <label className="block text-slate-400 mb-2 font-semibold">결재선 구성 (기안자 제외 순차 지정)</label>
            <div className="flex gap-2 mb-3">
              <select value={lineUserId} onChange={(event) => setLineUserId(event.target.value)} className="flex-1 bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-slate-200 outline-none">
                <option value="">사용자 선택</option>
                {users.filter((item) => item.id !== currentUserId && item.useYn !== 'N').map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}({item.id}) / {item.position || '-'} / {item.title || '-'} / {item.departmentName || '-'}
                  </option>
                ))}
              </select>
              <select value={lineType} onChange={(event) => setLineType(event.target.value as SelectableStepType)} className="w-28 bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-slate-200 outline-none">
                <option value={APPROVAL_STEP_TYPE.APPROVAL}>결재</option>
                <option value={APPROVAL_STEP_TYPE.AGREEMENT}>합의</option>
                <option value={APPROVAL_STEP_TYPE.REFERENCE}>참조</option>
              </select>
              <button type="button" onClick={addLine} disabled={!lineUserId} className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg px-3 flex items-center gap-1 border-0 cursor-pointer">
                <Plus size={14} /> 추가
              </button>
            </div>
            <div className="space-y-1">
              {lines.map((line, index) => {
                const selected = users.find((item) => item.id === line.approverId);
                return (
                  <div key={line.approverId} className="flex justify-between items-center bg-slate-950 px-3 py-2 rounded border border-slate-800">
                    <span className="text-slate-200">{index + 1}. [{getApprovalStepTypeLabel(line.approvalType)}] {selected?.name || line.approverId}</span>
                    <button type="button" onClick={() => setLines((current) => current.filter((_, i) => i !== index))} className="text-slate-600 hover:text-rose-400 bg-transparent border-0 cursor-pointer">
                      <X size={14} />
                    </button>
                  </div>
                );
              })}
              {lines.length === 0 && <div className="text-center py-3 text-slate-600">결재선을 지정해주세요.</div>}
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1.5 font-semibold">상세 내용</label>
            <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
              <RichTextEditor content={content} onChange={setContent} placeholder="품의 내용을 구체적으로 작성하세요." minHeight="200px" />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1.5 font-semibold">첨부파일</label>
            <FileUpload groupNo={fileGroupId} refModule={APP_MODULE.APR} onGroupNoChange={setFileGroupId} onUploadingChange={setFileUploading} />
          </div>
        </div>

        <div className="p-6 border-t border-slate-800 flex justify-between gap-2 shrink-0">
          <button type="button" onClick={onClose} className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg py-2 px-4 border-0 cursor-pointer">취소</button>
          <div className="flex gap-2">
            {mode === 'standalone' && (
              <button type="button" onClick={() => void submit(true)} disabled={isLoading || fileUploading} className="bg-amber-600 hover:bg-amber-500 text-white rounded-lg py-2 px-4 border-0 cursor-pointer disabled:opacity-50">
                임시저장
              </button>
            )}
            <button type="button" onClick={() => void submit(false)} disabled={isLoading || fileUploading} className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 px-5 border-0 cursor-pointer disabled:opacity-50">
              {isLoading ? '처리 중…' : approvalId ? '수정 상신' : '기안 상신'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
