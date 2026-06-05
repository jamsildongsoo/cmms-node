import {
  Controller,
  Get,
  Post,
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
import { Equipment } from '../../entities/equipment.entity';
import { Inventory } from '../../entities/inventory.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard, Permission } from '../../common/guards/permission.guard';
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
  @Permission(AppModule.EQP, 'R')
  async getEquipments(): Promise<Equipment[]> {
    const { companyId, userId } = getTenantContext();
    return this.masterService.getEquipmentsByCompany(companyId, userId);
  }

  @Get('equipments/plant/:plantId')
  @Permission(AppModule.EQP, 'R')
  async getEquipmentsByPlant(@Param('plantId') plantId: string): Promise<Equipment[]> {
    const { companyId, userId } = getTenantContext();
    return this.masterService.getEquipmentsByPlant(companyId, plantId, userId);
  }

  @Get('equipments/details')
  @Permission(AppModule.EQP, 'R')
  async getEquipmentDetails(
    @Query('plantId') plantId: string,
    @Query('id') id: string,
  ): Promise<EquipmentSaveRequest> {
    const { companyId, userId } = getTenantContext();
    return this.masterService.getEquipmentWithDetails(companyId, plantId, id, userId);
  }

  @Post('equipments')
  @Permission(AppModule.EQP, 'C')
  async saveEquipment(@Body() request: EquipmentSaveRequest): Promise<Equipment> {
    const { companyId, userId } = getTenantContext();
    return this.masterService.saveEquipment(companyId, request, userId);
  }

  @Delete('equipments')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permission(AppModule.EQP, 'D')
  async deleteEquipment(
    @Query('plantId') plantId: string,
    @Query('id') id: string,
  ): Promise<void> {
    const { companyId, userId } = getTenantContext();
    await this.masterService.deleteEquipment(companyId, plantId, id, userId);
  }

  @Get('equipments/csv')
  @Permission(AppModule.EQP, 'R')
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
  @Permission(AppModule.INV, 'R')
  async getInventories(): Promise<Inventory[]> {
    const { companyId } = getTenantContext();
    return this.masterService.getInventoriesByCompany(companyId);
  }

  @Get('inventories/:id')
  @Permission(AppModule.INV, 'R')
  async getInventory(@Param('id') id: string): Promise<Inventory> {
    const { companyId } = getTenantContext();
    return this.masterService.getInventoryById(companyId, id);
  }

  @Post('inventories')
  @Permission(AppModule.INV, 'C')
  async saveInventory(@Body() inventory: Partial<Inventory>): Promise<Inventory> {
    const { companyId, userId } = getTenantContext();
    return this.masterService.saveInventory(companyId, inventory, userId);
  }

  @Delete('inventories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permission(AppModule.INV, 'D')
  async deleteInventory(@Param('id') id: string): Promise<void> {
    const { companyId, userId } = getTenantContext();
    await this.masterService.deleteInventory(companyId, id, userId);
  }

  @Get('inventories/csv')
  @Permission(AppModule.INV, 'R')
  async downloadInventoriesCsv(@Res() res: Response): Promise<void> {
    const { companyId } = getTenantContext();
    const csv = await this.masterService.exportInventoriesToCsv(companyId);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=inventories.csv');
    res.status(HttpStatus.OK).send(csv);
  }
}
