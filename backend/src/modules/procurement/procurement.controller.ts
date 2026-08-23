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
  PurchaseOrderResponse,
  PurchaseOrderAllocationResponse,
  PurchaseOrderLinkResponse,
  PurchaseOrderInventoryDocumentResponse,
} from './procurement.service';
import {
  CreateIntegratedOrderDto,
  CreateStandaloneOrderDto,
  SaveProcurementAllocationsDto,
  SaveProcurementDto,
  UpdatePurchaseOrderDto,
} from './dto/procurement.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard, ModulePermission } from '../../common/guards/permission.guard';
import { AppModule } from '../../common/constants/module.constants';
import { getTenantContext } from '../../common/context/tenant.context';

@Controller('api/procurement')
@UseGuards(JwtAuthGuard)
export class ProcurementController {
  constructor(private readonly procurementService: ProcurementService) {}

  /** 확정 여부와 무관하게 권한 범위 내 PUR 목록을 조회한다. */
  @Get('requests')
  @UseGuards(PermissionGuard)
  @ModulePermission(AppModule.PUR, 'R')
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

  /** PUR 상세와 항목을 조회한다. */
  @Get('requests/:id')
  @UseGuards(PermissionGuard)
  @ModulePermission(AppModule.PUR, 'R')
  async getRequest(
    @Param('id') id: string,
    @Query('plantId') plantId?: string,
  ): Promise<RequestDetail> {
    const { companyId, userId } = getTenantContext();
    return this.procurementService.getPurchaseRequestDetail(companyId, id, userId, plantId);
  }

  /** PUR에 연결된 POR 번호와 상태만 지연 조회한다. */
  @Get('requests/:id/order-links')
  @UseGuards(PermissionGuard)
  @ModulePermission(AppModule.PUR, 'R')
  async getPurchaseOrderLinks(@Param('id') id: string): Promise<PurchaseOrderLinkResponse[]> {
    const { companyId } = getTenantContext();
    return this.procurementService.getPurchaseOrderLinks(companyId, id);
  }

  @Post('requests')
  @UseGuards(PermissionGuard)
  @ModulePermission(AppModule.PUR, 'C')
  async createRequest(@Body() request: SaveProcurementDto): Promise<PurchaseRequestResponse> {
    const { companyId, userId } = getTenantContext();
    return this.procurementService.createRequest(companyId, {
      ...request,
      items: request.items?.map((item) => ({ ...item, qty: item.qty.toString() })),
    }, userId);
  }

  @Put('requests/:id')
  async updateRequest(
    @Param('id') id: string,
    @Body() request: SaveProcurementDto,
  ): Promise<PurchaseRequestResponse> {
    const { companyId, userId } = getTenantContext();
    return this.procurementService.updateRequest(companyId, id, {
      ...request,
      items: request.items?.map((item) => ({ ...item, qty: item.qty.toString() })),
    }, userId);
  }

  /** STK에서 구매입고 대상 POR를 조회한다. */
  @Get('orders/receivable/:id')
  @UseGuards(PermissionGuard)
  @ModulePermission(AppModule.STK, 'R')
  async getReceivableOrder(
    @Param('id') id: string,
    @Query('plantId') plantId?: string,
  ): Promise<RequestDetail> {
    const { companyId, userId } = getTenantContext();
    return this.procurementService.getPurchaseOrderDetail(companyId, id, userId, plantId, AppModule.STK);
  }

  @Get('orders/receivable')
  @UseGuards(PermissionGuard)
  @ModulePermission(AppModule.STK, 'R')
  async getReceivableOrders(
    @Query('plantId') plantId?: string,
  ): Promise<PurchaseOrderResponse[]> {
    const { companyId, userId, roleId } = getTenantContext();
    return this.procurementService.getPurchaseOrders(
      companyId,
      userId,
      roleId,
      plantId,
      true,
      AppModule.STK,
    );
  }

  @Get('orders')
  @UseGuards(PermissionGuard)
  @ModulePermission(AppModule.POR, 'R')
  async getOrders(
    @Query('plantId') plantId?: string,
    @Query('receivable') receivable?: string,
    @Query('tempOnly') tempOnly?: string,
  ): Promise<PurchaseOrderResponse[]> {
    const { companyId, userId, roleId } = getTenantContext();
    return this.procurementService.getPurchaseOrders(
      companyId,
      userId,
      roleId,
      plantId,
      receivable === 'Y',
      AppModule.POR,
      tempOnly === 'Y',
    );
  }

  /** 여러 PUR 항목을 Allocation으로 묶어 임시 POR를 생성한다. */
  @Post('orders')
  @UseGuards(PermissionGuard)
  @ModulePermission(AppModule.POR, 'C')
  async createIntegratedOrder(@Body() request: CreateIntegratedOrderDto): Promise<PurchaseOrderResponse> {
    const { companyId, userId } = getTenantContext();
    return this.procurementService.createIntegratedOrder(companyId, {
      ...request,
      lines: request.lines.map((line) => ({ ...line, qty: line.qty.toString() })),
    }, userId);
  }

  /** PUR와 무관한 독립 POR와 품목을 임시저장한다. */
  @Post('orders/standalone')
  @UseGuards(PermissionGuard)
  @ModulePermission(AppModule.POR, 'C')
  async createStandaloneOrder(@Body() request: CreateStandaloneOrderDto): Promise<PurchaseOrderResponse> {
    const { companyId, userId } = getTenantContext();
    return this.procurementService.createStandaloneOrder(companyId, {
      ...request,
      items: request.items.map((item) => ({ ...item, qty: item.qty.toString() })),
    }, userId);
  }

  /** 임시저장 상태의 POR 헤더와 독립 POR 품목을 수정한다. */
  @Put('orders/:id')
  async updateOrder(
    @Param('id') id: string,
    @Body() request: UpdatePurchaseOrderDto,
  ): Promise<RequestDetail> {
    const { companyId, userId } = getTenantContext();
    return this.procurementService.updatePurchaseOrder(companyId, id, {
      ...request,
      items: request.items?.map((item) => ({ ...item, qty: item.qty.toString() })),
    }, userId);
  }

  /** POR 상세와 Allocation 대상 항목을 조회한다. */
  @Get('orders/:id')
  @UseGuards(PermissionGuard)
  @ModulePermission(AppModule.POR, 'R')
  async getOrder(
    @Param('id') id: string,
    @Query('plantId') plantId?: string,
  ): Promise<RequestDetail> {
    const { companyId, userId } = getTenantContext();
    return this.procurementService.getPurchaseOrderDetail(companyId, id, userId, plantId);
  }

  @Get('orders/:id/allocations')
  @UseGuards(PermissionGuard)
  @ModulePermission(AppModule.POR, 'R')
  async getOrderAllocations(
    @Param('id') id: string,
  ): Promise<PurchaseOrderAllocationResponse[]> {
    const { companyId } = getTenantContext();
    return this.procurementService.getOrderAllocations(companyId, id);
  }

  @Get('orders/:id/inventory-documents')
  @UseGuards(PermissionGuard)
  @ModulePermission(AppModule.POR, 'R')
  async getOrderInventoryDocuments(@Param('id') id: string): Promise<PurchaseOrderInventoryDocumentResponse[]> {
    const { companyId } = getTenantContext();
    return this.procurementService.getPurchaseOrderInventoryDocuments(companyId, id);
  }

  /** 임시 POR의 Allocation을 저장한다. */
  @Put('orders/:id/allocations')
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

  /** Allocation이 있는 임시 POR를 자체확정한다. */
  @Post('orders/:id/actions/confirm')
  @UseGuards(PermissionGuard)
  @ModulePermission(AppModule.POR, 'A')
  async confirmOrder(@Param('id') id: string): Promise<RequestDetail> {
    const { companyId, userId } = getTenantContext();
    return this.procurementService.confirmOrder(companyId, id, userId);
  }

  /** 임시 POR를 논리삭제한다. */
  @Delete('orders/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteOrder(@Param('id') id: string): Promise<void> {
    const { companyId, userId } = getTenantContext();
    await this.procurementService.deleteOrder(companyId, id, userId);
  }

  @Post('orders/:id/actions/close')
  async close(@Param('id') id: string): Promise<PurchaseRequestResponse> {
    const { companyId, userId } = getTenantContext();
    return this.procurementService.close(companyId, id, userId);
  }

  @Delete('requests/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRequest(@Param('id') id: string): Promise<void> {
    const { companyId, userId } = getTenantContext();
    await this.procurementService.deleteRequest(companyId, id, userId);
  }
}
