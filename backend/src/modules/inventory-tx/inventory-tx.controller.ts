import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InventoryTxService, InventoryTxRequest } from './inventory-tx.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard, Permission } from '../../common/guards/permission.guard';
import { AppModule } from '../../common/constants/module.constants';
import { getTenantContext } from '../../common/context/tenant.context';

@Controller('api/inventory-tx')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class InventoryTxController {
  constructor(private readonly inventoryTxService: InventoryTxService) {}

  @Get('status')
  @Permission(AppModule.STK, 'R')
  async getInventoryStatus(): Promise<any[]> {
    const { companyId } = getTenantContext();
    return this.inventoryTxService.getStatusList(companyId);
  }

  @Get('history')
  @Permission(AppModule.STK, 'R')
  async getInventoryHistory(): Promise<any[]> {
    const { companyId } = getTenantContext();
    return this.inventoryTxService.getHistoryList(companyId);
  }

  @Post()
  @Permission(AppModule.STK, 'C')
  async processTransactions(@Body() request: InventoryTxRequest): Promise<void> {
    await this.inventoryTxService.processTransactions(request);
  }

  @Post('close')
  @Permission(AppModule.STK, 'C')
  async closeMonth(@Query('closingYm') closingYm: string): Promise<void> {
    const { userId } = getTenantContext();
    await this.inventoryTxService.closeMonth(closingYm, userId);
  }
}
