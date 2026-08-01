import axiosInstance from '../../api/axios';
import type {
  ProcessStockRequest,
  StockHistory,
  StockStatus,
} from './stock.types';

export const stockApi = {
  async getStatus(): Promise<StockStatus[]> {
    const response = await axiosInstance.get<StockStatus[]>('/inventory-tx/status');
    return response.data;
  },
  async getHistory(): Promise<StockHistory[]> {
    const response = await axiosInstance.get<StockHistory[]>('/inventory-tx/history');
    return response.data;
  },
  async process(request: ProcessStockRequest): Promise<void> {
    await axiosInstance.post('/inventory-tx', request);
  },
  async closeMonth(closingYm: string): Promise<void> {
    await axiosInstance.post('/inventory-tx/close', undefined, { params: { closingYm } });
  },
};
