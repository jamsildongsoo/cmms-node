import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { MasterService, EquipmentSaveRequest } from './master.service';
import { EquipmentSaveRequestDto, InventoryUpsertDto } from './dto/master.dto';
import { Equipment } from '../../entities/equipment.entity';
import { Inventory } from '../../entities/inventory.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard, ModulePermission } from '../../common/guards/permission.guard';
import { AppModule } from '../../common/constants/module.constants';
import { getTenantContext } from '../../common/context/tenant.context';

@Controller('api/master')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class MasterController {
  constructor(private readonly masterService: MasterService) {}

  // =========================================================================
  // 1. 설비 마스터 (Equipment)
  // =========================================================================
  @Get('equipments')
  @ModulePermission(AppModule.EQP, 'R')

  async getEquipments(
    @Query('plantId') plantId?: string,
    @Query('keyword') keyword?: string,
    @Query('limit') limit?: string,
  ): Promise<Equipment[]> {
    const { companyId, userId } = getTenantContext();
    return plantId
      ? this.masterService.getEquipmentsByPlant(companyId, plantId, userId, keyword, limit)
      : this.masterService.getEquipmentsByCompany(companyId, userId, keyword, limit);
  }

  @Get('equipments/plant/:plantId')
  @ModulePermission(AppModule.EQP, 'R')

  async getEquipmentsByPlant(@Param('plantId') plantId: string): Promise<Equipment[]> {
    const { companyId, userId } = getTenantContext();
    return this.masterService.getEquipmentsByPlant(companyId, plantId, userId);
  }

  @Get('equipments/details')
  @ModulePermission(AppModule.EQP, 'R')

  async getEquipmentDetails(
    @Query('plantId') plantId: string,
    @Query('id') id: string,
  ): Promise<EquipmentSaveRequest> {
    const { companyId, userId } = getTenantContext();
    return this.masterService.getEquipmentWithDetails(companyId, plantId, id, userId);
  }

  @Post('equipments')
  @ModulePermission(AppModule.EQP, 'C')
  async createEquipment(@Body() request: EquipmentSaveRequestDto): Promise<Equipment> {
    const { companyId, userId } = getTenantContext();
    return this.masterService.saveEquipment(companyId, request, userId, 'create');
  }


  @Put('equipments')
  @ModulePermission(AppModule.EQP, 'U')
  async updateEquipment(@Body() request: EquipmentSaveRequestDto): Promise<Equipment> {
    const { companyId, userId } = getTenantContext();
    return this.masterService.saveEquipment(companyId, request, userId, 'update');
  }

  @Delete('equipments')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ModulePermission(AppModule.EQP, 'D')

  async deleteEquipment(
    @Query('plantId') plantId: string,
    @Query('id') id: string,
  ): Promise<void> {
    const { companyId, userId } = getTenantContext();
    await this.masterService.deleteEquipment(companyId, plantId, id, userId);
  }

  @Get('equipments/csv')
  @ModulePermission(AppModule.EQP, 'R')

  async downloadEquipmentsCsv(@Res() res: Response): Promise<void> {
    const { companyId, userId } = getTenantContext();
    const csv = await this.masterService.exportEquipmentsToCsv(companyId, userId);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=equipments.csv');
    res.status(HttpStatus.OK).send(csv);
  }

  // =========================================================================
  // 2. 재고 마스터 (Inventory)
  // =========================================================================
  @Get('inventories')
  @ModulePermission(AppModule.INV, 'R')
  async getInventories(
    @Query('keyword') keyword?: string,
    @Query('limit') limit?: string,
  ): Promise<Inventory[]> {
    const { companyId } = getTenantContext();
    return this.masterService.getInventoriesByCompany(companyId, keyword, limit);
  }


  @Get('inventories/:id')
  @ModulePermission(AppModule.INV, 'R')

  async getInventory(@Param('id') id: string): Promise<Inventory> {
    const { companyId } = getTenantContext();
    return this.masterService.getInventoryById(companyId, id);
  }

  @Post('inventories')
  @ModulePermission(AppModule.INV, 'C')
  async createInventory(@Body() inventory: InventoryUpsertDto): Promise<Inventory> {
    const { companyId, userId } = getTenantContext();
    return this.masterService.saveInventory(companyId, inventory, userId, 'create');
  }

  @Put('inventories/:id')
  @ModulePermission(AppModule.INV, 'U')
  async updateInventory(
    @Param('id') id: string,
    @Body() inventory: InventoryUpsertDto,
  ): Promise<Inventory> {
    const { companyId, userId } = getTenantContext();
    return this.masterService.saveInventory(
      companyId,
      { ...inventory, id },
      userId,
      'update',
    );
  }

  @Delete('inventories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ModulePermission(AppModule.INV, 'D')

  async deleteInventory(@Param('id') id: string): Promise<void> {
    const { companyId, userId } = getTenantContext();
    await this.masterService.deleteInventory(companyId, id, userId);
  }

  @Get('inventories/csv')
  @ModulePermission(AppModule.INV, 'R')

  async downloadInventoriesCsv(@Res() res: Response): Promise<void> {
    const { companyId } = getTenantContext();
    const csv = await this.masterService.exportInventoriesToCsv(companyId);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=inventories.csv');
    res.status(HttpStatus.OK).send(csv);
  }
}
