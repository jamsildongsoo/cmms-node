import { Transform } from 'class-transformer';
import { Allow, IsDateString, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { DocStatus } from '../../../common/constants/status.constants';
import type { WorkPermitCheckItem } from '../../../entities/work-permit.entity';

export class SaveWorkPermitDto {
  @IsOptional() @IsString() id?: string | null;
  @IsString() plantId!: string;
  @IsString() equipmentId!: string;
  @IsString() title!: string;
  @IsString() permitTypeCodes!: string;
  @IsOptional() @IsDateString() startAt?: string | null;
  @IsOptional() @IsDateString() endAt?: string | null;
  @IsString() departmentId!: string;
  @IsString() supervisorId!: string;
  @IsOptional() @IsString() workSummary?: string | null;
  @IsOptional() @IsString() riskFactors?: string | null;
  @IsOptional() @IsString() safetyMeasures?: string | null;
  @IsOptional() @Allow() jsonGeneral?: WorkPermitCheckItem[] | string | null;
  @IsOptional() @Allow() jsonFire?: WorkPermitCheckItem[] | string | null;
  @IsOptional() @Allow() jsonConfined?: WorkPermitCheckItem[] | string | null;
  @IsOptional() @Allow() jsonElectric?: WorkPermitCheckItem[] | string | null;
  @IsOptional() @Allow() jsonHighPlace?: WorkPermitCheckItem[] | string | null;
  @IsOptional() @Allow() jsonExcavation?: WorkPermitCheckItem[] | string | null;
  @IsOptional() @Allow() jsonHeavyLoad?: WorkPermitCheckItem[] | string | null;
  @IsOptional() @IsString() remarks?: string | null;
  @IsOptional()
  @Transform(({ value }) => value === null || value === undefined || value === '' ? value : Number(value))
  @IsInt()
  @Min(1)
  fileGroupId?: number | null;
  @IsOptional() @IsString() refNo?: string | null;
  @IsOptional() @IsString() refModule?: string | null;
  @IsOptional() @IsString() approvalId?: string | null;
  @IsIn(Object.values(DocStatus)) status!: string;
}

export class WorkPermitResponseDto {
  companyId!: string;
  plantId!: string;
  id!: string;
  equipmentId!: string;
  equipmentName!: string | null;
  title!: string;
  permitTypeCodes!: string;
  startAt!: string | null;
  endAt!: string | null;
  departmentId!: string;
  supervisorId!: string;
  workSummary!: string | null;
  riskFactors!: string | null;
  safetyMeasures!: string | null;
  jsonGeneral!: WorkPermitCheckItem[] | null;
  jsonFire!: WorkPermitCheckItem[] | null;
  jsonConfined!: WorkPermitCheckItem[] | null;
  jsonElectric!: WorkPermitCheckItem[] | null;
  jsonHighPlace!: WorkPermitCheckItem[] | null;
  jsonExcavation!: WorkPermitCheckItem[] | null;
  jsonHeavyLoad!: WorkPermitCheckItem[] | null;
  remarks!: string | null;
  fileGroupId!: number | null;
  refNo!: string | null;
  refModule!: string | null;
  approvalId!: string | null;
  status!: string;
  createdAt!: string;
  createdBy!: string;
}
