import axiosInstance from '../../api/axios';
import type { Equipment, EquipmentDetail, EquipmentSaveRequest } from './equipment.types';

export const equipmentApi = {
  async getAll(): Promise<Equipment[]> {
    const response = await axiosInstance.get<Equipment[]>('/master/equipments');
    return response.data;
  },
  async getDetail(plantId: string, id: string): Promise<EquipmentDetail> {
    const response = await axiosInstance.get<EquipmentDetail>('/master/equipments/details', {
      params: { plantId, id },
    });
    return response.data;
  },
  async create(request: EquipmentSaveRequest): Promise<Equipment> {
    const response = await axiosInstance.post<Equipment>('/master/equipments', request);
    return response.data;
  },
  async update(request: EquipmentSaveRequest): Promise<Equipment> {
    const response = await axiosInstance.put<Equipment>('/master/equipments', request);
    return response.data;
  },
  async delete(plantId: string, id: string): Promise<void> {
    await axiosInstance.delete('/master/equipments', { params: { plantId, id } });
  },
  async downloadCsv(): Promise<Blob> {
    const response = await axiosInstance.get<Blob>('/master/equipments/csv', {
      responseType: 'blob',
    });
    return response.data;
  },
};

