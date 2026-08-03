import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
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
import { PermissionGuard, Permission, WorkflowPermission } from '../../common/guards/permission.guard';
import { AppModule } from '../../common/constants/module.constants';
import { getTenantContext } from '../../common/context/tenant.context';
import { ApprovalAction } from '../../common/constants/approval.constants';

@Controller('api/approval')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ApprovalController {
  constructor(private readonly approvalService: ApprovalService) {}

  @Post()
  @Permission(AppModule.APR, 'C')
  async createApproval(@Body() request: ApprovalSubmitDto): Promise<ApprovalResponseDto> {
    const { companyId, userId } = getTenantContext();
    return this.approvalService.createApproval(companyId, request, userId);
  }

  @Put(':id')
  @WorkflowPermission()
  async updateApproval(
    @Param('id') id: string,
    @Body() request: ApprovalSubmitDto,
  ): Promise<ApprovalResponseDto> {
    const { companyId, userId, roleId } = getTenantContext();
    return this.approvalService.updateApproval(companyId, id, request, userId, roleId);
  }

  @Delete(':id')
  @WorkflowPermission()
  async deleteApproval(@Param('id') id: string): Promise<void> {
    const { companyId, userId, roleId } = getTenantContext();
    await this.approvalService.deleteApproval(companyId, id, userId, roleId);
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

  @Get(':id')
  @Permission(AppModule.APR, 'R')
  async getApprovalDetails(@Param('id') id: string): Promise<ApprovalDetailResponseDto> {
    const { companyId, userId } = getTenantContext();
    return this.approvalService.getApprovalDetails(companyId, id, userId);
  }

  @Post(':id/actions/:action')
  // 결재 권한은 역할의 A(직접확정)가 아니라 현재 결재선의 담당자 여부로 판단한다.
  @WorkflowPermission()
  async processApprovalAction(
    @Param('id') id: string,
    @Param('action') action: ApprovalAction,
    @Body() request: ApprovalActionDto,
  ): Promise<void> {
    const { companyId, userId } = getTenantContext();
    request.action = action;
    await this.approvalService.processApprovalAction(companyId, id, request, userId);
  }
}
