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
  closedAt?: string | null;
  remarks?: string;
  title?: string;
  approvalId?: string | null;
  fileGroupId?: number | null;
  createdAt?: string | null;
}

export interface PurchaseRequestItem {
  itemNo?: number;
  inventoryId: string;
  qty: number;
  unit?: string;
  remarks?: string;
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

export interface PurchaseOrderLink {
  orderId: string;
  status: string;
}
