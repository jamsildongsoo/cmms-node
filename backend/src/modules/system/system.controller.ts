import { Controller, Get, Put, Body, Query, Param, UseGuards, ForbiddenException } from '@nestjs/common';
import { SystemService } from './system.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { getTenantContext } from '../../common/context/tenant.context';

@Controller('api/system')
@UseGuards(JwtAuthGuard)
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  private async validateSystemAdmin(companyId: string, roleId: string, userId: string): Promise<void> {
    if (companyId !== 'SYSTEM' || roleId?.toUpperCase() !== 'SYSTEM') {
      throw new ForbiddenException('SYSTEM 권한이 필요합니다.');
    }
    const isValid = await this.systemService.validateSystemAdminUser(userId);
    if (!isValid) {
      throw new ForbiddenException('유효하지 않은 SYSTEM 사용자입니다.');
    }
  }

  @Get('users')
  async getUsers(@Query('companyId') companyId?: string) {
    const ctx = getTenantContext();
    await this.validateSystemAdmin(ctx.companyId, ctx.roleId || '', ctx.userId);
    return this.systemService.getUsers(companyId);
  }

  @Get('login-history')
  async getLoginHistory(
    @Query('companyId') companyId?: string,
    @Query('userId') userId?: string,
  ) {
    const ctx = getTenantContext();
    await this.validateSystemAdmin(ctx.companyId, ctx.roleId || '', ctx.userId);
    return this.systemService.getLoginHistory(companyId, userId);
  }

  @Put('users/:companyId/:id/use-yn')
  async updateUserUseYn(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Body('useYn') useYn: string,
  ) {
    const ctx = getTenantContext();
    await this.validateSystemAdmin(ctx.companyId, ctx.roleId || '', ctx.userId);
    await this.systemService.updateUserUseYn(companyId, id, useYn, ctx.userId);
  }
}
