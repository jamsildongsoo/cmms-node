import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { TxReason, TxType } from '../../../common/constants/status.constants';

export class InventoryTxItemDto {
  @IsEnum(TxType)
  txTypeCode!: TxType;

  @IsOptional()
  @IsEnum(TxReason)
  txReasonCode?: TxReason;

  @IsString()
  warehouseId!: string;

  @IsString()
  inventoryId!: string;

  @IsOptional()
  @IsString()
  targetWarehouseId?: string;

  @Type(() => Number)
  @IsNumber()
  qty!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  unitPrice?: number;

  @IsOptional()
  @IsDateString()
  txDate?: string;

  @IsOptional() @IsString() docNo?: string;
  @IsOptional() @IsString() refNo?: string;
  @IsOptional() @IsString() refModule?: string;
  @IsOptional() @IsString() refLineNo?: string;
}

export class InventoryTxRequestDto {
  @ValidateNested({ each: true })
  @Type(() => InventoryTxItemDto)
  items!: InventoryTxItemDto[];
}

export class InventoryCancellationRequestDto {
  @IsString()
  originalDocumentId!: string;
}
