import axiosInstance from '../../api/axios';
import type {
  PurchaseRequest,
  PurchaseOrder,
  PurchaseRequestDetail,
  PurchaseRequestItem,
  PurchaseOrderAllocation,
  PurchaseOrderLink,
} from './procurement.types';

export const procurementApi = {
  async getRequests(receivable = false, plantId?: string | null, tempOnly = false): Promise<PurchaseRequest[]> {
    const response = await axiosInstance.get<PurchaseRequest[]>('/procurement/requests', {
      params: {
        plantId: plantId || undefined,
        receivable: receivable ? 'Y' : undefined,
        tempOnly: tempOnly ? 'Y' : undefined,
      },
    });
    return response.data;
  },
  async getRequest(id: string, plantId?: string | null): Promise<PurchaseRequestDetail> {
    const response = await axiosInstance.get<PurchaseRequestDetail>(`/procurement/requests/${id}`, {
      params: { plantId: plantId || undefined },
    });
    return response.data;
  },
  async getPurchaseOrderLinks(id: string): Promise<PurchaseOrderLink[]> {
    const response = await axiosInstance.get<PurchaseOrderLink[]>(
      `/procurement/requests/${encodeURIComponent(id)}/order-links`,
    );
    return response.data;
  },
  async getOrders(receivable = false, plantId?: string | null, tempOnly = false): Promise<PurchaseOrder[]> {
    const response = await axiosInstance.get<PurchaseOrder[]>('/procurement/orders', {
      params: {
        plantId: plantId || undefined,
        receivable: receivable ? 'Y' : undefined,
        tempOnly: tempOnly ? 'Y' : undefined,
      },
    });
    return response.data;
  },
  async createIntegratedOrder(request: {
    orderDate?: string;
    etaDate?: string;
    lines: Array<{ prId: string; prItemNo: number; qty: number }>;
  }): Promise<PurchaseOrder> {
    const response = await axiosInstance.post<PurchaseOrder>('/procurement/orders', request);
    return response.data;
  },
  async createStandaloneOrder(request: {
    plantId: string;
    warehouseId?: string | null;
    orderDate?: string;
    etaDate?: string;
    items: PurchaseRequestItem[];
  }): Promise<PurchaseOrder> {
    const response = await axiosInstance.post<PurchaseOrder>('/procurement/orders/standalone', request);
    return response.data;
  },
  async updateOrder(id: string, request: {
    plantId: string;
    warehouseId?: string | null;
    orderDate?: string;
    etaDate?: string;
    items?: PurchaseRequestItem[];
  }): Promise<PurchaseRequestDetail> {
    const response = await axiosInstance.put<PurchaseRequestDetail>(
      `/procurement/orders/${encodeURIComponent(id)}`,
      request,
    );
    return response.data;
  },
  async getOrder(id: string, plantId?: string | null): Promise<PurchaseRequestDetail> {
    const response = await axiosInstance.get<PurchaseRequestDetail>(`/procurement/orders/${id}`, {
      params: { plantId: plantId || undefined },
    });
    return response.data;
  },
  async getOrderAllocations(orderId: string): Promise<PurchaseOrderAllocation[]> {
    const response = await axiosInstance.get<PurchaseOrderAllocation[]>(
      `/procurement/orders/${encodeURIComponent(orderId)}/allocations`,
    );
    return response.data;
  },
  async getOrderInventoryDocuments(orderId: string): Promise<Array<{ id: string; txDate: string; refModule: string | null; refNo: string | null; remarks: string | null; createdBy: string; createdAt: string; reverseDocumentId: string | null }>> {
    const response = await axiosInstance.get(`/procurement/orders/${encodeURIComponent(orderId)}/inventory-documents`);
    return response.data;
  },
  async saveOrderAllocations(
    orderId: string,
    lines: Array<Pick<PurchaseOrderAllocation, 'docItemNo' | 'prId' | 'prItemNo' | 'allocatedQty'>>,
  ): Promise<PurchaseOrderAllocation[]> {
    const response = await axiosInstance.put<PurchaseOrderAllocation[]>(
      `/procurement/orders/${encodeURIComponent(orderId)}/allocations`,
      { lines },
    );
    return response.data;
  },
  async createRequest(header: Partial<PurchaseRequest>, items: PurchaseRequestItem[]): Promise<PurchaseRequest> {
    const response = await axiosInstance.post<PurchaseRequest>('/procurement/requests', { header, items });
    return response.data;
  },
  async updateRequest(id: string, header: Partial<PurchaseRequest>, items: PurchaseRequestItem[]): Promise<PurchaseRequest> {
    const body = { header: { ...header }, items };
    delete body.header.id;
    const response = await axiosInstance.put<PurchaseRequest>(`/procurement/requests/${id}`, body);
    return response.data;
  },
  async confirmOrder(id: string): Promise<void> {
    await axiosInstance.post(`/procurement/orders/${encodeURIComponent(id)}/actions/confirm`);
  },
  async deleteOrder(id: string): Promise<void> {
    await axiosInstance.delete(`/procurement/orders/${encodeURIComponent(id)}`);
  },
  async deleteRequest(id: string): Promise<void> {
    await axiosInstance.delete(`/procurement/requests/${id}`);
  },
  async closeRequest(id: string): Promise<void> {
    await axiosInstance.post(`/procurement/orders/${id}/actions/close`);
  },
};
