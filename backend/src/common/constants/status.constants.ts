/* =========================================================================
   상태 코드 — 단일 소스
   ========================================================================= */

/**
 * 문서 상태 (`status` 컬럼) — approval / work-order / pm / work-permit / purchase-request 공통
 * - APR(결재)은 S 미사용
 * - PUR(구매요청)은 결재 비연계라 T·S만 사용
 * - 업무문서(WO·PM·WP)는 전 값 사용
 */
export enum DocStatus {
  TEMP = 'T', // 임시저장
  IN_PROGRESS = 'P', // 결재중(상신됨)
  CONFIRMED = 'C', // 완결확정
  SELF_CONFIRMED = 'S', // 직접확정(권한자, 결재 우회)
  REJECTED = 'R', // 반려
  CANCELED = 'X', // 취소
}

export const DocStatusLabel: Record<DocStatus, string> = {
  [DocStatus.TEMP]: '임시저장',
  [DocStatus.IN_PROGRESS]: '결재중',
  [DocStatus.CONFIRMED]: '완결확정',
  [DocStatus.SELF_CONFIRMED]: '직접확정',
  [DocStatus.REJECTED]: '반려',
  [DocStatus.CANCELED]: '취소',
};

/**
 * 구매 진행상태 (`proc_status` 컬럼) — purchase-request 전용
 * NULL = 미시작
 */
export enum ProcStatus {
  ORDERED = 'O', // 발주
  SHIPPING = 'D', // 배송중 (Delivery)
  RECEIVED = 'I', // 입고 (Incoming, 1회 이상)
  CLOSED = 'E', // 종료 (End)
}

export const ProcStatusLabel: Record<ProcStatus, string> = {
  [ProcStatus.ORDERED]: '발주',
  [ProcStatus.SHIPPING]: '배송중',
  [ProcStatus.RECEIVED]: '입고',
  [ProcStatus.CLOSED]: '종료',
};

/** 재고 거래유형 (`tx_type_code`) — inventory transaction */
export enum TxType {
  IN = 'IN', // 입고
  OUT = 'OUT', // 출고
  MOVE = 'MOVE', // 이동(저장소 간)
  ADJ = 'ADJ', // 실사조정
}

export const TxTypeLabel: Record<TxType, string> = {
  [TxType.IN]: '입고',
  [TxType.OUT]: '출고',
  [TxType.MOVE]: '이동',
  [TxType.ADJ]: '실사조정',
};

/** 이동 거래는 이력(tx_type_code)에 출고·입고 두 다리로 분리 기록된다 */
export enum MoveTxType {
  MOVE_OUT = 'MOVE_OUT',
  MOVE_IN = 'MOVE_IN',
}
