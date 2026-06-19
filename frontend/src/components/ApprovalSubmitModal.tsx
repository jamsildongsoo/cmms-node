import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import axiosInstance from '../api/axios';
import { getApiErrorMessage } from '../utils/apiError';

interface ApprovalUser {
  id: string;
  name: string;
}

interface ApprovalSubmitModalProps {
  open: boolean;
  refModule: 'PM' | 'WO' | 'WP';
  refNo: string;
  defaultTitle: string;
  users: ApprovalUser[];
  currentUserId?: string;
  onClose: () => void;
  onSubmitted: (approvalId: string) => void;
}

export default function ApprovalSubmitModal({
  open,
  refModule,
  refNo,
  defaultTitle,
  users,
  currentUserId,
  onClose,
  onSubmitted,
}: ApprovalSubmitModalProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [content, setContent] = useState('');
  const [approverIds, setApproverIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(defaultTitle);
    setContent('');
    setApproverIds([]);
    setError('');
  }, [open, defaultTitle, refNo]);

  if (!open) return null;

  const toggleApprover = (userId: string) => {
    setApproverIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  };

  const submit = async () => {
    if (!title.trim()) {
      setError('결재 제목을 입력해 주세요.');
      return;
    }
    if (approverIds.length === 0) {
      setError('결재자를 한 명 이상 선택해 주세요.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      const response = await axiosInstance.post('/approval/submit', {
        approval: { title: title.trim(), content: content || null },
        steps: approverIds.map((approverId) => ({
          approverId,
          approvalType: 'A',
        })),
        refNo,
        refModule,
      });
      onSubmitted(response.data.id);
    } catch (err) {
      setError(getApiErrorMessage(err, '결재 상신 중 오류가 발생했습니다.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-200">결재 상신</h2>
            <p className="text-[11px] text-slate-500 mt-1">{refModule} / {refNo}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-300 border-0 bg-transparent cursor-pointer">
            <X size={19} />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {error && <div className="bg-rose-950/40 border border-rose-800 text-rose-300 rounded-lg p-3">{error}</div>}
          <div>
            <label className="block text-slate-400 mb-1.5">결재 제목 *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none" />
          </div>
          <div>
            <label className="block text-slate-400 mb-1.5">상신 내용</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none resize-none" />
          </div>
          <div>
            <label className="block text-slate-400 mb-1.5">결재선 *</label>
            <div className="max-h-48 overflow-y-auto border border-slate-800 rounded-lg divide-y divide-slate-850">
              {users.filter((item) => item.id !== currentUserId).map((item) => (
                <label key={item.id} className="flex items-center gap-2 px-3 py-2 bg-slate-950/50 hover:bg-slate-850 cursor-pointer">
                  <input type="checkbox" checked={approverIds.includes(item.id)} onChange={() => toggleApprover(item.id)} />
                  <span className="text-slate-300">{item.name}</span>
                  <span className="text-slate-600 font-mono">{item.id}</span>
                </label>
              ))}
              {users.filter((item) => item.id !== currentUserId).length === 0 && (
                <div className="p-4 text-center text-slate-500">선택 가능한 결재자가 없습니다.</div>
              )}
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-slate-800 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg py-2 px-4 text-xs font-semibold border-0 cursor-pointer">취소</button>
          <button type="button" onClick={submit} disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 px-4 text-xs font-semibold border-0 cursor-pointer disabled:opacity-50">
            {isSubmitting ? '상신 중...' : '상신'}
          </button>
        </div>
      </div>
    </div>
  );
}
