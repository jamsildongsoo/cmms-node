import { useState } from 'react';
import { Clock, RefreshCw } from 'lucide-react';

interface SessionExpiryNoticeProps {
  remainingSeconds: number;
  onExtend: () => Promise<void>;
  onLogout: () => void;
}

export default function SessionExpiryNotice({
  remainingSeconds,
  onExtend,
  onLogout,
}: SessionExpiryNoticeProps) {
  const [isExtending, setIsExtending] = useState(false);
  const minutes = Math.max(1, Math.ceil(remainingSeconds / 60));

  const handleExtend = async () => {
    setIsExtending(true);
    try {
      await onExtend();
    } finally {
      setIsExtending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-expiry-title"
        className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-slate-800 p-5">
          <Clock size={18} className="text-amber-400" />
          <h2 id="session-expiry-title" className="text-base font-bold text-slate-100">
            세션 만료 안내
          </h2>
        </div>
        <div className="p-5 text-sm leading-relaxed text-slate-300">
          세션이 약 {minutes}분 후 만료됩니다. 계속 사용하려면 세션을 연장해 주세요.
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-800 p-5">
          <button
            type="button"
            onClick={onLogout}
            className="cursor-pointer rounded-lg border-0 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
          >
            로그아웃
          </button>
          <button
            type="button"
            disabled={isExtending}
            onClick={() => void handleExtend()}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            <RefreshCw size={14} className={isExtending ? 'animate-spin' : ''} />
            {isExtending ? '연장 중...' : '30분 연장'}
          </button>
        </div>
      </div>
    </div>
  );
}
