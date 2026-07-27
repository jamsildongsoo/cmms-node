import axiosInstance from '../../api/axios';
import type { PmRecord, PmRecordDetail, PmRecordItem } from './pm.types';

interface PmSaveRequest {
  pmRecord: Omit<Partial<PmRecord>, 'id'> & { id?: string | null };
  checkItems: PmRecordItem[];
}

export const pmApi = {
  async getAll(params: URLSearchParams): Promise<PmRecord[]> {
    const response = await axiosInstance.get<PmRecord[]>('/pm/records', { params });
    return response.data;
  },
  async getDetail(plantId: string, id: string): Promise<PmRecordDetail> {
    const response = await axiosInstance.get<PmRecordDetail>(`/pm/records/${id}`, {
      params: { plantId },
    });
    return response.data;
  },
  async getTemplates(plantId: string, checkTypeCode: string): Promise<PmRecordItem[]> {
    const response = await axiosInstance.get<PmRecordItem[]>('/pm/templates', {
      params: { plantId, checkTypeCode },
    });
    return response.data;
  },
  async create(request: PmSaveRequest): Promise<PmRecord> {
    const response = await axiosInstance.post<PmRecord>('/pm/records', request);
    return response.data;
  },
  async update(request: PmSaveRequest): Promise<PmRecord> {
    const response = await axiosInstance.put<PmRecord>(`/pm/records/${request.pmRecord.id}`, request);
    return response.data;
  },
  async closePlan(plantId: string, id: string): Promise<void> {
    await axiosInstance.post(`/pm/plans/${id}/actions/close`, undefined, { params: { plantId } });
  },
  async delete(plantId: string, id: string): Promise<void> {
    await axiosInstance.delete(`/pm/records/${id}`, { params: { plantId } });
  },
};
