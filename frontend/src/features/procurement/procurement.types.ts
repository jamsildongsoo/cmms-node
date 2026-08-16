export interface PurchaseRequest {
  id: string;
  purchaseRequestId?: string;
  purchaseOrderId?: string;
  plantId: string;
  warehouseId: string;
  requesterId: string;
  departmentId?: string | null;
  requestDate: string;
  requestType?: string;
  orderDate?: string | null;
  etaDate?: string | null;
  shipStartDate?: string | null;
  purchaseManager?: string | null;
  purchaseManagerContact?: string | null;
  purchaseManagerRemarks?: string | null;
  status: string;
  procStatus?: string | null;
  remarks?: string;
  title?: string;
  approvalId?: string | null;
  createdAt?: string | null;
}

export interface PurchaseRequestItem {
  itemNo?: number;
  inventoryId: string;
  qty: number;
  unit?: string;
  remarks?: string;
  receivedQty?: number | string | null;
}

export interface PurchaseRequestDetail {
  header: PurchaseRequest;
  items: PurchaseRequestItem[];
}

export interface PurchaseOrderAllocation {
  docId: string;
  docItemNo: number;
  prId: string;
  prItemNo: number;
  warehouseId: string;
  inventoryId: string;
  allocatedQty: string | number;
}

export interface PlaceOrderRequest {
  requestId: string;
  orderDate?: string | null;
  etaDate?: string | null;
}

export interface ReceiveRequest {
  requestId: string;
  warehouseId: string;
  txDate: string;
  close?: boolean;
  lines: PurchaseReceiveLine[];
}

export interface PurchaseReceiveLine {
  itemNo: number;
  qty: number;
  unitPrice?: number | null;
}

export interface PurchaseReceiveModalLine {
  itemNo: number;
  inventoryId: string;
  qty: number;
  unit?: string;
  receivedQty: number;
  remaining: number;
  inputQty: number;
  unitPrice: number | string;
}

export interface PurchaseReceiptRequest {
  id: string;
  title: string;
  plantId: string;
  warehouseId: string;
  requesterId: string;
  departmentId?: string | null;
  status: string;
  procStatus?: string | null;
}

export interface PurchaseReceiptRequestSummary extends PurchaseReceiptRequest {
  requestedQty: string;
  remainingQty: string;
}

export interface PurchaseReceiptItem {
  itemNo: number;
  inventoryId: string;
  qty: number;
  receivedQty: number;
  remaining: number;
  inputQty: number;
  unitPrice: number;
  unit?: string | null;
}

export interface PurchaseReceiptDetail {
  header: PurchaseReceiptRequest;
  items: Array<{
    itemNo: number;
    inventoryId: string;
    qty: number | string;
    receivedQty?: number | string | null;
    unit?: string | null;
  }>;
}
