import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProcurementService, SaveRequest, OrderRequest, ShipRequest, ReceiveRequest, RequestDetail } from './procurement.service';
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
  ): Promise<any[]> {
    const { companyId, userId } = getTenantContext();
    return this.procurementService.getRequests(companyId, userId, plantId);
  }

  @Get('requests/:id')
  @Permission(AppModule.PUR, 'R')
  async getRequest(@Param('id') id: string): Promise<RequestDetail> {
    const { companyId } = getTenantContext();
    return this.procurementService.getRequestDetail(companyId, id);
  }

  @Post('requests')
  @Permission(AppModule.PUR, 'C')
  async saveRequest(@Body() request: SaveRequest): Promise<any> {
    const { companyId, userId } = getTenantContext();
    return this.procurementService.createOrUpdate(companyId, request, userId);
  }

  @Post('requests/:id/confirm')
  @Permission(AppModule.PUR, 'A')
  async confirmRequest(
    @Param('id') id: string,
  ): Promise<any> {
    const { companyId, userId } = getTenantContext();
    return this.procurementService.confirm(companyId, id, userId);
  }

  @Post('orders')
  @Permission(AppModule.PUR, 'U')
  async placeOrder(@Body() request: OrderRequest): Promise<any> {
    const { companyId, userId } = getTenantContext();
    return this.procurementService.placeOrder(companyId, request, userId);
  }

  @Post('shipments')
  @Permission(AppModule.PUR, 'U')
  async startShipping(@Body() request: ShipRequest): Promise<any> {
    const { companyId, userId } = getTenantContext();
    return this.procurementService.startShipping(companyId, request, userId);
  }

  @Post('receipts')
  @Permission(AppModule.STK, 'C')
  async receive(@Body() request: ReceiveRequest): Promise<any> {
    const { companyId, userId } = getTenantContext();
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

  @Post('requests/:id/close')
  @Permission(AppModule.PUR, 'U')
  async close(@Param('id') id: string): Promise<any> {
    const { companyId, userId } = getTenantContext();
    return this.procurementService.close(companyId, id, userId);
  }

  @Delete('requests/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permission(AppModule.PUR, 'D')
  async deleteRequest(@Param('id') id: string): Promise<void> {
    const { companyId, userId } = getTenantContext();
    await this.procurementService.deleteRequest(companyId, id, userId);
  }
}
