export type YesNo = 'Y' | 'N';
export type PermissionAction = 'C' | 'R' | 'U' | 'D' | 'A';

export interface Plant {
  id: string;
  name: string;
}

export interface Department {
  id: string;
  name: string;
  parentId: string | null;
}

export interface Role {
  id: string;
  roleName: string;
  multiPlant: YesNo;
}

export interface RoleDetail {
  companyId: string;
  roleId: string;
  moduleDetail: string;
  permC: YesNo;
  permR: YesNo;
  permU: YesNo;
  permD: YesNo;
  permA: YesNo;
}

export interface MdmUser {
  id: string;
  name: string;
  departmentId: string | null;
  roleId: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  title: string | null;
  useYn: YesNo;
  lastLoginPlantId?: string | null;
}

export interface ReferenceUser {
  id: string;
  name: string;
  departmentId?: string | null;
  departmentName?: string | null;
  position?: string | null;
  title?: string | null;
}

export interface Warehouse {
  id: string;
  name: string;
  plantId?: string | null;
}

export interface CodeGroup {
  id: string;
  name: string;
  systemUseYn: YesNo;
}

export interface CodeItem {
  id: string;
  name: string;
  legalInspectYn: YesNo;
  sortOrder: number;
}

export interface ModuleMetadata {
  code: string;
  label: string;
}

export interface MdmPermission {
  C: string;
  R: string;
  U: string;
  D: string;
  A: string;
}
