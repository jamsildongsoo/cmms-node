import axiosInstance from '../../api/axios';
import type {
  ChangeMyPasswordRequest,
  MyProfile,
  UpdateMyProfileRequest,
} from './account.types';

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
