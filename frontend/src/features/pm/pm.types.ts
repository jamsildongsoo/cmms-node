export type PmStage = 'P' | 'R';
export type PmTab = 'plans' | 'results';

export interface PmRecord {
  id: string;
  plantId: string;
  title: string | null;
  equipmentId: string;
  equipmentName?: string | null;
  departmentId: string;
  checkTypeCode: string;
  stepStage: PmStage;
  cycleFrom: string | null;
  cycleEnd: string | null;
  closeYn: string;
  workDate: string | null;
  workerId: string;
  judgeCode: string;
  remarks: string | null;
  certNumber: string | null;
  certExpireDate: string | null;
  certAgency: string | null;
  approvalId: string | null;
  refNo: string | null;
  refModule: string | null;
  status: string;
  createdAt?: string | null;
  createdBy?: string | null;
}

export interface PmRecordItem {
  itemNo: number;
  checkName: string;
  checkMethod: string | null;
  minValue: number | null;
  maxValue: number | null;
  baseValue: number | null;
  unit: string | null;
  checkValue: number | null;
}

export interface PmRecordDetail {
  pmRecord: PmRecord;
  checkItems: PmRecordItem[];
}

export interface PmSaveRequest {
  pmRecord: Omit<Partial<PmRecord>, 'id'> & { id?: string | null };
  checkItems: PmRecordItem[];
}
