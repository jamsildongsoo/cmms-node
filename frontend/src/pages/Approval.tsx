import { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { toast } from 'sonner';
import axiosInstance from '../api/axios';
import { formatDateTime } from '../utils/datetime';
import { getApiErrorMessage } from '../utils/apiError';
import { useAuthStore } from '../store/useAuthStore';
import ApprovalDraftModal from '../features/approval/components/ApprovalDraftModal';
import ApprovalDocPrint, {
  type ApprovalDocumentStep,
} from '../features/approval/components/ApprovalDocPrint';
import PrintWindowLayout from '../components/PrintWindowLayout';
import { openPrintWindow } from '../utils/printWindow';
import {
  ACTIONABLE_APPROVAL_STEP_TYPES,
  APPROVAL_ACTION,
} from '../constants/approval';
import { DOC_STATUS, getCommonStatusLabel as getStatusLabel } from '../constants/status';
import { approvalApi } from '../features/approval/approval.api';
import type {
  ApprovalDocument,
  ApprovalInbox,
  ApprovalStep,
  ApprovalUser,
} from '../features/approval/approval.types';
import { fileApi } from '../features/files/file.api';
import type { FileItem } from '../features/files/file.types';
import { downloadBlob } from '../features/files/file.utils';
import {
  FileSignature, Check, X, Printer, Pencil, Plus, Trash2
} from 'lucide-react';
import ListBadge from '../components/ListBadge';
import ListIconButton from '../components/ListIconButton';
import { APP_MODULE } from '../constants/module';
import { requestConfirmation } from '../utils/userActionDialog';

const loadApprovalPageData = (inbox: ApprovalInbox) =>
  Promise.all([
    approvalApi.getInbox(inbox),
    axiosInstance.get<ApprovalUser[]>('/mdm/refs/users'),
  ]);

export default function Approval() {
  const user = useAuthStore((s) => s.user);
  const approvalPermission = user?.permissions?.[APP_MODULE.APR];
  const canCreate = approvalPermission?.C === 'Y';
  const canUpdate = approvalPermission?.U === 'Y';
  const canDelete = approvalPermission?.D === 'Y';
  const [activeTab, setActiveTab] = useState<ApprovalInbox>('pending');

  const [approvals, setApprovals] = useState<ApprovalDocument[]>([]);
  const [usersList, setUsersList] = useState<ApprovalUser[]>([]);
  const [searchType, setSearchType] = useState<'id' | 'title' | 'owner'>('id');
  const [searchValue, setSearchValue] = useState('');
  const filteredApprovals = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase();
    if (!keyword) return approvals;
    return approvals.filter((approval) => {
      if (searchType === 'id') return approval.id.toLowerCase().includes(keyword);
      if (searchType === 'title') return approval.title.toLowerCase().includes(keyword);
      const drafter = usersList.find((candidate) => candidate.id === approval.drafterId);
      return `${approval.drafterId} ${drafter?.name || ''}`.toLowerCase().includes(keyword);
    });
  }, [approvals, searchType, searchValue, usersList]);

  // Modal / Detail states
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalDocument | null>(null);
  const [approvalSteps, setApprovalSteps] = useState<ApprovalStep[]>([]);
  const [approvalAttachments, setApprovalAttachments] = useState<FileItem[]>([]);

  // Action input states
  const [comments, setComments] = useState('');
  const [isLoading, setIsLoading] = useState(false);


  // New Draft Creation Modal
  const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);
  const [editingApprovalId, setEditingApprovalId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [appRes, userRes] = await loadApprovalPageData(activeTab);
      setApprovals(appRes);
      setUsersList(userRes.data);
    } catch (err) {
      console.error(err);
      toast.error(getApiErrorMessage(err, '목록을 불러오지 못했습니다.'));
    }
  };

  useEffect(() => {
    let active = true;
    void loadApprovalPageData(activeTab)
      .then(([loadedApprovals, usersResponse]) => {
        if (!active) return;
        setApprovals(loadedApprovals);
        setUsersList(usersResponse.data);
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error(error);
        toast.error(getApiErrorMessage(error, '목록을 불러오지 못했습니다.'));
      });
    return () => {
      active = false;
    };
  }, [activeTab]);

  const handleOpenDetail = async (app: ApprovalDocument) => {
    setIsLoading(true);
    try {
      const detail = await approvalApi.getDetail(app.id);
      setSelectedApproval(detail.approval);
      setApprovalSteps(detail.steps);
      const fileGroupId = detail.approval.fileGroupId;
      if (fileGroupId) {
        setApprovalAttachments(await fileApi.getItems(fileGroupId));
      } else {
        setApprovalAttachments([]);
      }
      setComments('');
      setIsDetailOpen(true);
    } catch (err) {
      toast.error(getApiErrorMessage(err, '결재 문서 정보를 불러오는데 실패했습니다.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (action: Parameters<typeof approvalApi.action>[1]) => {
    if (!selectedApproval) return;
    setIsLoading(true);
    try {
      await approvalApi.action(selectedApproval.id, action, comments);
      toast.success(action === APPROVAL_ACTION.APPROVE ? '승인 처리되었습니다.' : '반려 처리되었습니다.');
      setIsDetailOpen(false);
      fetchData();
    } catch (err) {
      toast.error(getApiErrorMessage(err, '결재 처리 실패'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDraftModal = () => {
    setEditingApprovalId(null);
    setIsDraftModalOpen(true);
  };

  const handleEditDraft = (app: ApprovalDocument) => {
    setEditingApprovalId(app.id);
    setIsDraftModalOpen(true);
  };

  const handleDeleteDraft = async (app: ApprovalDocument) => {
    if (!(await requestConfirmation(`[${app.id}] 임시저장 결재문서를 삭제할까요?`))) return;
    try {
      await approvalApi.delete(app.id);
      toast.success('임시저장 결재문서를 삭제했습니다.');
      await fetchData();
    } catch (error) {
      toast.error(getApiErrorMessage(error, '결재문서 삭제에 실패했습니다.'));
    }
  };

  const currentApprovalStep = approvalSteps.find(
    (step) =>
      ACTIONABLE_APPROVAL_STEP_TYPES.some(
        (type) => type === step.approvalType,
      ) && step.approvalResult === null,
  );
  const isMyTurn =
    selectedApproval?.status === DOC_STATUS.IN_PROGRESS
    && currentApprovalStep?.approverId === user?.id;

  const getApprovalDocumentSteps = (): ApprovalDocumentStep[] => approvalSteps.map((step) => {
    const approver = usersList.find((item) => item.id === step.approverId);
    return {
      stepNo: step.stepNo,
      approverName: approver?.name || step.approverId,
      approverTitle: approver?.title || approver?.position || null,
      approvalType: step.approvalType,
      approvalResult: step.approvalResult,
      comments: step.comments,
      actionAt: step.actionAt,
    };
  });

  const handleDownloadApprovalAttachment = async (attachment: FileItem) => {
    if (!selectedApproval?.fileGroupId) return;
    try {
      const blob = await fileApi.download(
        selectedApproval.fileGroupId,
        attachment.itemNo,
      );
      downloadBlob(blob, attachment.originalFileName);
    } catch {
      toast.error('첨부파일 다운로드에 실패했습니다.');
    }
  };

  const handleOpenPrintPreview = () => {
    if (!selectedApproval) return;
    const printTarget = openPrintWindow({
      title: '결재 품의서 출력',
      rootId: 'approval-print-root',
    });
    if (!printTarget) {
      toast.error('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.');
      return;
    }
    const { printWindow, container } = printTarget;
    const drafter = usersList.find((item) => item.id === selectedApproval.drafterId);
    const root = createRoot(container);
    root.render(
      <PrintWindowLayout printWindow={printWindow}>
        <ApprovalDocPrint
          mode="print"
          id={selectedApproval.id}
          title={selectedApproval.title}
          content={selectedApproval.content}
          createdAt={selectedApproval.createdAt}
          drafterName={drafter?.name || selectedApproval.drafterId}
          drafterDepartment={drafter?.departmentName || drafter?.departmentId || '-'}
          steps={getApprovalDocumentSteps()}
          attachments={approvalAttachments}
        />
      </PrintWindowLayout>,
    );
    printWindow.focus();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <FileSignature size={24} className="text-blue-500" />
            전자결재 보관함
          </h1>
          <p className="text-slate-400 text-sm mt-1">예방점검, 작업지시, 작업허가 등 핵심 업무 문서를 상신하거나 승인/반려합니다.</p>
        </div>

        <div className="flex items-center gap-3">
          {canCreate && (
            <button
              onClick={handleOpenDraftModal}
              className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 transition-colors border-0 cursor-pointer shadow-lg shadow-blue-900/20"
            >
              <Plus size={14} />
              기안문
            </button>
          )}

          {/* Subtab control */}
          <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer border-0 outline-none ${
                activeTab === 'pending' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              결재 대기함
            </button>
            <button
              onClick={() => setActiveTab('sent')}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer border-0 outline-none ${
                activeTab === 'sent' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              기안/상신함
            </button>
            <button
              onClick={() => setActiveTab('referenced')}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer border-0 outline-none ${
                activeTab === 'referenced' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              참조문서함
            </button>
            <button
              onClick={() => setActiveTab('processed')}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer border-0 outline-none ${
                activeTab === 'processed' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              결재/반려함
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid List */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 print:border-0 print:bg-transparent print:p-0">
        <div className="mb-4 flex gap-2 print:hidden">
          <select value={searchType} onChange={(event) => setSearchType(event.target.value as typeof searchType)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 outline-none">
            <option value="id">문서번호</option>
            <option value="title">제목</option>
            <option value="owner">담당자</option>
          </select>
          <input value={searchValue} onChange={(event) => setSearchValue(event.target.value)} placeholder="검색어를 입력하세요" className="flex-1 min-w-[200px] bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 outline-none" />
        </div>
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 select-none">
                <th className="p-3 font-semibold">결재문서번호</th>
                <th className="p-3 font-semibold">결재 제목</th>
                <th className="p-3 font-semibold">기안자</th>
                <th className="p-3 font-semibold">상신일시</th>
                <th className="p-3 font-semibold">결재상태</th>
                <th className="p-3 font-semibold text-right">작업</th>
              </tr>
            </thead>
            <tbody>
              {filteredApprovals.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-600">조회된 결재 문서가 없습니다.</td></tr>
              ) : (
                filteredApprovals.map((app) => (
                  <tr key={app.id} className="border-b border-slate-900 hover:bg-slate-900/30 text-slate-300">
                    <td className="p-3 font-mono">
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(app)}
                        className="bg-transparent border-0 p-0 text-blue-400 hover:text-blue-300 hover:underline font-mono cursor-pointer"
                        title="결재문 출력 화면"
                      >
                        {app.id}
                      </button>
                    </td>
                    <td className="p-3 font-semibold text-slate-200">{app.title}</td>
                    <td className="p-3">{usersList.find(u => u.id === app.drafterId)?.name || app.drafterId}</td>
                    <td className="p-3 font-mono text-slate-400">{formatDateTime(app.createdAt)}</td>
                    <td className="p-3">
                      <ListBadge>{getStatusLabel(app.status)}</ListBadge>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {app.status === DOC_STATUS.TEMP && app.drafterId === user?.id && canUpdate && (
                          <ListIconButton
                            onClick={() => handleEditDraft(app)}
                            label={`${app.id} 수정`}
                            icon={Pencil}
                            tone="accent"
                          />
                        )}
                        {app.status === DOC_STATUS.TEMP && app.drafterId === user?.id && canDelete && (
                          <ListIconButton
                            onClick={() => void handleDeleteDraft(app)}
                            label={`${app.id} 삭제`}
                            icon={Trash2}
                            tone="danger"
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL MODAL (With signature box) */}
      {isDetailOpen && selectedApproval && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto print:absolute print:inset-0 print:bg-white print:p-0">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl print:border-0 print:shadow-none print:max-h-none print:w-full print:h-full">
            {/* Header */}
            <div className="p-6 border-b border-slate-800 flex justify-between items-center shrink-0 print:hidden">
              <h2 className="text-lg font-bold text-slate-200">전자결재 품의 상세 [품의번호: {selectedApproval.id}]</h2>
              <button onClick={() => setIsDetailOpen(false)} className="text-slate-500 hover:text-slate-300 border-0 cursor-pointer bg-transparent"><X size={20} /></button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 print:hidden">
              <ApprovalDocPrint
                mode="detail"
                id={selectedApproval.id}
                title={selectedApproval.title}
                content={selectedApproval.content}
                createdAt={selectedApproval.createdAt}
                drafterName={usersList.find((item) => item.id === selectedApproval.drafterId)?.name || selectedApproval.drafterId}
                drafterDepartment={
                  usersList.find((item) => item.id === selectedApproval.drafterId)?.departmentName
                  || usersList.find((item) => item.id === selectedApproval.drafterId)?.departmentId
                  || '-'
                }
                steps={getApprovalDocumentSteps()}
                attachments={approvalAttachments}
                onDownloadAttachment={handleDownloadApprovalAttachment}
              />

              {/* Approval Active Action Area */}
              {isMyTurn && (
                <div className="bg-slate-950 border border-blue-900/30 p-5 rounded-2xl space-y-4 print:hidden shadow-lg shadow-blue-950/20">
                  <h4 className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                    <FileSignature size={15} />
                    결재 의사 결정 승인/반려 작성란 (나의 차례)
                  </h4>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1.5">결재 의견 입력 (의무사항 아님)</label>
                    <textarea
                      rows={2}
                      placeholder="의견이 필요한 경우 기재하세요."
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-xs text-slate-200 outline-none resize-none"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => handleAction(APPROVAL_ACTION.REJECT)}
                      disabled={isLoading}
                      className="bg-rose-950 hover:bg-rose-900 text-rose-400 border border-rose-900 rounded-lg px-4 py-2 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                    >
                      <X size={14} />
                      <span>반려 처리</span>
                    </button>
                    <button
                      onClick={() => handleAction(APPROVAL_ACTION.APPROVE)}
                      disabled={isLoading}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-5 py-2 text-xs font-bold transition-all cursor-pointer border-0 disabled:opacity-50 flex items-center gap-1 shadow-md shadow-emerald-900/20"
                    >
                      <Check size={14} />
                      <span>승인 서명</span>
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-800 flex justify-end gap-2 shrink-0 print:hidden">
              {selectedApproval.status !== DOC_STATUS.TEMP && selectedApproval.status !== DOC_STATUS.IN_PROGRESS && (
                <button
                  type="button"
                  onClick={handleOpenPrintPreview}
                  className="bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-750 px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer size={14} />
                  출력 보기
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsDetailOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg py-2 px-5 text-xs font-semibold cursor-pointer border-0"
              >
                닫기
              </button>
            </div>

          </div>
        </div>
      )}

      <ApprovalDraftModal
        open={isDraftModalOpen}
        mode="standalone"
        approvalId={editingApprovalId}
        users={usersList}
        currentUserId={user?.id}
        onClose={() => setIsDraftModalOpen(false)}
        onSaved={() => {
          setIsDraftModalOpen(false);
          if (activeTab === 'sent') fetchData();
          else setActiveTab('sent');
        }}
        onSubmitted={() => {
          setIsDraftModalOpen(false);
          fetchData();
        }}
      />

    </div>
  );
}
