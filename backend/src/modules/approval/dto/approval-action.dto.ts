import { IsString, IsOptional, IsEnum } from 'class-validator';
import { ApprovalAction } from '../../../common/constants/approval.constants';

export class ApprovalActionDto {
  @IsOptional()
  @IsEnum(ApprovalAction)
  action?: ApprovalAction;

  @IsOptional()
  @IsString()
  comments?: string | null;
}
