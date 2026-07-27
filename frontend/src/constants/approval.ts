/**
 * BE 결재 상수의 FE 미러.
 *
 * 업무 코드와 유효성 규칙의 단일 원천은 아래 BE 파일이다.
 * - backend/src/common/constants/approval.constants.ts
 *
 * FE에서 문자열 리터럴을 반복하지 않고 타입을 안전하게 추론하기 위한
 * 개발 편의용 복제본이며, 값을 변경할 때는 반드시 BE 정의를 기준으로 맞춘다.
 */
export const APPROVAL_STEP_TYPE = {
  DRAFT: 'D',
  APPROVAL: 'A',
  AGREEMENT: 'G',
  REFERENCE: 'R',
} as const;

export type ApprovalStepType =
  (typeof APPROVAL_STEP_TYPE)[keyof typeof APPROVAL_STEP_TYPE];

export const ACTIONABLE_APPROVAL_STEP_TYPES = [
  APPROVAL_STEP_TYPE.APPROVAL,
  APPROVAL_STEP_TYPE.AGREEMENT,
] as const;

export const APPROVAL_RESULT = {
  APPROVED: 'Y',
  REJECTED: 'N',
} as const;

export type ApprovalResult =
  (typeof APPROVAL_RESULT)[keyof typeof APPROVAL_RESULT];

export const APPROVAL_ACTION = {
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
} as const;

export type ApprovalAction =
  (typeof APPROVAL_ACTION)[keyof typeof APPROVAL_ACTION];

export const APPROVAL_STEP_TYPE_LABELS: Record<ApprovalStepType, string> = {
  [APPROVAL_STEP_TYPE.DRAFT]: '기안',
  [APPROVAL_STEP_TYPE.APPROVAL]: '결재',
  [APPROVAL_STEP_TYPE.AGREEMENT]: '합의',
  [APPROVAL_STEP_TYPE.REFERENCE]: '참조',
};

export const getApprovalStepTypeLabel = (type: ApprovalStepType): string =>
  APPROVAL_STEP_TYPE_LABELS[type];

