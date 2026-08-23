import axiosInstance from '../../api/axios';
import type { WorkOrder, WorkOrderDetail, WorkOrderSaveRequest } from './work-order.types';

export interface WorkOrderListParams {
  plantId?: string | null;
  searchType?: 'id' | 'title' | 'worker';
  searchValue?: string;
  tempOnly?: boolean;
}

export const workOrderApi = {
  async getAll(params: WorkOrderListParams = {}): Promise<WorkOrder[]> {
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
  async update(id: string, request: WorkOrderSaveRequest): Promise<WorkOrder> {
    const body = { ...request, workOrder: { ...request.workOrder } };
    delete body.workOrder.id;
    const response = await axiosInstance.put<WorkOrder>(`/work-order/${id}`, body);
    return response.data;
  },
  async delete(plantId: string, id: string): Promise<void> {
    await axiosInstance.delete(`/work-order/${id}`, { params: { plantId } });
  },
};
