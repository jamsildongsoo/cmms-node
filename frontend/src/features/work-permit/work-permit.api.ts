import axiosInstance from '../../api/axios';
import type { WorkPermit } from './work-permit.types';

type WorkPermitSaveRequest = Omit<Partial<WorkPermit>, 'id'> & { id?: string | null };

export const workPermitApi = {
  async getAll(params?: URLSearchParams): Promise<WorkPermit[]> {
    const response = await axiosInstance.get<WorkPermit[]>('/work-permit', { params });
    return response.data;
  },
  async getDetail(plantId: string, id: string): Promise<WorkPermit> {
    const response = await axiosInstance.get<WorkPermit>(`/work-permit/${id}`, {
      params: { plantId },
    });
    return response.data;
  },
  async create(request: WorkPermitSaveRequest): Promise<WorkPermit> {
    const response = await axiosInstance.post<WorkPermit>('/work-permit', request);
    return response.data;
  },
  async update(request: WorkPermitSaveRequest): Promise<WorkPermit> {
    const response = await axiosInstance.put<WorkPermit>(`/work-permit/${request.id}`, request);
    return response.data;
  },
  async delete(plantId: string, id: string): Promise<void> {
    await axiosInstance.delete(`/work-permit/${id}`, { params: { plantId } });
  },
};
