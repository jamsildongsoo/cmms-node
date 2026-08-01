export interface StockStatus {
  warehouseId: string;
  inventoryId: string;
  qty: number;
  amount: number;
}

export interface StockHistory {
  companyId: string;
  warehouseId: string;
  inventoryId: string;
  historyNo: number;
  txTypeCode: string;
  txReasonCode: string;
  qty: number;
  unitPrice: number;
  amount: number;
  txDate: string;
  userId: string;
  refNo: string | null;
  refModule: string | null;
  docNo: string | null;
  refLineNo: string | null;
}

export interface StockProcessingItem {
  warehouseId: string;
  inventoryId: string;
  qty: number;
  unitPrice: number;
  targetWarehouseId: string;
}

export interface ProcessStockRequest {
  items: Array<StockProcessingItem & {
    txTypeCode: string;
    txReasonCode: string;
    txDate: string;
  }>;
}
