import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { PmService } from './pm.service';
import {
  PmCheckTemplateResponseDto,
  PmRecordDetailsDto,
  PmRecordResponseDto,
  PmScheduleResponseDto,
  SavePmRecordDto,
} from './dto/pm.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard, ModulePermission } from '../../common/guards/permission.guard';
import { AppModule } from '../../common/constants/module.constants';
import { getTenantContext } from '../../common/context/tenant.context';

@Controller('api/pm')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PmController {
  constructor(private readonly pmService: PmService) {}

  @Get('schedules')
  @ModulePermission(AppModule.PM, 'R')
  async getPmSchedules(
    @Query('targetDate') targetDateStr?: string,
  ): Promise<PmScheduleResponseDto[]> {
    const { companyId } = getTenantContext();
    const date = targetDateStr ? new Date(targetDateStr) : new Date();
    return this.pmService.getPmSchedules(companyId, date);
  }

  @Get('records')
  @ModulePermission(AppModule.PM, 'R')
  async getPmRecords(
    @Query('stepStage') stepStage?: string,
    @Query('searchType') searchType?: string,
    @Query('searchValue') searchValue?: string,
    @Query('showAll') showAll?: string,
    @Query('tempOnly') tempOnly?: string,
    @Query('plantId') plantId?: string,
  ): Promise<PmRecordResponseDto[]> {
    const { companyId, userId } = getTenantContext();
    return this.pmService.getPmRecords(companyId, userId, stepStage, searchType, searchValue, showAll, tempOnly, plantId);
  }

  @Get('records/:id')
  @ModulePermission(AppModule.PM, 'R')
  async getPmRecordDetails(
    @Param('id') id: string,
    @Query('plantId') plantId: string,
  ): Promise<PmRecordDetailsDto> {
    const { companyId, userId } = getTenantContext();
    return this.pmService.getPmRecordDetails(companyId, plantId, id, userId);
  }

  @Get('templates')
  @ModulePermission(AppModule.PM, 'R')
  async getCheckTemplates(
    @Query('plantId') plantId: string,
    @Query('checkTypeCode') checkTypeCode: string,
  ): Promise<PmCheckTemplateResponseDto[]> {
    const { companyId, userId } = getTenantContext();
    return this.pmService.getCheckTemplates(companyId, plantId, checkTypeCode, userId);
  }

  @Post('records')
  @ModulePermission(AppModule.PM, 'C')
  async savePmRecord(@Body() request: SavePmRecordDto): Promise<PmRecordResponseDto> {
    const { companyId, userId, roleId } = getTenantContext();
    return this.pmService.savePmRecord(companyId, request, userId, 'create', roleId);
  }

  @Put('records/:id')
  @ModulePermission(AppModule.PM, 'U')
  async updatePmRecord(
    @Param('id') id: string,
    @Body() request: SavePmRecordDto,
  ): Promise<PmRecordResponseDto> {
    const { companyId, userId, roleId } = getTenantContext();
    request.pmRecord.id = id;
    return this.pmService.savePmRecord(companyId, request, userId, 'update', roleId);
  }

  @Post('plans/:id/actions/close')
  @ModulePermission(AppModule.PM, 'U')
  async closePmPlan(
    @Param('id') id: string,
    @Query('plantId') plantId: string,
  ): Promise<void> {
    const { companyId, userId } = getTenantContext();
    await this.pmService.closePmPlan(companyId, plantId, id, userId);
  }

  @Delete('records/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ModulePermission(AppModule.PM, 'D')
  async deletePmRecord(
    @Param('id') id: string,
    @Query('plantId') plantId: string,
  ): Promise<void> {
    const { companyId, userId, roleId } = getTenantContext();
    await this.pmService.deletePmRecord(companyId, plantId, id, userId, roleId);
  }
}
