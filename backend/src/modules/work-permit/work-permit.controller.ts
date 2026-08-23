import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WorkPermitService } from './work-permit.service';
import {
  SaveWorkPermitDto,
  WorkPermitResponseDto,
} from './dto/work-permit.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard, ModulePermission } from '../../common/guards/permission.guard';
import { AppModule } from '../../common/constants/module.constants';
import { getTenantContext } from '../../common/context/tenant.context';

@Controller('api/work-permit')
@UseGuards(JwtAuthGuard)
export class WorkPermitController {
  constructor(private readonly workPermitService: WorkPermitService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @ModulePermission(AppModule.WP, 'R')
  async getWorkPermits(
    @Query('searchType') searchType?: string,
    @Query('searchValue') searchValue?: string,
    @Query('tempOnly') tempOnly?: string,
    @Query('plantId') plantId?: string,
  ): Promise<WorkPermitResponseDto[]> {
    const { companyId, userId } = getTenantContext();
    return this.workPermitService.getWorkPermitsByCompany(companyId, userId, searchType, searchValue, tempOnly, plantId);
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @ModulePermission(AppModule.WP, 'R')
  async getWorkPermitDetails(
    @Param('id') id: string,
    @Query('plantId') plantId: string,
  ): Promise<WorkPermitResponseDto> {
    const { companyId, userId } = getTenantContext();
    return this.workPermitService.getWorkPermitDetails(companyId, plantId, id, userId);
  }

  @Post()
  @UseGuards(PermissionGuard)
  @ModulePermission(AppModule.WP, 'C')
  async createWorkPermit(
    @Body() permit: SaveWorkPermitDto,
  ): Promise<WorkPermitResponseDto> {
    const { companyId, userId } = getTenantContext();
    return this.workPermitService.createWorkPermit(companyId, permit, userId);
  }

  @Put(':id')
  async updateWorkPermit(
    @Param('id') id: string,
    @Body() permit: SaveWorkPermitDto,
  ): Promise<WorkPermitResponseDto> {
    const { companyId, userId } = getTenantContext();
    return this.workPermitService.updateWorkPermit(companyId, id, permit, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteWorkPermit(
    @Param('id') id: string,
    @Query('plantId') plantId: string,
  ): Promise<void> {
    const { companyId, userId } = getTenantContext();
    await this.workPermitService.deleteWorkPermit(companyId, plantId, id, userId);
  }
}
