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
