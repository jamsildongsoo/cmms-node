import axiosInstance from '../../api/axios';
import type {
  ProcessStockRequest,
  StockHistory,
  StockDocument,
  StockStatus,
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
  async closeMonth(closingYm: string): Promise<void> {
    await axiosInstance.post('/inventory-tx/close', undefined, { params: { closingYm } });
  },
};
