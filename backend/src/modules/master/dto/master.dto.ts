import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class EquipmentCheckCycleInputDto {
  @IsString()
  checkTypeCode!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cycleVal!: number | null;

  @IsString()
  cycleUnit!: string;

  @IsOptional()
  @IsDateString()
  lastCheckDate!: string | null;

  @IsOptional()
  @IsDateString()
  nextCheckDate!: string | null;
}

export class EquipmentInputDto {
  @IsString()
  id!: string;

  @IsString()
  plantId!: string;

  @IsString()
  name!: string;

  @IsOptional() @IsString() location?: string | null;
  @IsOptional() @IsString() eqTypeCode?: string | null;
  @IsOptional() @IsDateString() installDate?: string | null;
  @IsOptional() @IsIn(['Y', 'N']) workPermitYn?: string;
  @IsOptional() @IsIn(['Y', 'N']) pmTargetYn?: string;
  @IsOptional() @IsString() makerName?: string | null;
  @IsOptional() @IsString() spec?: string | null;
  @IsOptional() @IsString() model?: string | null;
  @IsOptional() @IsString() serialNumber?: string | null;
  @IsOptional() @IsString() remarks?: string | null;
}

export class EquipmentSaveRequestDto {
  @ValidateNested()
  @Type(() => EquipmentInputDto)
  equipment!: EquipmentInputDto;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => EquipmentCheckCycleInputDto)
  checkCycles?: EquipmentCheckCycleInputDto[];
}

export class InventoryUpsertDto {
  @IsOptional() @IsString() id?: string;
  @IsString() name!: string;
  @IsOptional() @IsString() invTypeCode?: string | null;
  @IsOptional() @IsString() unit?: string | null;
  @IsOptional() @IsString() makerName?: string | null;
  @IsOptional() @IsString() spec?: string | null;
  @IsOptional() @IsString() model?: string | null;
  @IsOptional() @IsString() serialNumber?: string | null;
  @Type(() => Number) @IsNumber() @Min(0) safetyQty!: number;
  @Type(() => Number) @IsNumber() @Min(0) reorderQty!: number;
  @Type(() => Number) @IsInt() @Min(0) leadTimeDays!: number;
  @IsOptional() @IsString() remarks?: string | null;
}
