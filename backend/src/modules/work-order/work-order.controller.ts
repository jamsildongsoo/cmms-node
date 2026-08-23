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
import { PermissionGuard, ModulePermission } from '../../common/guards/permission.guard';
import { AppModule } from '../../common/constants/module.constants';
import { getTenantContext } from '../../common/context/tenant.context';

@Controller('api/work-order')
@UseGuards(JwtAuthGuard)
export class WorkOrderController {
  constructor(private readonly workOrderService: WorkOrderService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @ModulePermission(AppModule.WO, 'R')
  async getWorkOrders(
    @Query('searchType') searchType?: string,
    @Query('searchValue') searchValue?: string,
    @Query('tempOnly') tempOnly?: string,
    @Query('plantId') plantId?: string,
  ): Promise<WorkOrderResponseDto[]> {
    const { companyId, userId } = getTenantContext();
    return this.workOrderService.getWorkOrdersByCompany(companyId, userId, searchType, searchValue, tempOnly, plantId);
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @ModulePermission(AppModule.WO, 'R')
  async getWorkOrderDetails(
    @Param('id') id: string,
    @Query('plantId') plantId: string,
  ): Promise<WorkOrderDetailsDto> {
    const { companyId, userId } = getTenantContext();
    return this.workOrderService.getWorkOrderDetails(companyId, plantId, id, userId);
  }

  @Post()
  @UseGuards(PermissionGuard)
  @ModulePermission(AppModule.WO, 'C')
  async createWorkOrder(
    @Body() request: SaveWorkOrderDto,
  ): Promise<WorkOrderResponseDto> {
    const { companyId, userId } = getTenantContext();
    return this.workOrderService.createWorkOrder(companyId, request, userId);
  }

  @Put(':id')
  async updateWorkOrder(
    @Param('id') id: string,
    @Body() request: SaveWorkOrderDto,
  ): Promise<WorkOrderResponseDto> {
    const { companyId, userId } = getTenantContext();
    return this.workOrderService.updateWorkOrder(companyId, id, request, userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteWorkOrder(
    @Param('id') id: string,
    @Query('plantId') plantId: string,
  ): Promise<void> {
    const { companyId, userId } = getTenantContext();
    await this.workOrderService.deleteWorkOrder(companyId, plantId, id, userId);
  }
}
