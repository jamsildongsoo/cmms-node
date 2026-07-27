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
import { ProcurementService, SaveRequest, OrderRequest, ShipRequest, ReceiveRequest, RequestDetail, VendorRequest } from './procurement.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard, Permission } from '../../common/guards/permission.guard';
import { AppModule } from '../../common/constants/module.constants';
import { getTenantContext } from '../../common/context/tenant.context';

@Controller('api/procurement')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ProcurementController {
  constructor(private readonly procurementService: ProcurementService) {}

  @Get('vendors')
  async getVendors(): Promise<any[]> {
    const { companyId } = getTenantContext();
    return this.procurementService.getVendors(companyId);
  }

  @Post('vendors')
  @Permission(AppModule.PUR, 'C')
  async createVendor(@Body() request: VendorRequest): Promise<any> {
    const { companyId, userId } = getTenantContext();
    return this.procurementService.createVendor(companyId, request, userId);
  }

  @Put('vendors/:id')
  @Permission(AppModule.PUR, 'U')
  async updateVendor(
    @Param('id') id: string,
    @Body() request: VendorRequest,
  ): Promise<any> {
    const { companyId, userId } = getTenantContext();
    return this.procurementService.updateVendor(companyId, id, request, userId);
  }

  @Delete('vendors/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permission(AppModule.PUR, 'D')
  async deleteVendor(@Param('id') id: string): Promise<void> {
    const { companyId, userId } = getTenantContext();
    await this.procurementService.deleteVendor(companyId, id, userId);
  }

  @Get('requests')
  @Permission(AppModule.PUR, 'R')
  async getRequests(
    @Query('plantId') plantId?: string,
  ): Promise<any[]> {
    const { companyId, userId } = getTenantContext();
    return this.procurementService.getRequests(companyId, userId, plantId);
  }

  @Get('management/requests')
  @Permission(AppModule.PUR, 'A')
  async getManagementRequests(): Promise<any[]> {
    const { companyId } = getTenantContext();
    return this.procurementService.getManagementRequests(companyId);
  }

  @Get('management/requests/:id')
  @Permission(AppModule.PUR, 'A')
  async getManagementRequest(@Param('id') id: string): Promise<RequestDetail> {
    const { companyId } = getTenantContext();
    return this.procurementService.getRequestDetail(companyId, id);
  }

  @Get('receipts/request/:id')
  @Permission(AppModule.STK, 'C')
  async getReceivableRequest(@Param('id') id: string): Promise<RequestDetail> {
    const { companyId } = getTenantContext();
    return this.procurementService.getReceivableRequest(companyId, id);
  }

  @Get('receipts/requests')
  @Permission(AppModule.STK, 'C')
  async getReceivableRequests(): Promise<any[]> {
    const { companyId } = getTenantContext();
    return this.procurementService.getReceivableRequests(companyId);
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
    return this.procurementService.createOrUpdate(companyId, request, userId, 'create');
  }

  @Put('requests/:id')
  @Permission(AppModule.PUR, 'U')
  async updateRequest(
    @Param('id') id: string,
    @Body() request: SaveRequest,
  ): Promise<any> {
    const { companyId, userId } = getTenantContext();
    request.header.id = id;
    return this.procurementService.createOrUpdate(companyId, request, userId, 'update');
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
  @Permission(AppModule.PUR, 'A')
  async placeOrder(@Body() request: OrderRequest): Promise<any> {
    const { companyId, userId } = getTenantContext();
    return this.procurementService.placeOrder(companyId, request, userId);
  }

  @Post('shipments')
  @Permission(AppModule.PUR, 'A')
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
  @Permission(AppModule.PUR, 'A')
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
