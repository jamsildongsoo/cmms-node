import axiosInstance from '../../api/axios';
import type {
  ProcessStockRequest,
  StockHistory,
  StockDocument,
  StockStatus,
  ReceivablePurchaseOrder,
  ReceivablePurchaseOrderDetail,
} from './stock.types';

export const stockApi = {
  async getStatus(): Promise<StockStatus[]> {
    const response = await axiosInstance.get<StockStatus[]>('/inventory-tx/status');
    return response.data.map((status) => ({
      ...status,
      qty: Number(status.qty),
      amount: Number(status.amount),
    }));
  },
  async getHistory(): Promise<StockHistory[]> {
    const response = await axiosInstance.get<StockHistory[]>('/inventory-tx/history');
    return response.data.map((history) => ({
      ...history,
      qty: Number(history.qty),
      unitPrice: Number(history.unitPrice),
      amount: Number(history.amount),
    }));
  },
  async getDocuments(): Promise<StockDocument[]> {
    const response = await axiosInstance.get<StockDocument[]>('/inventory-tx/documents');
    return response.data.map((document) => ({
      ...document,
      items: document.items.map((item) => ({
        ...item,
        qty: Number(item.qty),
        unitPrice: Number(item.unitPrice),
      })),
    }));
  },
  async getDocument(id: string): Promise<StockDocument> {
    const response = await axiosInstance.get<StockDocument>(`/inventory-tx/documents/${id}`);
    return {
      ...response.data,
      items: response.data.items.map((item) => ({
        ...item,
        qty: Number(item.qty),
        unitPrice: Number(item.unitPrice),
      })),
    };
  },
  async process(request: ProcessStockRequest): Promise<void> {
    await axiosInstance.post('/inventory-tx', request);
  },
  async getReceivableOrders(plantId?: string | null): Promise<ReceivablePurchaseOrder[]> {
    const response = await axiosInstance.get<ReceivablePurchaseOrder[]>('/procurement/orders/receivable', {
      params: { plantId: plantId || undefined },
    });
    return response.data.map((order) => ({
      ...order,
      remainingQty: order.remainingQty === undefined ? undefined : Number(order.remainingQty),
    }));
  },
  async getReceivableOrderDetail(orderId: string, plantId?: string | null): Promise<ReceivablePurchaseOrderDetail> {
    const response = await axiosInstance.get<ReceivablePurchaseOrderDetail>(
      `/procurement/orders/receivable/${encodeURIComponent(orderId)}`,
      { params: { plantId: plantId || undefined } },
    );
    return {
      ...response.data,
      items: response.data.items.map((item) => ({
        ...item,
        qty: Number(item.qty),
      })),
    };
  },
  async cancelDocument(originalDocumentId: string): Promise<string> {
    const response = await axiosInstance.post<{ documentId: string }>('/inventory-tx/cancellations', { originalDocumentId });
    return response.data.documentId;
  },
  async closeMonth(closingYm: string): Promise<void> {
    await axiosInstance.post('/inventory-tx/close', undefined, { params: { closingYm } });
  },
};
