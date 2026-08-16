import axiosInstance from '../../api/axios';
import type {
  CodeGroup,
  CodeItem,
  Department,
  MdmUser,
  ModuleMetadata,
  Plant,
  Role,
  RoleDetail,
  Warehouse,
} from './mdm.types';

const resourceApi = <T extends { id: string }>(path: string) => ({
  async getAll(): Promise<T[]> {
    const response = await axiosInstance.get<T[]>(path);
    return response.data;
  },
  async create(value: Partial<T>): Promise<T> {
    const response = await axiosInstance.post<T>(path, value);
    return response.data;
  },
  async update(id: string, value: Partial<T>): Promise<T> {
    const response = await axiosInstance.put<T>(`${path}/${id}`, value);
    return response.data;
  },
  async delete(id: string): Promise<void> {
    await axiosInstance.delete(`${path}/${id}`);
  },
});

export const plantApi = resourceApi<Plant>('/mdm/plants');
export const departmentApi = resourceApi<Department>('/mdm/departments');
export const userApi = resourceApi<MdmUser>('/mdm/users');
export const warehouseApi = resourceApi<Warehouse>('/mdm/warehouses');
export const roleApi = {
  ...resourceApi<Role>('/mdm/roles'),
  async getDetails(roleId: string): Promise<RoleDetail[]> {
    const response = await axiosInstance.get<RoleDetail[]>(`/mdm/roles/${roleId}/details`);
    return response.data;
  },
  async saveDetails(roleId: string, details: RoleDetail[]): Promise<void> {
    await axiosInstance.put(`/mdm/roles/${roleId}/details`, details);
  },
};

export const codeGroupApi = {
  ...resourceApi<CodeGroup>('/mdm/code-groups'),
  async getItems(groupId: string): Promise<CodeItem[]> {
    const response = await axiosInstance.get<CodeItem[]>(
      `/mdm/code-groups/${groupId}/items`,
    );
    return response.data;
  },
  async createItem(groupId: string, item: Partial<CodeItem>): Promise<CodeItem> {
    const response = await axiosInstance.post<CodeItem>(
      `/mdm/code-groups/${groupId}/items`,
      item,
    );
    return response.data;
  },
  async updateItem(
    groupId: string,
    id: string,
    item: Partial<CodeItem>,
  ): Promise<CodeItem> {
    const response = await axiosInstance.put<CodeItem>(
      `/mdm/code-groups/${groupId}/items/${id}`,
      item,
    );
    return response.data;
  },
  async deleteItem(groupId: string, id: string): Promise<void> {
    await axiosInstance.delete(`/mdm/code-groups/${groupId}/items/${id}`);
  },
};

export const mdmMetaApi = {
  async getModules(): Promise<ModuleMetadata[]> {
    const response = await axiosInstance.get<ModuleMetadata[]>('/meta/modules');
    return response.data;
  },
};
