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
import {
  ProcurementService,
  RequestDetail,
  PurchaseRequestResponse,
  PurchaseOrderAllocationResponse,
} from './procurement.service';
import {
  PlaceOrderDto,
  CreateIntegratedOrderDto,
  SaveProcurementAllocationsDto,
  TransferProcurementDto,
  CreatePrTransferDto,
  ReceiveProcurementDto,
  SaveProcurementDto,
  StartShippingDto,
} from './dto/procurement.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard, ModuleAccess, ModulePermission } from '../../common/guards/permission.guard';
import { AppModule } from '../../common/constants/module.constants';
import { getTenantContext } from '../../common/context/tenant.context';

@Controller('api/procurement')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ProcurementController {
  constructor(private readonly procurementService: ProcurementService) {}

  @Get('requests')
  @ModuleAccess(AppModule.PUR)
  async getRequests(
    @Query('plantId') plantId?: string,
    @Query('receivable') receivable?: string,
    @Query('tempOnly') tempOnly?: string,
  ): Promise<PurchaseRequestResponse[]> {
    const { companyId, userId, roleId } = getTenantContext();
    return this.procurementService.getPurchaseRequests(
      companyId,
      userId,
      roleId,
      plantId,
      receivable === 'Y',
      tempOnly === 'Y',
    );
  }

  @Get('receipts/request/:id')
  @ModuleAccess(AppModule.STK)
  async getReceivableRequest(@Param('id') id: string): Promise<RequestDetail> {
    const { companyId, userId } = getTenantContext();
    return this.procurementService.getReceivableRequest(companyId, id, userId);
  }

  @Get('receipts/requests')
  @ModuleAccess(AppModule.STK)
  async getReceivableRequests(): Promise<any[]> {
    const { companyId, userId } = getTenantContext();
    return this.procurementService.getReceivableRequests(companyId, userId);
  }

  @Get('requests/:id')
  @ModuleAccess(AppModule.PUR)
  async getRequest(
    @Param('id') id: string,
    @Query('plantId') plantId?: string,
  ): Promise<RequestDetail> {
    const { companyId, userId } = getTenantContext();
    return this.procurementService.getPurchaseRequestDetail(companyId, id, userId, plantId);
  }

  @Post('requests')
  @ModuleAccess(AppModule.PUR)
  async saveRequest(@Body() request: SaveProcurementDto): Promise<any> {
    const { companyId, userId } = getTenantContext();
    return this.procurementService.createOrUpdate(companyId, {
      ...request,
      items: request.items?.map((item) => ({ ...item, qty: item.qty.toString() })),
    }, userId, 'create');
  }

  @Put('requests/:id')
  @ModulePermission(AppModule.PUR, 'U')
  async updateRequest(
    @Param('id') id: string,
    @Body() request: SaveProcurementDto,
  ): Promise<any> {
    const { companyId, userId, roleId } = getTenantContext();
    request.header.id = id;
    return this.procurementService.createOrUpdate(companyId, {
      ...request,
      items: request.items?.map((item) => ({ ...item, qty: item.qty.toString() })),
    }, userId, 'update', roleId);
  }

  @Post('requests/:id/actions/confirm')
  @ModulePermission(AppModule.PUR, 'U')
  async confirmRequest(
    @Param('id') id: string,
  ): Promise<any> {
    const { companyId, userId } = getTenantContext();
    return this.procurementService.confirm(companyId, id, userId);
  }

  @Get('orders')
  @ModuleAccess(AppModule.POR)
  async getOrders(
    @Query('plantId') plantId?: string,
    @Query('receivable') receivable?: string,
  ): Promise<PurchaseRequestResponse[]> {
    const { companyId, userId, roleId } = getTenantContext();
    return this.procurementService.getPurchaseOrders(
      companyId,
      userId,
      roleId,
      plantId,
      receivable === 'Y',
    );
  }

  @Post('orders')
  @ModuleAccess(AppModule.POR)
  async createIntegratedOrder(@Body() request: CreateIntegratedOrderDto): Promise<PurchaseRequestResponse> {
    const { companyId, userId } = getTenantContext();
    return this.procurementService.createIntegratedOrder(companyId, {
      ...request,
      lines: request.lines.map((line) => ({ ...line, qty: line.qty.toString() })),
    }, userId);
  }

  @Get('orders/:id')
  @ModuleAccess(AppModule.POR)
  async getOrder(
    @Param('id') id: string,
    @Query('plantId') plantId?: string,
  ): Promise<RequestDetail> {
    const { companyId, userId } = getTenantContext();
    return this.procurementService.getPurchaseOrderDetail(companyId, id, userId, plantId);
  }

  @Get('orders/:id/allocations')
  @ModuleAccess(AppModule.POR)
  async getOrderAllocations(
    @Param('id') id: string,
  ): Promise<PurchaseOrderAllocationResponse[]> {
    const { companyId } = getTenantContext();
    return this.procurementService.getOrderAllocations(companyId, id);
  }

  @Put('orders/:id/allocations')
  @ModuleAccess(AppModule.POR)
  async saveOrderAllocations(
    @Param('id') id: string,
    @Body() request: SaveProcurementAllocationsDto,
  ): Promise<PurchaseOrderAllocationResponse[]> {
    const { companyId, userId } = getTenantContext();
    return this.procurementService.saveOrderAllocations(companyId, id, request.lines.map((line) => ({
      ...line,
      allocatedQty: line.allocatedQty.toString(),
    })), userId);
  }

  @Post('orders/:id/actions/transfer')
  @ModuleAccess(AppModule.STK)
  async transferOrder(
    @Param('id') id: string,
    @Body() request: TransferProcurementDto,
  ): Promise<PurchaseOrderAllocationResponse[]> {
    const { companyId, userId } = getTenantContext();
    return this.procurementService.transferOrder(companyId, id, {
      ...request,
      lines: request.lines.map((line) => ({ ...line, qty: line.qty.toString() })),
    }, userId);
  }

  @Post('transfers/pr')
  @ModuleAccess(AppModule.STK)
  async transferPurchaseRequests(
    @Body() request: CreatePrTransferDto,
  ): Promise<void> {
    const { companyId, userId } = getTenantContext();
    await this.procurementService.transferPurchaseRequests(companyId, {
      ...request,
      lines: request.lines.map((line) => ({ ...line, qty: line.qty.toString() })),
    }, userId);
  }

  @Post('orders/:id/actions/receive')
  @ModuleAccess(AppModule.POR)
  async receiveOrder(
    @Param('id') id: string,
    @Body() request: ReceiveProcurementDto,
  ): Promise<void> {
    const { companyId, userId } = getTenantContext();
    await this.procurementService.receiveOrder(companyId, id, {
      ...request,
      lines: request.lines.map((line) => ({ ...line, qty: line.qty.toString(), unitPrice: line.unitPrice.toString() })),
    }, userId);
  }

  @Post('orders/:id/actions/order')
  @ModulePermission(AppModule.POR, 'U')
  async placeOrder(
    @Param('id') id: string,
    @Body() request: PlaceOrderDto,
  ): Promise<any> {
    const { companyId, userId } = getTenantContext();
    return this.procurementService.placeOrder(companyId, { ...request, requestId: id }, userId);
  }

  @Post('orders/:id/actions/ship')
  @ModulePermission(AppModule.POR, 'U')
  async startShipping(
    @Param('id') id: string,
    @Body() request: StartShippingDto,
  ): Promise<any> {
    const { companyId, userId } = getTenantContext();
    return this.procurementService.startShipping(companyId, { ...request, requestId: id }, userId);
  }

  @Post('requests/:id/actions/receive')
  @ModuleAccess(AppModule.STK)
  async receive(
    @Param('id') id: string,
    @Body() request: ReceiveProcurementDto,
  ): Promise<any> {
    const { companyId, userId } = getTenantContext();
    return this.procurementService.receive(companyId, {
      ...request,
      requestId: id,
      lines: request.lines.map((line) => ({
        ...line,
        qty: line.qty.toString(),
        unitPrice: line.unitPrice.toString(),
      })),
    }, userId);
  }

  @Post('slips/cancel/:docNo')
  @ModuleAccess(AppModule.STK)
  async cancelSlip(@Param('docNo') docNo: string): Promise<void> {
    const { companyId, userId } = getTenantContext();
    await this.procurementService.cancelSlip(companyId, docNo, userId);
  }

  @Post('receipts/cancel/:docNo')
  @ModuleAccess(AppModule.STK)
  async cancelReceipt(@Param('docNo') docNo: string): Promise<void> {
    const { companyId, userId } = getTenantContext();
    await this.procurementService.cancelSlip(companyId, docNo, userId);
  }

  @Post('orders/:id/actions/close')
  @ModulePermission(AppModule.POR, 'U')
  async close(@Param('id') id: string): Promise<any> {
    const { companyId, userId } = getTenantContext();
    return this.procurementService.close(companyId, id, userId);
  }

  @Delete('requests/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ModulePermission(AppModule.PUR, 'D')
  async deleteRequest(@Param('id') id: string): Promise<void> {
    const { companyId, userId, roleId } = getTenantContext();
    await this.procurementService.deleteRequest(companyId, id, userId, roleId);
  }
}
