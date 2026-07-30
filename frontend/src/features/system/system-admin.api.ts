import axiosInstance from '../../api/axios';
import type { YesNo } from '../mdm/mdm.types';

export interface Company {
  id: string;
  name: string;
  businessNumber?: string | null;
  email?: string | null;
}

export interface CreateCompanyRequest {
  id: string;
  name: string;
  businessNumber: string | null;
  email: string | null;
  adminId: string;
  adminName: string;
  adminPassword: string;
}

export interface SystemUser {
  companyId: string;
  id: string;
  name: string;
  roleId: string | null;
  departmentId: string | null;
  position: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  useYn: YesNo;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
}

export interface LoginHistory {
  companyId: string;
  userId: string;
  loginAt: string | null;
  loginIp: string | null;
  loginResult: string;
}

export interface LoginHistoryFilter {
  companyId?: string;
  userId?: string;
}

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
