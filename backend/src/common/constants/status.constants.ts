/* =========================================================================
   상태 코드 — 단일 소스
   ========================================================================= */

/**
 * 문서 상태 (`status` 컬럼) — approval / work-order / pm / work-permit / purchase-request 공통
 * - APR(결재)은 S 미사용
 * - PUR(구매요청)도 결재연계하며 T·P·C·S·R을 사용
 * - 업무문서(WO·PM·WP)는 전 값 사용
 */
export enum DocStatus {
  TEMP = 'T', // 임시저장
  IN_PROGRESS = 'P', // 결재중(상신됨)
  CONFIRMED = 'C', // 완결확정
  SELF_CONFIRMED = 'S', // 직접확정(권한자, 결재 우회)
  REJECTED = 'R', // 반려
  CANCELED = 'X', // 취소
  EXPIRED = 'E', // 기간 만료 (예방점검 계획 전용)
}

export const DocStatusLabel: Record<DocStatus, string> = {
  [DocStatus.TEMP]: '임시저장',
  [DocStatus.IN_PROGRESS]: '결재중',
  [DocStatus.CONFIRMED]: '완결확정',
  [DocStatus.SELF_CONFIRMED]: '직접확정',
  [DocStatus.REJECTED]: '반려',
  [DocStatus.CANCELED]: '취소',
  [DocStatus.EXPIRED]: '만료',
};

/**
 * 구매 진행상태 (`proc_status` 컬럼) — purchase-request 전용
 * NULL = 미시작
 */
export enum ProcStatus {
  ORDERED = 'O', // 발주
  SHIPPING = 'D', // 배송중 (Delivery)
  PARTIAL_RECEIVED = 'P', // 부분입고
  RECEIVED = 'I', // 입고완료
  CLOSED = 'E', // 종료 (End)
}

export const ProcStatusLabel: Record<ProcStatus, string> = {
  [ProcStatus.ORDERED]: '발주',
  [ProcStatus.SHIPPING]: '배송중',
  [ProcStatus.PARTIAL_RECEIVED]: '부분입고',
  [ProcStatus.RECEIVED]: '입고완료',
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

/** 재고 거래사유 (`tx_reason_code`) — 증감 방향과 업무 발생 원인을 분리한다. */
export enum TxReason {
  GENERAL = 'GENERAL',
  PURCHASE = 'PURCHASE',
  RETURN = 'RETURN',
  WORK_ORDER = 'WORK_ORDER',
  DISPOSAL = 'DISPOSAL',
  TRANSFER = 'TRANSFER',
  PLANT_TRANSFER = 'PLANT_TRANSFER',
  STOCKTAKING = 'STOCKTAKING',
}

export const TxReasonLabel: Record<TxReason, string> = {
  [TxReason.GENERAL]: '일반',
  [TxReason.PURCHASE]: '구매입고',
  [TxReason.RETURN]: '반품',
  [TxReason.WORK_ORDER]: '작업지시',
  [TxReason.DISPOSAL]: '폐기',
  [TxReason.TRANSFER]: '창고이동',
  [TxReason.PLANT_TRANSFER]: '사업장 이동',
  [TxReason.STOCKTAKING]: '재고실사',
};

/** 예방점검 판정 (`judge_code`) */
export enum PmJudge {
  OK = 'OK',
  NG = 'NG',
  OTHER = 'OTHER',
}

export const PmJudgeLabel: Record<PmJudge, string> = {
  [PmJudge.OK]: '양호 (OK)',
  [PmJudge.NG]: '불량 (NG)',
  [PmJudge.OTHER]: '기타',
};

/** 이동 거래는 이력(tx_type_code)에 출고·입고 두 다리로 분리 기록된다 */
export enum MoveTxType {
  MOVE_OUT = 'MOVE_OUT',
  MOVE_IN = 'MOVE_IN',
}
