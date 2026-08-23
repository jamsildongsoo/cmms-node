import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
  IsString,
  ValidateNested,
} from 'class-validator';

export class PmRecordHeaderDto {
  @IsOptional() @IsString() id?: string | null;
  @IsString() plantId!: string;
  @IsOptional() @IsString() title?: string | null;
  @IsString() equipmentId!: string;
  @IsString() departmentId!: string;
  @IsString() checkTypeCode!: string;
  @IsOptional() @IsDateString() workDate?: string | null;
  @IsString() workerId!: string;
  @IsString() judgeCode!: string;
  @IsOptional() @IsString() remarks?: string | null;
  @IsOptional() @IsString() approvalId?: string | null;
  @IsOptional()
  @Transform(({ value }) => value === null || value === undefined || value === '' ? value : Number(value))
  @IsInt()
  @Min(1)
  fileGroupId?: number | null;
  @IsOptional() @IsString() status?: string;
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
  workDate!: string | null;
  workerId!: string;
  judgeCode!: string;
  remarks!: string | null;
  approvalId!: string | null;
  fileGroupId!: number | null;
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
