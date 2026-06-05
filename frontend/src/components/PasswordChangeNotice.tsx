import { KeyRound, X } from 'lucide-react';

interface Props {
  expired: boolean;          // true: 사용기간 만료 / false: 초기 비밀번호 등 변경 권고
  onGoChange: () => void;    // [지금 변경] → 내 정보 수정으로 이동
  onClose: () => void;       // [나중에] / 닫기
}

/** 비밀번호 변경 안내 모달 — 차단형 안내(인지 게이트, 강제는 아님). */
export default function PasswordChangeNotice({ expired, onGoChange, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="p-5 border-b border-slate-800 flex justify-between items-center">
          <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <KeyRound size={18} className="text-amber-400" />
            비밀번호 변경 안내
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 border-0 cursor-pointer bg-transparent">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 text-sm text-slate-300 leading-relaxed">
          {expired
            ? '비밀번호 사용 기간이 만료되었습니다. 보안을 위해 새 비밀번호로 변경해 주세요.'
            : '초기 비밀번호로 로그인하셨습니다. 보안을 위해 비밀번호를 변경해 주세요.'}
          <p className="text-xs text-slate-500 mt-2">[내 정보 수정]에서 언제든 변경할 수 있습니다.</p>
        </div>

        <div className="p-5 border-t border-slate-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg py-2 px-4 text-xs font-semibold border-0 cursor-pointer"
          >
            나중에
          </button>
          <button
            onClick={onGoChange}
            className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 px-4 text-xs font-semibold border-0 cursor-pointer flex items-center gap-1.5"
          >
            <KeyRound size={14} />
            지금 변경
          </button>
        </div>
      </div>
    </div>
  );
}
