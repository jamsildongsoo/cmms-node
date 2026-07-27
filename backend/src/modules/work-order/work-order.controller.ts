import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WorkOrderService } from './work-order.service';
import {
  SaveWorkOrderDto,
  WorkOrderDetailsDto,
  WorkOrderResponseDto,
} from './dto/work-order.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard, Permission, PermissionSave } from '../../common/guards/permission.guard';
import { AppModule } from '../../common/constants/module.constants';
import { getTenantContext } from '../../common/context/tenant.context';

@Controller('api/work-order')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class WorkOrderController {
  constructor(private readonly workOrderService: WorkOrderService) {}

  @Get()
  @Permission(AppModule.WO, 'R')
  async getWorkOrders(
    @Query('searchType') searchType?: string,
    @Query('searchValue') searchValue?: string,
  ): Promise<WorkOrderResponseDto[]> {
    const { companyId, userId } = getTenantContext();
    return this.workOrderService.getWorkOrdersByCompany(companyId, userId, searchType, searchValue);
  }

  @Get('details')
  @Permission(AppModule.WO, 'R')
  async getWorkOrderDetails(
    @Query('plantId') plantId: string,
    @Query('id') id: string,
  ): Promise<WorkOrderDetailsDto> {
    const { companyId, userId } = getTenantContext();
    return this.workOrderService.getWorkOrderDetails(companyId, plantId, id, userId);
  }

  @Post()
  @PermissionSave(AppModule.WO, 'workOrder.status')
  async saveWorkOrder(
    @Body() request: SaveWorkOrderDto,
  ): Promise<WorkOrderResponseDto> {
    const { companyId, userId } = getTenantContext();
    return this.workOrderService.saveWorkOrder(companyId, request, userId, 'create');
  }

  @Put()
  @PermissionSave(AppModule.WO, 'workOrder.status', 'U')
  async updateWorkOrder(
    @Body() request: SaveWorkOrderDto,
  ): Promise<WorkOrderResponseDto> {
    const { companyId, userId } = getTenantContext();
    return this.workOrderService.saveWorkOrder(companyId, request, userId, 'update');
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permission(AppModule.WO, 'D')
  async deleteWorkOrder(
    @Query('plantId') plantId: string,
    @Query('id') id: string,
  ): Promise<void> {
    const { companyId, userId } = getTenantContext();
    await this.workOrderService.deleteWorkOrder(companyId, plantId, id, userId);
  }
}
