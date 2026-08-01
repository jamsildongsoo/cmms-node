export interface MyProfile {
  companyId: string;
  id: string;
  name: string;
  departmentId: string | null;
  email: string | null;
  phone: string | null;
  position: string | null;
  title: string | null;
}

export interface UpdateMyProfileRequest {
  name: string;
  email: string;
  phone: string;
  position: string;
  title: string;
}

export interface ChangeMyPasswordRequest {
  currentPassword: string;
  newPassword: string;
}
