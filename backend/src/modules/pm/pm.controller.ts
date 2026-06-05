import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PmService, PmSaveRequest, PmScheduleResponse } from './pm.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard, Permission } from '../../common/guards/permission.guard';
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
  async getPmRecords(): Promise<any[]> {
    const { companyId, userId } = getTenantContext();
    return this.pmService.getPmRecordsByCompany(companyId, userId);
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

  @Get('records/initial-items')
  @Permission(AppModule.PM, 'R')
  async getInitialCheckItems(
    @Query('plantId') plantId: string,
    @Query('equipmentId') equipmentId: string,
  ): Promise<any[]> {
    const { companyId, userId } = getTenantContext();
    return this.pmService.getInitialCheckItems(companyId, plantId, equipmentId, userId);
  }

  @Post('records')
  @Permission(AppModule.PM, 'C')
  async savePmRecord(@Body() request: PmSaveRequest): Promise<any> {
    const { companyId, userId } = getTenantContext();
    return this.pmService.savePmRecord(companyId, request, userId);
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
