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
  REJECTED: 'R',
  CANCELED: 'X',
  EXPIRED: 'E',
} as const;

export type DocStatus = (typeof DOC_STATUS)[keyof typeof DOC_STATUS];

export const STATUS_LABELS: Record<string, string> = {
  T: '임시저장',
  P: '결재진행',
  C: '결재확정(완료)',
  S: '자체확정',
  R: '반려',
  X: '취소',
};

export const getCommonStatusLabel = (s: string): string => {
  return STATUS_LABELS[s] || s;
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

/** BE TxReason/업무규칙의 FE 표시용 복제본. 정책 상수이며 code_group 대상이 아니다. */
export const TX_REASON = {
  GENERAL: 'GENERAL',
  PURCHASE: 'PURCHASE',
  RETURN: 'RETURN',
  WORK_ORDER: 'WORK_ORDER',
  DISPOSAL: 'DISPOSAL',
  TRANSFER: 'TRANSFER',
  STOCKTAKING: 'STOCKTAKING',
  CANCEL: 'CANCEL',
} as const;

export type TxReason = (typeof TX_REASON)[keyof typeof TX_REASON];

export const TX_REASON_LABELS: Record<TxReason, string> = {
  [TX_REASON.GENERAL]: '일반',
  [TX_REASON.PURCHASE]: '구매오더',
  [TX_REASON.RETURN]: '반품/회수',
  [TX_REASON.WORK_ORDER]: '작업지시',
  [TX_REASON.DISPOSAL]: '폐기',
  [TX_REASON.TRANSFER]: '창고이동',
  [TX_REASON.STOCKTAKING]: '재고실사',
  [TX_REASON.CANCEL]: '취소',
};

export const TX_REASON_OPTIONS: ReadonlyArray<{ id: TxReason; name: string }> = [
  { id: TX_REASON.GENERAL, name: TX_REASON_LABELS[TX_REASON.GENERAL] },
  { id: TX_REASON.PURCHASE, name: TX_REASON_LABELS[TX_REASON.PURCHASE] },
  { id: TX_REASON.RETURN, name: TX_REASON_LABELS[TX_REASON.RETURN] },
  { id: TX_REASON.WORK_ORDER, name: TX_REASON_LABELS[TX_REASON.WORK_ORDER] },
  { id: TX_REASON.DISPOSAL, name: TX_REASON_LABELS[TX_REASON.DISPOSAL] },
  { id: TX_REASON.TRANSFER, name: TX_REASON_LABELS[TX_REASON.TRANSFER] },
  { id: TX_REASON.STOCKTAKING, name: TX_REASON_LABELS[TX_REASON.STOCKTAKING] },
  { id: TX_REASON.CANCEL, name: TX_REASON_LABELS[TX_REASON.CANCEL] },
] as const;

export const TX_REASON_BY_TYPE: Record<string, readonly TxReason[]> = {
  IN: [TX_REASON.GENERAL, TX_REASON.PURCHASE, TX_REASON.RETURN, TX_REASON.CANCEL],
  OUT: [TX_REASON.GENERAL, TX_REASON.WORK_ORDER, TX_REASON.DISPOSAL, TX_REASON.CANCEL],
  MOVE: [TX_REASON.TRANSFER, TX_REASON.CANCEL],
  ADJ: [TX_REASON.STOCKTAKING, TX_REASON.CANCEL],
};

export const getTxReasonLabel = (reason?: string | null): string =>
  (reason && reason in TX_REASON_LABELS
    ? TX_REASON_LABELS[reason as TxReason]
    : reason) || '-';
