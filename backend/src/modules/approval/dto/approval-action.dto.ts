import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { ApprovalAction } from '../../../common/constants/approval.constants';

export class ApprovalActionDto {
  @IsNotEmpty()
  @IsEnum(ApprovalAction)
  action!: ApprovalAction;

  @IsOptional()
  @IsString()
  comments?: string | null;
}
