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
import { WorkPermitService } from './work-permit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard, Permission, PermissionSave } from '../../common/guards/permission.guard';
import { AppModule } from '../../common/constants/module.constants';
import { getTenantContext } from '../../common/context/tenant.context';

@Controller('api/work-permit')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class WorkPermitController {
  constructor(private readonly workPermitService: WorkPermitService) {}

  @Get()
  @Permission(AppModule.WP, 'R')
  async getWorkPermits(
    @Query('searchType') searchType?: string,
    @Query('searchValue') searchValue?: string,
  ): Promise<any[]> {
    const { companyId, userId } = getTenantContext();
    return this.workPermitService.getWorkPermitsByCompany(companyId, userId, searchType, searchValue);
  }

  @Get('details')
  @Permission(AppModule.WP, 'R')
  async getWorkPermitDetails(
    @Query('plantId') plantId: string,
    @Query('id') id: string,
  ): Promise<any> {
    const { companyId, userId } = getTenantContext();
    return this.workPermitService.getWorkPermitDetails(companyId, plantId, id, userId);
  }

  @Post()
  @PermissionSave(AppModule.WP, 'status')
  async saveWorkPermit(@Body() permit: any): Promise<any> {
    const { companyId, userId } = getTenantContext();
    return this.workPermitService.saveWorkPermit(companyId, permit, userId);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permission(AppModule.WP, 'D')
  async deleteWorkPermit(
    @Query('plantId') plantId: string,
    @Query('id') id: string,
  ): Promise<void> {
    const { companyId, userId } = getTenantContext();
    await this.workPermitService.deleteWorkPermit(companyId, plantId, id, userId);
  }
}
