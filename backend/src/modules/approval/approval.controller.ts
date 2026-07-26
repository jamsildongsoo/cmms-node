import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApprovalService } from './approval.service';
import { ApprovalSubmitDto } from './dto/approval-submit.dto';
import { ApprovalActionDto } from './dto/approval-action.dto';
import {
  ApprovalDetailResponseDto,
  ApprovalResponseDto,
} from './dto/approval-response.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard, Permission } from '../../common/guards/permission.guard';
import { AppModule } from '../../common/constants/module.constants';
import { getTenantContext } from '../../common/context/tenant.context';

@Controller('api/approval')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ApprovalController {
  constructor(private readonly approvalService: ApprovalService) {}

  @Post('submit')
  @Permission(AppModule.APR, 'C')
  async submitApproval(@Body() request: ApprovalSubmitDto): Promise<ApprovalResponseDto> {
    const { companyId, userId } = getTenantContext();
    return this.approvalService.submitApproval(companyId, request, userId);
  }

  @Get('sent')
  @Permission(AppModule.APR, 'R')
  async getSentApprovals(): Promise<ApprovalResponseDto[]> {
    const { companyId, userId } = getTenantContext();
    return this.approvalService.getSentApprovals(companyId, userId);
  }

  @Get('pending')
  @Permission(AppModule.APR, 'R')
  async getPendingApprovals(): Promise<ApprovalResponseDto[]> {
    const { companyId, userId } = getTenantContext();
    return this.approvalService.getPendingApprovals(companyId, userId);
  }

  @Get('referenced')
  @Permission(AppModule.APR, 'R')
  async getReferencedApprovals(): Promise<ApprovalResponseDto[]> {
    const { companyId, userId } = getTenantContext();
    return this.approvalService.getReferencedApprovals(companyId, userId);
  }

  @Get('processed')
  @Permission(AppModule.APR, 'R')
  async getProcessedApprovals(): Promise<ApprovalResponseDto[]> {
    const { companyId, userId } = getTenantContext();
    return this.approvalService.getProcessedApprovals(companyId, userId);
  }

  @Get(':id/details')
  @Permission(AppModule.APR, 'R')
  async getApprovalDetails(@Param('id') id: string): Promise<ApprovalDetailResponseDto> {
    const { companyId } = getTenantContext();
    return this.approvalService.getApprovalDetails(companyId, id);
  }

  @Post(':id/action')
  @Permission(AppModule.APR, 'A')
  async processApprovalAction(
    @Param('id') id: string,
    @Body() request: ApprovalActionDto,
  ): Promise<void> {
    const { companyId, userId } = getTenantContext();
    await this.approvalService.processApprovalAction(companyId, id, request, userId);
  }
}
