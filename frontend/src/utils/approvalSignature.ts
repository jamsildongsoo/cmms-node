import axiosInstance from '../api/axios';
import type { ApprovalSignatureStep } from '../components/ApprovalSignatureBox';

interface ApprovalUser {
  id: string;
  name: string;
  title?: string | null;
  position?: string | null;
}

interface ApprovalStepResponse {
  stepNo: number;
  approverId: string;
  approvalType: string;
  approvalResult: string | null;
  comments?: string | null;
  actionAt?: string | null;
}

export async function loadApprovalSignatureSteps(
  approvalId: string | null | undefined,
  users: ApprovalUser[],
): Promise<ApprovalSignatureStep[]> {
  if (!approvalId) return [];

  try {
    const response = await axiosInstance.get(`/approval/${approvalId}/details`);
    return (response.data.steps || []).map((step: ApprovalStepResponse) => {
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
