import axiosInstance from '../../api/axios';
import type { EquipmentReference, InventoryReference } from './master-reference.types';

export const masterReferenceApi = {
  async getEquipments(plantId?: string | null): Promise<EquipmentReference[]> {
    const response = await axiosInstance.get<EquipmentReference[]>('/master/equipments', {
      params: { plantId: plantId || undefined },
    });
    return response.data;
  },
  async getInventories(): Promise<InventoryReference[]> {
    const response = await axiosInstance.get<InventoryReference[]>('/master/inventories');
    return response.data;
  },
};
