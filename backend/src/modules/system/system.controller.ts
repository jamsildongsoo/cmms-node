import { Controller, Get, Put, Body, Query, Param, UseGuards } from '@nestjs/common';
import { SystemService } from './system.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { getTenantContext } from '../../common/context/tenant.context';
import { PermissionGuard, SystemPermission } from '../../common/guards/permission.guard';

@Controller('api/system')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get('users')
  @SystemPermission()
  async getUsers(@Query('companyId') companyId?: string) {
    return this.systemService.getUsers(companyId);
  }

  @Get('login-history')
  @SystemPermission()
  async getLoginHistory(
    @Query('companyId') companyId?: string,
    @Query('userId') userId?: string,
  ) {
    return this.systemService.getLoginHistory(companyId, userId);
  }

  @Put('users/:companyId/:id/use-yn')
  @SystemPermission()
  async updateUserUseYn(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Body('useYn') useYn: string,
  ) {
    const ctx = getTenantContext();
    await this.systemService.updateUserUseYn(companyId, id, useYn, ctx.userId);
  }
}
