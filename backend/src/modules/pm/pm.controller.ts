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
  SavePmRecordDto,
} from './dto/pm.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard, ModulePermission } from '../../common/guards/permission.guard';
import { AppModule } from '../../common/constants/module.constants';
import { getTenantContext } from '../../common/context/tenant.context';

@Controller('api/pm')
@UseGuards(JwtAuthGuard)
export class PmController {
  constructor(private readonly pmService: PmService) {}

  @Get('records')
  @UseGuards(PermissionGuard)
  @ModulePermission(AppModule.PM, 'R')
  async getPmRecords(
    @Query('searchType') searchType?: string,
    @Query('searchValue') searchValue?: string,
    @Query('showAll') showAll?: string,
    @Query('tempOnly') tempOnly?: string,
    @Query('plantId') plantId?: string,
  ): Promise<PmRecordResponseDto[]> {
    const { companyId, userId } = getTenantContext();
    return this.pmService.getPmRecords(companyId, userId, searchType, searchValue, showAll, tempOnly, plantId);
  }

  @Get('records/:id')
  @UseGuards(PermissionGuard)
  @ModulePermission(AppModule.PM, 'R')
  async getPmRecordDetails(
    @Param('id') id: string,
    @Query('plantId') plantId: string,
  ): Promise<PmRecordDetailsDto> {
    const { companyId, userId } = getTenantContext();
    return this.pmService.getPmRecordDetails(companyId, plantId, id, userId);
  }

  @Get('templates')
  @UseGuards(PermissionGuard)
  @ModulePermission(AppModule.PM, 'R')
  async getCheckTemplates(
    @Query('plantId') plantId: string,
    @Query('equipmentId') equipmentId: string,
    @Query('checkTypeCode') checkTypeCode: string,
  ): Promise<PmCheckTemplateResponseDto[]> {
    const { companyId, userId } = getTenantContext();
    return this.pmService.getCheckTemplates(companyId, plantId, equipmentId, checkTypeCode, userId);
  }

  @Post('records')
  @UseGuards(PermissionGuard)
  @ModulePermission(AppModule.PM, 'C')
  async createPmRecord(@Body() request: SavePmRecordDto): Promise<PmRecordResponseDto> {
    const { companyId, userId } = getTenantContext();
    return this.pmService.createPmRecord(companyId, request, userId);
  }

  @Put('records/:id')
  async updatePmRecord(
    @Param('id') id: string,
    @Body() request: SavePmRecordDto,
  ): Promise<PmRecordResponseDto> {
    const { companyId, userId } = getTenantContext();
    return this.pmService.updatePmRecord(companyId, id, request, userId);
  }

  @Delete('records/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePmRecord(
    @Param('id') id: string,
    @Query('plantId') plantId: string,
  ): Promise<void> {
    const { companyId, userId } = getTenantContext();
    await this.pmService.deletePmRecord(companyId, plantId, id, userId);
  }
}
