export interface Inventory {
  id: string;
  name: string;
  invTypeCode: string | null;
  unit: string | null;
  makerName: string | null;
  spec: string | null;
  model: string | null;
  serialNumber: string | null;
  safetyQty: string | number;
  reorderQty: string | number;
  leadTimeDays: number;
  remarks: string | null;
}

export interface InventoryFormValues {
  id: string;
  name: string;
  invTypeCode: string;
  unit: string;
  makerName: string;
  spec: string;
  model: string;
  serialNumber: string;
  safetyQty: number;
  reorderQty: number;
  leadTimeDays: number;
  remarks: string;
}
