import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  PmService,
  PmSaveRequest,
  PmScheduleResponse,
} from './pm.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard, Permission, PermissionSave } from '../../common/guards/permission.guard';
import { AppModule } from '../../common/constants/module.constants';
import { getTenantContext } from '../../common/context/tenant.context';

@Controller('api/pm')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PmController {
  constructor(private readonly pmService: PmService) {}

  @Get('schedules')
  @Permission(AppModule.PM, 'R')
  async getPmSchedules(
    @Query('targetDate') targetDateStr?: string,
  ): Promise<PmScheduleResponse[]> {
    const { companyId } = getTenantContext();
    const date = targetDateStr ? new Date(targetDateStr) : new Date();
    return this.pmService.getPmSchedules(companyId, date);
  }

  @Get('records')
  @Permission(AppModule.PM, 'R')
  async getPmRecords(
    @Query('stepStage') stepStage?: string,
    @Query('searchType') searchType?: string,
    @Query('searchValue') searchValue?: string,
    @Query('showAll') showAll?: string,
  ): Promise<any[]> {
    const { companyId, userId } = getTenantContext();
    return this.pmService.getPmRecords(companyId, userId, stepStage, searchType, searchValue, showAll);
  }

  @Get('records/details')
  @Permission(AppModule.PM, 'R')
  async getPmRecordDetails(
    @Query('plantId') plantId: string,
    @Query('id') id: string,
  ): Promise<PmSaveRequest> {
    const { companyId, userId } = getTenantContext();
    return this.pmService.getPmRecordDetails(companyId, plantId, id, userId);
  }

  @Get('templates')
  @Permission(AppModule.PM, 'R')
  async getCheckTemplates(
    @Query('plantId') plantId: string,
    @Query('checkTypeCode') checkTypeCode: string,
  ): Promise<any[]> {
    const { companyId, userId } = getTenantContext();
    return this.pmService.getCheckTemplates(companyId, plantId, checkTypeCode, userId);
  }

  @Post('records')
  @PermissionSave(AppModule.PM, 'pmRecord.status')
  async savePmRecord(@Body() request: PmSaveRequest): Promise<any> {
    const { companyId, userId } = getTenantContext();
    return this.pmService.savePmRecord(companyId, request, userId);
  }

  @Patch('plans/:id/close')
  @Permission(AppModule.PM, 'U')
  async closePmPlan(
    @Param('id') id: string,
    @Query('plantId') plantId: string,
  ): Promise<void> {
    const { companyId, userId } = getTenantContext();
    await this.pmService.closePmPlan(companyId, plantId, id, userId);
  }

  @Delete('records')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permission(AppModule.PM, 'D')
  async deletePmRecord(
    @Query('plantId') plantId: string,
    @Query('id') id: string,
  ): Promise<void> {
    const { companyId, userId } = getTenantContext();
    await this.pmService.deletePmRecord(companyId, plantId, id, userId);
  }
}
