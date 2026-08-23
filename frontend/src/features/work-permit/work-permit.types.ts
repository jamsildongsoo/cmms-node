export interface WorkPermitCheckItem {
  question: string;
  checked: boolean;
  remarks: string;
}

export interface WorkPermit {
  id: string;
  plantId: string;
  equipmentId: string;
  title: string;
  permitTypeCodes: string;
  startAt: string | null;
  endAt: string | null;
  departmentId: string;
  supervisorId: string;
  workSummary: string | null;
  riskFactors: string | null;
  safetyMeasures: string | null;
  jsonGeneral: string | WorkPermitCheckItem[] | null;
  jsonFire: string | WorkPermitCheckItem[] | null;
  jsonConfined: string | WorkPermitCheckItem[] | null;
  jsonElectric: string | WorkPermitCheckItem[] | null;
  jsonHighPlace: string | WorkPermitCheckItem[] | null;
  jsonExcavation: string | WorkPermitCheckItem[] | null;
  jsonHeavyLoad: string | WorkPermitCheckItem[] | null;
  remarks: string | null;
  fileGroupId: number | null;
  refNo: string | null;
  refModule: string | null;
  approvalId: string | null;
  status: string;
  createdAt?: string | null;
  createdBy?: string | null;
}
