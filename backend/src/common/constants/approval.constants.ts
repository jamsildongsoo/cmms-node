/* =========================================================================
   결재 코드 — 단일 소스
   ========================================================================= */

/** 결재 step 타입 (`approval_type` 컬럼) */
export enum ApprovalStepType {
  DRAFT = 'D', // 기안
  APPROVAL = 'A', // 결재(대상)
  AGREEMENT = 'G', // 합의
  REFERENCE = 'R', // 참조
}

/** 실제 승인/반려 판정에 관여하는 step 타입 (A·G) */
export const ACTIONABLE_STEP_TYPES = [
  ApprovalStepType.APPROVAL,
  ApprovalStepType.AGREEMENT,
] as const;

/**
 * 결재 step 결과 (`approval_result` 컬럼)
 * NULL = 대기
 */
export enum ApprovalResult {
  APPROVED = 'Y', // 승인
  REJECTED = 'N', // 반려
}

/** 결재 처리 액션 (API 입력값) → 저장 결과(ApprovalResult)로 변환 */
export enum ApprovalAction {
  APPROVE = 'APPROVE',
  REJECT = 'REJECT',
}
