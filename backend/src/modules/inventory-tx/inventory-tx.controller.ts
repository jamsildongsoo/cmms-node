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
import { PermissionGuard, ModulePermission } from '../../common/guards/permission.guard';
import { AppModule } from '../../common/constants/module.constants';
import { getTenantContext } from '../../common/context/tenant.context';
import { InventoryCancellationRequestDto, InventoryTxRequestDto } from './dto/inventory-tx.dto';
import { InventoryStatus } from '../../entities/inventory-status.entity';
import { InventoryHistory } from '../../entities/inventory-history.entity';

@Controller('api/inventory-tx')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class InventoryTxController {
  constructor(private readonly inventoryTxService: InventoryTxService) {}

  /** 재고현황을 조회한다. */
  @Get('status')
  @ModulePermission(AppModule.STK, 'R')
  async getInventoryStatus(): Promise<InventoryStatus[]> {
    const { companyId, userId } = getTenantContext();
    return this.inventoryTxService.getStatusList(companyId, userId);
  }

  /** 재고 이력을 조회한다. */
  @Get('history')
  @ModulePermission(AppModule.STK, 'R')
  async getInventoryHistory(): Promise<InventoryHistory[]> {
    const { companyId, userId } = getTenantContext();
    return this.inventoryTxService.getHistoryList(companyId, userId);
  }

  /** 재고 전표와 전표 item을 조회한다. */
  @Get('documents')
  @ModulePermission(AppModule.STK, 'R')
  async getInventoryDocuments() {
    const { companyId, userId } = getTenantContext();
    return this.inventoryTxService.getDocumentList(companyId, userId);
  }

  /** 재고 전표 상세를 조회한다. */
  @Get('documents/:id')
  @ModulePermission(AppModule.STK, 'R')
  async getInventoryDocument(@Param('id') id: string) {
    const { companyId, userId } = getTenantContext();
    return this.inventoryTxService.getDocumentDetail(companyId, userId, id);
  }

  /** 입고·출고·이동·조정 거래를 생성한다. STK에는 U/D API가 없다. */
  @Post()
  @ModulePermission(AppModule.STK, 'C')
  async processTransactions(@Body() request: InventoryTxRequestDto): Promise<void> {
    await this.inventoryTxService.processTransactions({
      items: request.items.map((item) => ({
        ...item,
        qty: item.qty.toString(),
        unitPrice: item.unitPrice?.toString(),
      })),
    });
  }

  @Post('cancellations')
  @ModulePermission(AppModule.STK, 'C')
  async cancelDocument(@Body() request: InventoryCancellationRequestDto): Promise<{ documentId: string }> {
    const { companyId, userId } = getTenantContext();
    return { documentId: await this.inventoryTxService.cancelDocument(companyId, userId, request.originalDocumentId) };
  }

  /** 월 재고를 마감한다. 마감 후 해당 월 거래는 생성할 수 없다. */
  @Post('close')
  @ModulePermission(AppModule.STK, 'U')
  async closeMonth(@Query('closingYm') closingYm: string): Promise<void> {
    const { userId } = getTenantContext();
    await this.inventoryTxService.closeMonth(closingYm, userId);
  }
}
