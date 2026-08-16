import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
  IsString,
  ValidateNested,
} from 'class-validator';
import { DocStatus } from '../../../common/constants/status.constants';

export class WorkOrderHeaderDto {
  @IsOptional() @IsString() id?: string | null;
  @IsString() plantId!: string;
  @IsString() equipmentId!: string;
  @IsString() title!: string;
  @IsIn(['P', 'R']) stepStage!: string;
  @IsString() woTypeCode!: string;
  @IsString() departmentId!: string;
  @IsOptional() @IsString() workerId?: string | null;
  @IsOptional() @IsDateString() workDate?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber() cost?: number | null;
  @IsOptional() @Type(() => Number) @IsNumber() manHours?: number | null;
  @IsOptional() @IsString() manHoursUnit?: string | null;
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

export class WorkOrderItemDto {
  @IsInt() itemNo!: number;
  @IsString() workName!: string;
  @IsOptional() @IsString() workMethod?: string | null;
  @IsOptional() @IsString() workResult?: string | null;
}

export class SaveWorkOrderDto {
  @ValidateNested()
  @Type(() => WorkOrderHeaderDto)
  workOrder!: WorkOrderHeaderDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkOrderItemDto)
  workItems!: WorkOrderItemDto[];
}

export class WorkOrderResponseDto {
  companyId!: string;
  plantId!: string;
  id!: string;
  equipmentId!: string;
  equipmentName!: string | null;
  title!: string;
  stepStage!: string;
  woTypeCode!: string;
  departmentId!: string;
  workerId!: string | null;
  workDate!: string | null;
  cost!: number;
  manHours!: number;
  manHoursUnit!: string;
  remarks!: string | null;
  fileGroupId!: number | null;
  refNo!: string | null;
  refModule!: string | null;
  approvalId!: string | null;
  status!: string;
  createdAt!: string;
  createdBy!: string;
}

export class WorkOrderItemResponseDto {
  itemNo!: number;
  workName!: string;
  workMethod!: string | null;
  workResult!: string | null;
}

export class WorkOrderDetailsDto {
  workOrder!: WorkOrderResponseDto;
  workItems!: WorkOrderItemResponseDto[];
}
