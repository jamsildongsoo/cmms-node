/**
 * BE 상태 상수의 FE 미러.
 *
 * 업무 코드와 상태 전환 규칙의 단일 원천은
 * backend/src/common/constants/status.constants.ts 이다.
 * 이 파일은 FE 표시와 타입 추론의 개발 편의를 위해 필요한 값만 복제한다.
 */
export const DOC_STATUS = {
  TEMP: 'T',
  IN_PROGRESS: 'P',
  CONFIRMED: 'C',
  SELF_CONFIRMED: 'S',
  REJECTED: 'R',
  CANCELED: 'X',
  EXPIRED: 'E',
} as const;

export type DocStatus = (typeof DOC_STATUS)[keyof typeof DOC_STATUS];

export const STATUS_LABELS: Record<string, string> = {
  T: '임시저장',
  S: '직접확정(완료)',
  P: '결재진행',
  C: '결재확정(완료)',
  R: '반려',
  X: '취소',
};

export const getCommonStatusLabel = (s: string): string => {
  return STATUS_LABELS[s] || s;
};

// 구매 진행상태 (proc_status) — 구매요청 전용
export const PROC_STATUS_LABELS: Record<string, string> = {
  O: '발주',
  D: '배송중',
  P: '부분입고',
  I: '입고완료',
  E: '종료',
};

export const getProcStatusLabel = (p?: string | null): string => {
  return p ? PROC_STATUS_LABELS[p] || p : '발주대기';
};

/** BE PmJudge/PmJudgeLabel의 FE 표시용 복제본. 업무 기준은 BE 상수이다. */
export const PM_JUDGE_LABELS: Record<string, string> = {
  OK: '양호 (OK)',
  NG: '불량 (NG)',
  OTHER: '기타',
};

export const getJudgeLabel = (judge: string): string => PM_JUDGE_LABELS[judge] || judge;

/** BE TxType/MoveTxType 라벨의 FE 표시용 복제본. */
export const TX_TYPE_LABELS: Record<string, string> = {
  IN: '입고',
  OUT: '출고',
  MOVE: '이동',
  MOVE_IN: '이동입고',
  MOVE_OUT: '이동출고',
  ADJ: '조정',
};

export const getTxTypeLabel = (type: string): string => TX_TYPE_LABELS[type] || type;
