import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InventoryTxService } from './inventory-tx.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard, ModuleAccess } from '../../common/guards/permission.guard';
import { AppModule } from '../../common/constants/module.constants';
import { getTenantContext } from '../../common/context/tenant.context';
import { InventoryTxRequestDto } from './dto/inventory-tx.dto';

@Controller('api/inventory-tx')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class InventoryTxController {
  constructor(private readonly inventoryTxService: InventoryTxService) {}

  @Get('status')
  @ModuleAccess(AppModule.STK)
  async getInventoryStatus(): Promise<any[]> {
    const { companyId, userId } = getTenantContext();
    return this.inventoryTxService.getStatusList(companyId, userId);
  }

  @Get('history')
  @ModuleAccess(AppModule.STK)
  async getInventoryHistory(): Promise<any[]> {
    const { companyId, userId } = getTenantContext();
    return this.inventoryTxService.getHistoryList(companyId, userId);
  }

  @Get('documents')
  @ModuleAccess(AppModule.STK)
  async getInventoryDocuments() {
    const { companyId, userId } = getTenantContext();
    return this.inventoryTxService.getDocumentList(companyId, userId);
  }

  @Get('documents/:id')
  @ModuleAccess(AppModule.STK)
  async getInventoryDocument(@Param('id') id: string) {
    const { companyId, userId } = getTenantContext();
    return this.inventoryTxService.getDocumentDetail(companyId, userId, id);
  }

  @Post()
  @ModuleAccess(AppModule.STK)
  async processTransactions(@Body() request: InventoryTxRequestDto): Promise<void> {
    await this.inventoryTxService.processTransactions({
      items: request.items.map((item) => ({
        ...item,
        qty: item.qty.toString(),
        unitPrice: item.unitPrice?.toString(),
      })),
    });
  }

  @Post('close')
  @ModuleAccess(AppModule.STK)
  async closeMonth(@Query('closingYm') closingYm: string): Promise<void> {
    const { userId } = getTenantContext();
    await this.inventoryTxService.closeMonth(closingYm, userId);
  }
}

