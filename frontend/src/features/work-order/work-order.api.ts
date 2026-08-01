import axiosInstance from '../../api/axios';
import type { WorkOrder, WorkOrderDetail, WorkOrderSaveRequest } from './work-order.types';

export const workOrderApi = {
  async getAll(params?: URLSearchParams, plantId?: string | null): Promise<WorkOrder[]> {
    if (plantId) params?.set('plantId', plantId);
    const response = await axiosInstance.get<WorkOrder[]>('/work-order', { params });
    return response.data;
  },
  async getDetail(plantId: string, id: string): Promise<WorkOrderDetail> {
    const response = await axiosInstance.get<WorkOrderDetail>(`/work-order/${id}`, {
      params: { plantId },
    });
    return response.data;
  },
  async create(request: WorkOrderSaveRequest): Promise<WorkOrder> {
    const response = await axiosInstance.post<WorkOrder>('/work-order', request);
    return response.data;
  },
  async update(request: WorkOrderSaveRequest): Promise<WorkOrder> {
    const response = await axiosInstance.put<WorkOrder>(`/work-order/${request.workOrder.id}`, request);
    return response.data;
  },
  async delete(plantId: string, id: string): Promise<void> {
    await axiosInstance.delete(`/work-order/${id}`, { params: { plantId } });
  },
};
