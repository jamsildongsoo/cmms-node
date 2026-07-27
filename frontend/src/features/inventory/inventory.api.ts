import axiosInstance from '../../api/axios';
import type { Inventory } from './inventory.types';

export const inventoryApi = {
  async getAll(): Promise<Inventory[]> {
    const response = await axiosInstance.get<Inventory[]>('/master/inventories');
    return response.data;
  },
  async create(value: Partial<Inventory>): Promise<Inventory> {
    const response = await axiosInstance.post<Inventory>('/master/inventories', value);
    return response.data;
  },
  async update(id: string, value: Partial<Inventory>): Promise<Inventory> {
    const response = await axiosInstance.put<Inventory>(`/master/inventories/${id}`, value);
    return response.data;
  },
  async delete(id: string): Promise<void> {
    await axiosInstance.delete(`/master/inventories/${id}`);
  },
  async downloadCsv(): Promise<Blob> {
    const response = await axiosInstance.get<Blob>('/master/inventories/csv', {
      responseType: 'blob',
    });
    return response.data;
  },
};

