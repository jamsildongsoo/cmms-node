export type YesNo = 'Y' | 'N';

export interface Equipment {
  id: string;
  plantId: string;
  name: string;
  location: string | null;
  eqTypeCode: string | null;
  installDate: string | null;
  workPermitYn: YesNo;
  makerName: string | null;
  spec: string | null;
  model: string | null;
  serialNumber: string | null;
  remarks: string | null;
  lastCheckDate: string | null;
  nextCheckDate: string | null;
}

export interface EquipmentCheckCycle {
  checkTypeCode: string;
  cycleVal: number | null;
  cycleUnit: string;
  lastCheckDate: string | null;
  nextCheckDate: string | null;
}

export interface EquipmentDetail {
  equipment: Equipment;
  checkCycles: EquipmentCheckCycle[];
}

export interface EquipmentSaveRequest {
  equipment: Partial<Equipment> & Pick<Equipment, 'id' | 'plantId' | 'name'>;
  checkCycles: EquipmentCheckCycle[];
}

export interface EquipmentFormValues {
  id: string;
  plantId: string;
  name: string;
  location: string;
  eqTypeCode: string;
  installDate: string;
  workPermitYn: YesNo;
  makerName: string;
  spec: string;
  model: string;
  serialNumber: string;
  remarks: string;
  checkCycles: EquipmentCheckCycle[];
}
