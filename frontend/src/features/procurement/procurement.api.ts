import axiosInstance from '../../api/axios';
import type {
  PurchaseReceiveLine,
  PurchaseReceiptDetail,
  PurchaseReceiptRequestSummary,
  PurchaseRequest,
  PurchaseRequestItem,
  Vendor,
} from './procurement.types';

export interface PurchaseRequestDetail {
  header: PurchaseRequest;
  items: PurchaseRequestItem[];
}

export const procurementApi = {
  async getRequests(management = false): Promise<PurchaseRequest[]> {
    const path = management ? '/procurement/management/requests' : '/procurement/requests';
    const response = await axiosInstance.get<PurchaseRequest[]>(path);
    return response.data;
  },
  async getRequest(id: string, management = false): Promise<PurchaseRequestDetail> {
    const path = management
      ? `/procurement/management/requests/${id}`
      : `/procurement/requests/${id}`;
    const response = await axiosInstance.get<PurchaseRequestDetail>(path);
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
    await axiosInstance.post(`/procurement/requests/${id}/actions/close`);
  },
  async placeOrder(request: Record<string, unknown>): Promise<void> {
    const requestId = String(request.requestId);
    const { requestId: _requestId, ...payload } = request;
    await axiosInstance.post(`/procurement/requests/${requestId}/actions/order`, payload);
  },
  async startShipping(requestId: string, shipStartDate: string): Promise<void> {
    await axiosInstance.post(`/procurement/requests/${requestId}/actions/ship`, { shipStartDate });
  },
  async receive(request: {
    requestId: string;
    warehouseId: string;
    txDate: string;
    close?: boolean;
    lines: PurchaseReceiveLine[];
  }): Promise<void> {
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
  async getVendors(): Promise<Vendor[]> {
    const response = await axiosInstance.get<Vendor[]>('/procurement/vendors');
    return response.data;
  },
  async createVendor(vendor: Vendor): Promise<void> {
    await axiosInstance.post('/procurement/vendors', vendor);
  },
  async updateVendor(vendor: Vendor): Promise<void> {
    await axiosInstance.put(`/procurement/vendors/${vendor.id}`, vendor);
  },
  async deleteVendor(id: string): Promise<void> {
    await axiosInstance.delete(`/procurement/vendors/${id}`);
  },
};
