import { Type, Transform } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

const toNumber = ({ value }: { value: unknown }): unknown =>
  value === null || value === undefined || value === '' ? value : Number(value);

export class ProcurementItemDto {
  @IsInt()
  @Min(1)
  itemNo!: number;

  @IsNotEmpty()
  @IsString()
  inventoryId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  qty!: number;

  @IsOptional()
  @IsString()
  unit?: string | null;

  @IsOptional()
  @IsString()
  remarks?: string | null;
}

export class ProcurementHeaderDto {
  @IsOptional()
  @IsString()
  id?: string | null;

  @IsOptional()
  @IsString()
  plantId?: string | null;

  @IsOptional()
  @IsString()
  departmentId?: string | null;

  @IsNotEmpty()
  @IsString()
  warehouseId!: string;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  fileGroupId?: number | null;

  @IsOptional()
  @IsDateString()
  requestDate?: string;

  @IsOptional()
  @IsString()
  requestType?: string | null;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  remarks?: string | null;

  @IsOptional()
  @IsIn(['T', 'P'])
  status?: string;
}

export class SaveProcurementDto {
  @ValidateNested()
  @Type(() => ProcurementHeaderDto)
  header!: ProcurementHeaderDto;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ProcurementItemDto)
  items?: ProcurementItemDto[];
}

export class IntegratedOrderLineDto {
  @IsNotEmpty()
  @IsString()
  prId!: string;

  @IsInt()
  @Min(1)
  prItemNo!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  qty!: number;
}

export class CreateIntegratedOrderDto {
  @IsOptional()
  @IsDateString()
  orderDate?: string;

  @IsOptional()
  @IsDateString()
  etaDate?: string;

  @ValidateNested({ each: true })
  @Type(() => IntegratedOrderLineDto)
  lines!: IntegratedOrderLineDto[];
}

/** PUR 연결 없이 POR 자체 품목으로 임시 구매오더를 생성한다. */
export class CreateStandaloneOrderDto {
  @IsNotEmpty()
  @IsString()
  plantId!: string;

  @IsOptional()
  @IsString()
  warehouseId?: string | null;

  @IsOptional()
  @IsDateString()
  orderDate?: string;

  @IsOptional()
  @IsDateString()
  etaDate?: string;

  @ValidateNested({ each: true })
  @IsArray()
  @ArrayNotEmpty()
  @Type(() => ProcurementItemDto)
  items!: ProcurementItemDto[];
}

/** 임시저장 상태의 POR를 수정한다. 배부 기반 POR의 품목은 allocation API에서 관리한다. */
export class UpdatePurchaseOrderDto {
  @IsNotEmpty()
  @IsString()
  plantId!: string;

  @IsOptional()
  @IsString()
  warehouseId?: string | null;

  @IsOptional()
  @IsDateString()
  orderDate?: string;

  @IsOptional()
  @IsDateString()
  etaDate?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @IsArray()
  @Type(() => ProcurementItemDto)
  items?: ProcurementItemDto[];
}

export class ProcurementAllocationLineDto {
  @IsInt()
  @Min(1)
  docItemNo!: number;

  @IsNotEmpty()
  @IsString()
  prId!: string;

  @IsInt()
  @Min(1)
  prItemNo!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  allocatedQty!: number;
}

export class SaveProcurementAllocationsDto {
  @ValidateNested({ each: true })
  @Type(() => ProcurementAllocationLineDto)
  lines!: ProcurementAllocationLineDto[];
}
