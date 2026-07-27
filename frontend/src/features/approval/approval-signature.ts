import { approvalApi } from './approval.api';
import type {
  ApprovalStep,
  ApprovalUser,
} from './approval.types';
import type { ApprovalSignatureStep } from './components/ApprovalSignatureBox';

export async function loadApprovalSignatureSteps(
  approvalId: string | null | undefined,
  users: ApprovalUser[],
): Promise<ApprovalSignatureStep[]> {
  if (!approvalId) return [];

  try {
    const detail = await approvalApi.getDetail(approvalId);
    return detail.steps.map((step: ApprovalStep) => {
      const approver = users.find((candidate) => candidate.id === step.approverId);
      return {
        ...step,
        approverName: approver?.name || step.approverId,
        approverTitle: approver?.title || approver?.position || null,
      };
    });
  } catch (error) {
    console.warn('결재 정보를 조회하지 못해 빈 결재 박스로 출력합니다.', error);
    return [];
  }
}
