import axiosInstance from '../../api/axios';
import type { CodeItem, Department, Plant, ReferenceUser, Warehouse } from './mdm.types';

export const referenceApi = {
  async getPlants(plantId?: string | null): Promise<Plant[]> {
    const response = await axiosInstance.get<Plant[]>('/mdm/refs/plants', {
      params: { plantId: plantId || undefined },
    });
    return response.data;
  },
  async getDepartments(): Promise<Department[]> {
    const response = await axiosInstance.get<Department[]>('/mdm/refs/departments');
    return response.data;
  },
  async getWarehouses(plantId?: string | null): Promise<Warehouse[]> {
    const response = await axiosInstance.get<Warehouse[]>('/mdm/refs/warehouses', {
      params: { plantId: plantId || undefined },
    });
    return response.data;
  },
  async getUsers(): Promise<ReferenceUser[]> {
    const response = await axiosInstance.get<ReferenceUser[]>('/mdm/refs/users');
    return response.data;
  },
  async getCodes(groupId: string): Promise<CodeItem[]> {
    const response = await axiosInstance.get<CodeItem[]>(`/mdm/codes/items/${groupId}`);
    return response.data;
  },
};
