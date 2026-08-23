import axiosInstance from '../../api/axios';
import type {
  PmRecord,
  PmRecordDetail,
  PmRecordItem,
  PmSaveRequest,
} from './pm.types';

export interface PmRecordListParams {
  plantId?: string | null;
  searchType?: 'id' | 'title' | 'author';
  searchValue?: string;
  showAll?: boolean;
  tempOnly?: boolean;
}

export const pmApi = {
  async getAll(params: PmRecordListParams): Promise<PmRecord[]> {
    const response = await axiosInstance.get<PmRecord[]>('/pm/records', {
      params: {
        ...params,
        plantId: params.plantId || undefined,
        searchValue: params.searchValue?.trim() || undefined,
        showAll: params.showAll ? 'Y' : undefined,
        tempOnly: params.tempOnly ? 'Y' : undefined,
      },
    });
    return response.data;
  },
  async getDetail(plantId: string, id: string): Promise<PmRecordDetail> {
    const response = await axiosInstance.get<PmRecordDetail>(`/pm/records/${id}`, {
      params: { plantId },
    });
    return response.data;
  },
  async getTemplates(plantId: string, equipmentId: string, checkTypeCode: string): Promise<PmRecordItem[]> {
    const response = await axiosInstance.get<PmRecordItem[]>('/pm/templates', {
      params: { plantId, equipmentId, checkTypeCode },
    });
    return response.data;
  },
  async create(request: PmSaveRequest): Promise<PmRecord> {
    const response = await axiosInstance.post<PmRecord>('/pm/records', request);
    return response.data;
  },
  async update(id: string, request: PmSaveRequest): Promise<PmRecord> {
    const body = { ...request, pmRecord: { ...request.pmRecord } };
    delete body.pmRecord.id;
    const response = await axiosInstance.put<PmRecord>(`/pm/records/${id}`, body);
    return response.data;
  },
  async delete(plantId: string, id: string): Promise<void> {
    await axiosInstance.delete(`/pm/records/${id}`, { params: { plantId } });
  },
};
