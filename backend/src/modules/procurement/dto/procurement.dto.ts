import { Type, Transform } from 'class-transformer';
import {
  IsBoolean,
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

export class PlaceOrderDto {
  @IsOptional()
  @IsDateString()
  orderDate?: string;

  @IsOptional()
  @IsDateString()
  etaDate?: string;
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

export class StartShippingDto {
  @IsOptional()
  @IsDateString()
  shipStartDate?: string;
}

export class ReceiveLineDto {
  @IsInt()
  @Min(1)
  itemNo!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  qty!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  unitPrice!: number;
}

export class ReceiveProcurementDto {
  @IsNotEmpty()
  @IsString()
  warehouseId!: string;

  @IsOptional()
  @IsDateString()
  txDate?: string;

  @IsOptional()
  @IsBoolean()
  close?: boolean;

  @ValidateNested({ each: true })
  @Type(() => ReceiveLineDto)
  lines!: ReceiveLineDto[];
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

export class TransferProcurementLineDto {
  @IsInt()
  @Min(1)
  docItemNo!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  qty!: number;
}

export class TransferProcurementDto {
  @IsNotEmpty()
  @IsString()
  sourceWarehouseId!: string;

  @IsNotEmpty()
  @IsString()
  targetWarehouseId!: string;

  @IsOptional()
  @IsDateString()
  txDate?: string;

  @ValidateNested({ each: true })
  @Type(() => TransferProcurementLineDto)
  lines!: TransferProcurementLineDto[];
}

export class PrTransferLineDto {
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

export class CreatePrTransferDto {
  @IsNotEmpty()
  @IsString()
  sourceWarehouseId!: string;

  @IsNotEmpty()
  @IsString()
  targetWarehouseId!: string;

  @IsOptional()
  @IsDateString()
  txDate?: string;

  @ValidateNested({ each: true })
  @Type(() => PrTransferLineDto)
  lines!: PrTransferLineDto[];
}
