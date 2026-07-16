export const STATUS_LABELS: Record<string, string> = {
  T: '임시저장',
  S: '직접확정(완료)',
  P: '결재진행',
  C: '결재확정(완료)',
  R: '반려',
  X: '취소',
};

export const STATUS_CLASSES: Record<string, string> = {
  T: 'bg-slate-950 text-slate-400 border border-slate-800',
  S: 'bg-emerald-950 text-emerald-400 border border-emerald-900',
  C: 'bg-emerald-950 text-emerald-400 border border-emerald-900',
  P: 'bg-blue-950 text-blue-400 border border-blue-900',
  R: 'bg-rose-950 text-rose-400 border border-rose-900',
  X: 'bg-slate-900 text-slate-500 border border-slate-800',
};

export const getCommonStatusLabel = (s: string): string => {
  return STATUS_LABELS[s] || s;
};

export const getCommonStatusClass = (s: string): string => {
  const base = STATUS_CLASSES[s] || 'bg-slate-900 text-slate-500';
  // 인쇄(흑백): 색 제거 → 흰 배경·검정 글씨·회색 테두리
  return `${base} print:!bg-white print:!text-black print:!border print:!border-gray-400`;
};

// 결재 step 타입 (approval_type)
export const STEP_TYPE_LABELS: Record<string, string> = {
  D: '기안',
  A: '결재',
  G: '합의',
  R: '참조',
};

export const getStepTypeLabel = (t: string): string => {
  return STEP_TYPE_LABELS[t] || t;
};

// 구매 진행상태 (proc_status) — 구매요청 전용
export const PROC_STATUS_LABELS: Record<string, string> = {
  O: '발주',
  D: '배송중',
  I: '입고',
  E: '종료',
};

export const PROC_STATUS_CLASSES: Record<string, string> = {
  O: 'bg-amber-950/40 text-amber-400 border-amber-900/60',
  D: 'bg-amber-950/40 text-amber-400 border-amber-900/60',
  I: 'bg-blue-950/40 text-blue-400 border-blue-900/60',
  E: 'bg-rose-950/40 text-rose-400 border-rose-900/60',
};

export const getProcStatusLabel = (p?: string | null): string => {
  return p ? PROC_STATUS_LABELS[p] || p : '발주대기';
};

export const getProcStatusClass = (p?: string | null): string => {
  return p ? PROC_STATUS_CLASSES[p] || 'bg-slate-900 text-slate-500 border-slate-800'
           : 'bg-slate-900 text-slate-500 border-slate-800';
};

export const getJudgeLabel = (j: string): string => {
  const map: Record<string, string> = {
    OK: '양호 (OK)',
    NG: '불량 (NG)',
    OTHER: '기타',
  };
  return map[j] || j;
};
