import axiosInstance from '../../api/axios';
import type { CodeItem, Department, Plant, ReferenceUser, Warehouse } from './mdm.types';

const getCodeOptionsByGroup = async (groupId: string): Promise<CodeItem[]> => {
  const response = await axiosInstance.get<CodeItem[]>(`/mdm/code-groups/${groupId}/items`);
  return response.data;
};

export const referenceApi = {
  async getPlantOptions(plantId?: string | null): Promise<Plant[]> {
    const response = await axiosInstance.get<Plant[]>('/mdm/plants', {
      params: { plantId: plantId || undefined },
    });
    return response.data;
  },
  async getDepartmentOptions(): Promise<Department[]> {
    const response = await axiosInstance.get<Department[]>('/mdm/departments');
    return response.data;
  },
  async getWarehouseOptions(plantId?: string | null): Promise<Warehouse[]> {
    const response = await axiosInstance.get<Warehouse[]>('/mdm/warehouses', {
      params: { plantId: plantId || undefined },
    });
    return response.data;
  },
  async getUserOptions(): Promise<ReferenceUser[]> {
    const response = await axiosInstance.get<ReferenceUser[]>('/mdm/users');
    return response.data;
  },
  async getProcurementTypeOptions(): Promise<CodeItem[]> {
    return getCodeOptionsByGroup('PR_TYPE');
  },
  async getInventoryTypeOptions(): Promise<CodeItem[]> {
    return getCodeOptionsByGroup('INV_TYPE');
  },
  async getEquipmentTypeOptions(): Promise<CodeItem[]> {
    return getCodeOptionsByGroup('EQ_TYPE');
  },
  async getPmTypeOptions(): Promise<CodeItem[]> {
    return getCodeOptionsByGroup('PM_TYPE');
  },
};
