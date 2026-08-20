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
@UseGuards(JwtAuthGuard, PermissionGuard)
export class WorkPermitController {
  constructor(private readonly workPermitService: WorkPermitService) {}

  @Get()
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
  @ModulePermission(AppModule.WP, 'R')
  async getWorkPermitDetails(
    @Param('id') id: string,
    @Query('plantId') plantId: string,
  ): Promise<WorkPermitResponseDto> {
    const { companyId, userId } = getTenantContext();
    return this.workPermitService.getWorkPermitDetails(companyId, plantId, id, userId);
  }

  @Post()
  @ModulePermission(AppModule.WP, 'C')
  async saveWorkPermit(
    @Body() permit: SaveWorkPermitDto,
  ): Promise<WorkPermitResponseDto> {
    const { companyId, userId, roleId } = getTenantContext();
    return this.workPermitService.saveWorkPermit(companyId, permit, userId, 'create', roleId);
  }

  @Put(':id')
  @ModulePermission(AppModule.WP, 'U')
  async updateWorkPermit(
    @Param('id') id: string,
    @Body() permit: SaveWorkPermitDto,
  ): Promise<WorkPermitResponseDto> {
    const { companyId, userId, roleId } = getTenantContext();
    permit.id = id;
    return this.workPermitService.saveWorkPermit(companyId, permit, userId, 'update', roleId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ModulePermission(AppModule.WP, 'D')
  async deleteWorkPermit(
    @Param('id') id: string,
    @Query('plantId') plantId: string,
  ): Promise<void> {
    const { companyId, userId, roleId } = getTenantContext();
    await this.workPermitService.deleteWorkPermit(companyId, plantId, id, userId, roleId);
  }
}
