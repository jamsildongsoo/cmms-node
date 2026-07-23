import { IsNotEmpty, IsString, IsOptional, IsArray, ValidateNested, IsIn, IsEnum, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { ApprovalStepType } from '../../../common/constants/approval.constants';
import { DocStatus } from '../../../common/constants/status.constants';
import { LINKABLE_MODULES } from '../../../common/constants/module.constants';

class ApprovalDto {
  @IsOptional()
  @IsString()
  id?: string | null;

  @IsNotEmpty()
  @IsString()
  title!: string;

  @IsOptional()
  @IsObject()
  content?: Record<string, unknown> | null;

  @IsOptional()
  fileGroupId?: string | number | null;

  @IsOptional()
  @IsEnum(DocStatus)
  status?: string;
}

class ApprovalStepDto {
  @IsNotEmpty()
  @IsString()
  approverId!: string;

  @IsNotEmpty()
  @IsEnum(ApprovalStepType)
  approvalType!: string;
}

export class ApprovalSubmitDto {
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ApprovalDto)
  approval!: ApprovalDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApprovalStepDto)
  steps?: ApprovalStepDto[];

  @IsOptional()
  @IsString()
  refNo?: string | null;

  @IsOptional()
  @IsIn(LINKABLE_MODULES)
  refModule?: string | null;
}
