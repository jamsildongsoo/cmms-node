import axiosInstance from '../../api/axios';
import type {
  PlaceOrderRequest,
  PurchaseReceiptDetail,
  PurchaseReceiptRequestSummary,
  PurchaseRequest,
  PurchaseRequestDetail,
  PurchaseRequestItem,
  ReceiveRequest,
} from './procurement.types';

export const procurementApi = {
  async getRequests(receivable = false, plantId?: string | null): Promise<PurchaseRequest[]> {
    const response = await axiosInstance.get<PurchaseRequest[]>('/procurement/requests', {
      params: { plantId: plantId || undefined, receivable: receivable ? 'Y' : undefined },
    });
    return response.data;
  },
  async getRequest(id: string, plantId?: string | null): Promise<PurchaseRequestDetail> {
    const response = await axiosInstance.get<PurchaseRequestDetail>(`/procurement/requests/${id}`, {
      params: { plantId: plantId || undefined },
    });
    return response.data;
  },
  async getOrders(receivable = false, plantId?: string | null): Promise<PurchaseRequest[]> {
    const response = await axiosInstance.get<PurchaseRequest[]>('/procurement/orders', {
      params: { plantId: plantId || undefined, receivable: receivable ? 'Y' : undefined },
    });
    return response.data;
  },
  async getOrder(id: string, plantId?: string | null): Promise<PurchaseRequestDetail> {
    const response = await axiosInstance.get<PurchaseRequestDetail>(`/procurement/orders/${id}`, {
      params: { plantId: plantId || undefined },
    });
    return response.data;
  },
  async create(header: Partial<PurchaseRequest>, items: PurchaseRequestItem[]): Promise<PurchaseRequest> {
    const response = await axiosInstance.post<PurchaseRequest>('/procurement/requests', { header, items });
    return response.data;
  },
  async update(id: string, header: Partial<PurchaseRequest>, items: PurchaseRequestItem[]): Promise<PurchaseRequest> {
    const response = await axiosInstance.put<PurchaseRequest>(`/procurement/requests/${id}`, { header, items });
    return response.data;
  },
  async confirm(id: string): Promise<void> {
    await axiosInstance.post(`/procurement/requests/${id}/actions/confirm`);
  },
  async deleteRequest(id: string): Promise<void> {
    await axiosInstance.delete(`/procurement/requests/${id}`);
  },
  async closeRequest(id: string): Promise<void> {
    await axiosInstance.post(`/procurement/orders/${id}/actions/close`);
  },
  async placeOrder(request: PlaceOrderRequest): Promise<void> {
    const requestId = String(request.requestId);
    const payload = {
      orderDate: request.orderDate,
      etaDate: request.etaDate,
    };
    await axiosInstance.post(`/procurement/orders/${requestId}/actions/order`, payload);
  },
  async startShipping(requestId: string, shipStartDate: string): Promise<void> {
    await axiosInstance.post(`/procurement/orders/${requestId}/actions/ship`, { shipStartDate });
  },
  async receive(request: ReceiveRequest): Promise<void> {
    const { requestId, ...payload } = request;
    await axiosInstance.post(`/procurement/requests/${requestId}/actions/receive`, payload);
  },
  async getReceiptRequests(): Promise<PurchaseReceiptRequestSummary[]> {
    const response = await axiosInstance.get<PurchaseReceiptRequestSummary[]>(
      '/procurement/receipts/requests',
    );
    return response.data;
  },
  async getReceiptRequest(id: string): Promise<PurchaseReceiptDetail> {
    const response = await axiosInstance.get<PurchaseReceiptDetail>(
      `/procurement/receipts/request/${encodeURIComponent(id)}`,
    );
    return response.data;
  },
};
