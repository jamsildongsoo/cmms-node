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
  SaveRequest,
  OrderRequest,
  ShipRequest,
  ReceiveRequest,
  RequestDetail,
  PurchaseRequestResponse,
} from './procurement.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard, Permission } from '../../common/guards/permission.guard';
import { AppModule } from '../../common/constants/module.constants';
import { getTenantContext } from '../../common/context/tenant.context';

@Controller('api/procurement')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ProcurementController {
  constructor(private readonly procurementService: ProcurementService) {}

  @Get('requests')
  @Permission(AppModule.PUR, 'R')
  async getRequests(
    @Query('plantId') plantId?: string,
    @Query('receivable') receivable?: string,
  ): Promise<PurchaseRequestResponse[]> {
    const { companyId, userId, roleId } = getTenantContext();
    return this.procurementService.getPurchaseRequests(
      companyId,
      userId,
      roleId,
      plantId,
      receivable === 'Y',
    );
  }

  @Get('receipts/request/:id')
  @Permission(AppModule.STK, 'R')
  async getReceivableRequest(@Param('id') id: string): Promise<RequestDetail> {
    const { companyId, userId } = getTenantContext();
    return this.procurementService.getReceivableRequest(companyId, id, userId);
  }

  @Get('receipts/requests')
  @Permission(AppModule.STK, 'R')
  async getReceivableRequests(): Promise<any[]> {
    const { companyId, userId } = getTenantContext();
    return this.procurementService.getReceivableRequests(companyId, userId);
  }

  @Get('requests/:id')
  @Permission(AppModule.PUR, 'R')
  async getRequest(
    @Param('id') id: string,
    @Query('plantId') plantId?: string,
  ): Promise<RequestDetail> {
    const { companyId, userId } = getTenantContext();
    return this.procurementService.getPurchaseRequestDetail(companyId, id, userId, plantId);
  }

  @Post('requests')
  @Permission(AppModule.PUR, 'C')
  async saveRequest(@Body() request: SaveRequest): Promise<any> {
    const { companyId, userId } = getTenantContext();
    return this.procurementService.createOrUpdate(companyId, request, userId, 'create');
  }

  @Put('requests/:id')
  @Permission(AppModule.PUR, 'U')
  async updateRequest(
    @Param('id') id: string,
    @Body() request: SaveRequest,
  ): Promise<any> {
    const { companyId, userId, roleId } = getTenantContext();
    request.header.id = id;
    return this.procurementService.createOrUpdate(companyId, request, userId, 'update', roleId);
  }

  @Post('requests/:id/actions/confirm')
  @Permission(AppModule.PUR, 'A')
  async confirmRequest(
    @Param('id') id: string,
  ): Promise<any> {
    const { companyId, userId } = getTenantContext();
    return this.procurementService.confirm(companyId, id, userId);
  }

  @Get('orders')
  @Permission(AppModule.POR, 'R')
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

  @Get('orders/:id')
  @Permission(AppModule.POR, 'R')
  async getOrder(
    @Param('id') id: string,
    @Query('plantId') plantId?: string,
  ): Promise<RequestDetail> {
    const { companyId, userId } = getTenantContext();
    return this.procurementService.getPurchaseOrderDetail(companyId, id, userId, plantId);
  }

  @Post('orders/:id/actions/order')
  @Permission(AppModule.POR, 'U')
  async placeOrder(
    @Param('id') id: string,
    @Body() request: OrderRequest,
  ): Promise<any> {
    const { companyId, userId } = getTenantContext();
    request.requestId = id;
    return this.procurementService.placeOrder(companyId, request, userId);
  }

  @Post('orders/:id/actions/ship')
  @Permission(AppModule.POR, 'U')
  async startShipping(
    @Param('id') id: string,
    @Body() request: ShipRequest,
  ): Promise<any> {
    const { companyId, userId } = getTenantContext();
    request.requestId = id;
    return this.procurementService.startShipping(companyId, request, userId);
  }

  @Post('requests/:id/actions/receive')
  @Permission(AppModule.STK, 'C')
  async receive(
    @Param('id') id: string,
    @Body() request: ReceiveRequest,
  ): Promise<any> {
    const { companyId, userId } = getTenantContext();
    request.requestId = id;
    return this.procurementService.receive(companyId, request, userId);
  }

  @Post('slips/cancel/:docNo')
  @Permission(AppModule.STK, 'C')
  async cancelSlip(@Param('docNo') docNo: string): Promise<void> {
    const { companyId, userId } = getTenantContext();
    await this.procurementService.cancelSlip(companyId, docNo, userId);
  }

  @Post('receipts/cancel/:docNo')
  @Permission(AppModule.STK, 'C')
  async cancelReceipt(@Param('docNo') docNo: string): Promise<void> {
    const { companyId, userId } = getTenantContext();
    await this.procurementService.cancelSlip(companyId, docNo, userId);
  }

  @Post('orders/:id/actions/close')
  @Permission(AppModule.POR, 'U')
  async close(@Param('id') id: string): Promise<any> {
    const { companyId, userId } = getTenantContext();
    return this.procurementService.close(companyId, id, userId);
  }

  @Delete('requests/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permission(AppModule.PUR, 'D')
  async deleteRequest(@Param('id') id: string): Promise<void> {
    const { companyId, userId, roleId } = getTenantContext();
    await this.procurementService.deleteRequest(companyId, id, userId, roleId);
  }
}
