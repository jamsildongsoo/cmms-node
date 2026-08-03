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
import { WorkOrderService } from './work-order.service';
import {
  SaveWorkOrderDto,
  WorkOrderDetailsDto,
  WorkOrderResponseDto,
} from './dto/work-order.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard, Permission, WorkflowPermission } from '../../common/guards/permission.guard';
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
    @Query('plantId') plantId?: string,
  ): Promise<WorkOrderResponseDto[]> {
    const { companyId, userId } = getTenantContext();
    return this.workOrderService.getWorkOrdersByCompany(companyId, userId, searchType, searchValue, plantId);
  }

  @Get(':id')
  @Permission(AppModule.WO, 'R')
  async getWorkOrderDetails(
    @Param('id') id: string,
    @Query('plantId') plantId: string,
  ): Promise<WorkOrderDetailsDto> {
    const { companyId, userId } = getTenantContext();
    return this.workOrderService.getWorkOrderDetails(companyId, plantId, id, userId);
  }

  @Post()
  @Permission(AppModule.WO, 'C')
  async saveWorkOrder(
    @Body() request: SaveWorkOrderDto,
  ): Promise<WorkOrderResponseDto> {
    const { companyId, userId, roleId } = getTenantContext();
    return this.workOrderService.saveWorkOrder(companyId, request, userId, 'create', roleId);
  }

  @Put(':id')
  @WorkflowPermission()
  async updateWorkOrder(
    @Param('id') id: string,
    @Body() request: SaveWorkOrderDto,
  ): Promise<WorkOrderResponseDto> {
    const { companyId, userId, roleId } = getTenantContext();
    request.workOrder.id = id;
    return this.workOrderService.saveWorkOrder(companyId, request, userId, 'update', roleId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @WorkflowPermission()
  async deleteWorkOrder(
    @Param('id') id: string,
    @Query('plantId') plantId: string,
  ): Promise<void> {
    const { companyId, userId, roleId } = getTenantContext();
    await this.workOrderService.deleteWorkOrder(companyId, plantId, id, userId, roleId);
  }
}
