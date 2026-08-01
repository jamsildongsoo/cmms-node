import axiosInstance from '../../api/axios';
import type { YesNo } from '../mdm/mdm.types';
import type {
  Company,
  CreateCompanyRequest,
  LoginHistory,
  LoginHistoryFilter,
  SystemUser,
} from './system-admin.types';

export const systemAdminApi = {
  async getCompanies(): Promise<Company[]> {
    const response = await axiosInstance.get<Company[]>('/mdm/companies');
    return response.data;
  },
  async createCompany(request: CreateCompanyRequest): Promise<void> {
    await axiosInstance.post('/mdm/companies', request);
  },
  async getUsers(companyId?: string): Promise<SystemUser[]> {
    const response = await axiosInstance.get<SystemUser[]>('/system/users', {
      params: companyId ? { companyId } : {},
    });
    return response.data;
  },
  async getLoginHistory(filter: LoginHistoryFilter): Promise<LoginHistory[]> {
    const response = await axiosInstance.get<LoginHistory[]>('/system/login-history', {
      params: filter,
    });
    return response.data;
  },
  async updateUserUseYn(companyId: string, id: string, useYn: YesNo): Promise<void> {
    await axiosInstance.put(`/system/users/${companyId}/${id}/use-yn`, { useYn });
  },
};
