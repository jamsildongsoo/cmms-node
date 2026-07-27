import axiosInstance from '../../api/axios';
import type { ApprovalAction } from '../../constants/approval';
import type {
  ApprovalDetail,
  ApprovalDocument,
  ApprovalInbox,
  ApprovalSubmitRequest,
} from './approval.types';

export const approvalApi = {
  async getInbox(inbox: ApprovalInbox): Promise<ApprovalDocument[]> {
    const response = await axiosInstance.get<ApprovalDocument[]>(`/approval/${inbox}`);
    return response.data;
  },

  async getDetail(approvalId: string): Promise<ApprovalDetail> {
    const response = await axiosInstance.get<ApprovalDetail>(
      `/approval/${approvalId}/details`,
    );
    return response.data;
  },

  async submit(request: ApprovalSubmitRequest): Promise<ApprovalDocument> {
    const response = await axiosInstance.post<ApprovalDocument>(
      '/approval/submit',
      request,
    );
    return response.data;
  },

  async action(
    approvalId: string,
    action: ApprovalAction,
    comments?: string,
  ): Promise<void> {
    await axiosInstance.post(`/approval/${approvalId}/action`, {
      action,
      comments,
    });
  },
};
