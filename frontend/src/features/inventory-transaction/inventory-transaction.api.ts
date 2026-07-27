import axiosInstance from '../../api/axios';
import type {
  InventoryHistory,
  InventoryStatus,
  InventoryTransactionItem,
} from './inventory-transaction.types';

interface ProcessInventoryTransactionRequest {
  items: Array<InventoryTransactionItem & {
    txTypeCode: string;
    txReasonCode: string;
    txDate: string;
  }>;
}

export const inventoryTransactionApi = {
  async getStatus(): Promise<InventoryStatus[]> {
    const response = await axiosInstance.get<InventoryStatus[]>('/inventory-tx/status');
    return response.data;
  },
  async getHistory(): Promise<InventoryHistory[]> {
    const response = await axiosInstance.get<InventoryHistory[]>('/inventory-tx/history');
    return response.data;
  },
  async process(request: ProcessInventoryTransactionRequest): Promise<void> {
    await axiosInstance.post('/inventory-tx', request);
  },
  async closeMonth(closingYm: string): Promise<void> {
    await axiosInstance.post('/inventory-tx/close', undefined, { params: { closingYm } });
  },
};
