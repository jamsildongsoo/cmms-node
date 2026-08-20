import axiosInstance from '../../api/axios';
import type { EquipmentReference, InventoryReference } from './master-reference.types';

export const masterLookupApi = {
  async getEquipments(plantId?: string | null, keyword?: string): Promise<EquipmentReference[]> {
    const response = await axiosInstance.get<EquipmentReference[]>('/master/equipments', {
      params: { plantId: plantId || undefined, keyword: keyword?.trim() || undefined, limit: 30 },
    });
    return response.data;
  },
  async getInventories(keyword?: string): Promise<InventoryReference[]> {
    const response = await axiosInstance.get<InventoryReference[]>('/master/inventories', {
      params: { keyword: keyword?.trim() || undefined, limit: 30 },
    });
    return response.data;
  },
};
