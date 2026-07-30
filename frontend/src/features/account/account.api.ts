import axiosInstance from '../../api/axios';

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

export const accountApi = {
  async getMyProfile(): Promise<MyProfile> {
    const response = await axiosInstance.get<MyProfile>('/auth/me');
    return response.data;
  },
  async updateMyProfile(request: UpdateMyProfileRequest): Promise<void> {
    await axiosInstance.put('/auth/me', request);
  },
  async changeMyPassword(request: ChangeMyPasswordRequest): Promise<void> {
    await axiosInstance.put('/auth/me/password', request);
  },
};
