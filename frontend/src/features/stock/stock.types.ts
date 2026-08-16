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

export interface StockDocumentItem {
  companyId: string;
  documentId: string;
  itemNo: number;
  warehouseId: string;
  inventoryId: string;
  txTypeCode: string;
  txReasonCode: string;
  qty: number;
  unitPrice: number;
  refLineNo: string | null;
}

export interface StockDocument {
  companyId: string;
  id: string;
  txDate: string;
  refModule: string | null;
  refNo: string | null;
  remarks: string | null;
  items: StockDocumentItem[];
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
