import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { DocStatus } from '../../../common/constants/status.constants';

export class PmRecordHeaderDto {
  @IsOptional() @IsString() id?: string | null;
  @IsString() plantId!: string;
  @IsOptional() @IsString() title?: string | null;
  @IsString() equipmentId!: string;
  @IsString() departmentId!: string;
  @IsString() checkTypeCode!: string;
  @IsOptional() @IsIn(['P', 'R']) stepStage?: string | null;
  @IsOptional() @IsDateString() cycleFrom?: string | null;
  @IsOptional() @IsDateString() cycleEnd?: string | null;
  @IsOptional() @IsDateString() workDate?: string | null;
  @IsString() workerId!: string;
  @IsString() judgeCode!: string;
  @IsOptional() @IsString() remarks?: string | null;
  @IsOptional() @IsString() certNumber?: string | null;
  @IsOptional() @IsDateString() certExpireDate?: string | null;
  @IsOptional() @IsString() certAgency?: string | null;
  @IsOptional() @IsString() approvalId?: string | null;
  @IsOptional() @IsString() refNo?: string | null;
  @IsOptional() @IsString() refModule?: string | null;
  @IsIn(Object.values(DocStatus)) status!: string;
}

export class PmRecordItemDto {
  @IsInt() itemNo!: number;
  @IsString() checkName!: string;
  @IsOptional() @IsString() checkMethod?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber() minValue?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() maxValue?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() baseValue?: number | null;
  @IsOptional() @IsString() unit?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber() checkValue?: number | null;
}

export class SavePmRecordDto {
  @ValidateNested()
  @Type(() => PmRecordHeaderDto)
  pmRecord!: PmRecordHeaderDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PmRecordItemDto)
  checkItems!: PmRecordItemDto[];
}

export class PmRecordResponseDto {
  companyId!: string;
  plantId!: string;
  id!: string;
  title!: string | null;
  equipmentId!: string;
  equipmentName!: string | null;
  departmentId!: string;
  checkTypeCode!: string;
  stepStage!: string;
  cycleFrom!: string | null;
  cycleEnd!: string | null;
  closeYn!: string | null;
  workDate!: string | null;
  workerId!: string;
  judgeCode!: string;
  remarks!: string | null;
  certNumber!: string | null;
  certExpireDate!: string | null;
  certAgency!: string | null;
  approvalId!: string | null;
  refNo!: string | null;
  refModule!: string | null;
  status!: string;
  createdAt!: string;
  createdBy!: string;
}

export class PmRecordDetailsDto {
  pmRecord!: PmRecordResponseDto;
  checkItems!: PmRecordItemResponseDto[];
}

export class PmRecordItemResponseDto {
  itemNo!: number;
  checkName!: string;
  checkMethod!: string | null;
  minValue!: string | null;
  maxValue!: string | null;
  baseValue!: string | null;
  unit!: string | null;
  checkValue!: string | null;
}

export class PmCheckTemplateResponseDto {
  itemNo!: number;
  checkName!: string;
  checkMethod!: string | null;
  minValue!: string | null;
  maxValue!: string | null;
  baseValue!: string | null;
  unit!: string | null;
}

export class PmScheduleResponseDto {
  equipmentId!: string;
  equipmentName!: string;
  plantId!: string;
  checkTypeCode!: string;
  cycleVal!: number;
  cycleUnit!: string;
  lastCheckDate!: string | null;
  nextCheckDate!: string | null;
}
