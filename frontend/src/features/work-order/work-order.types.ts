export interface WorkOrder {
  id: string;
  plantId: string;
  equipmentId: string;
  title: string;
  stepStage: string;
  woTypeCode: string;
  departmentId: string;
  workerId: string | null;
  workDate: string | null;
  cost: number;
  manHours: number;
  manHoursUnit: string;
  remarks: string | null;
  fileGroupId: number | null;
  refNo: string | null;
  refModule: string | null;
  approvalId: string | null;
  status: string;
  createdAt?: string | null;
  createdBy?: string | null;
}

export interface WorkOrderItem {
  itemNo: number;
  workName: string;
  workMethod: string | null;
  workResult: string | null;
}

export interface WorkOrderDetail {
  workOrder: WorkOrder;
  workItems: WorkOrderItem[];
}

export interface WorkOrderSaveRequest {
  workOrder: Omit<Partial<WorkOrder>, 'id'> & { id?: string | null };
  workItems: WorkOrderItem[];
}
