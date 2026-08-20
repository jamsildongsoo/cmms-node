import { Controller, Get, Post, Put, Body, Query, Param, UseGuards } from '@nestjs/common';
import { LoginHistoryResponse, SystemService, SystemUserResponse } from './system.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { getTenantContext } from '../../common/context/tenant.context';
import { SystemGuard } from '../../common/guards/system.guard';
import { MdmService } from '../mdm/mdm.service';
import { Company } from '../../entities/company.entity';
import { CreateCompanyDto, CreateCompanyResponseDto } from '../mdm/dto/create-company.dto';

@Controller('api/system')
@UseGuards(JwtAuthGuard, SystemGuard)
export class SystemController {
  constructor(
    private readonly systemService: SystemService,
    private readonly mdmService: MdmService,
  ) {}

  @Get('companies')
  async getCompanies(): Promise<Company[]> {
    return this.mdmService.getCompanies();
  }

  @Post('companies')
  async createCompany(@Body() body: CreateCompanyDto): Promise<CreateCompanyResponseDto> {
    const { userId } = getTenantContext();
    return this.mdmService.createCompany(body, userId);
  }

  @Get('users')
  async getUsers(@Query('companyId') companyId?: string): Promise<SystemUserResponse[]> {
    return this.systemService.getUsers(companyId);
  }

  @Get('login-history')
  async getLoginHistory(
    @Query('companyId') companyId?: string,
    @Query('userId') userId?: string,
  ): Promise<LoginHistoryResponse[]> {
    return this.systemService.getLoginHistory(companyId, userId);
  }

  @Put('users/:companyId/:id/use-yn')
  async updateUserUseYn(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Body('useYn') useYn: string,
  ) {
    const ctx = getTenantContext();
    await this.systemService.updateUserUseYn(companyId, id, useYn, ctx.userId);
  }
}
