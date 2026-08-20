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
import { MdmService, MdmUserInput, MdmUserResponse } from './mdm.service';
import { Plant } from '../../entities/plant.entity';
import { Department } from '../../entities/department.entity';
import { Role } from '../../entities/role.entity';
import { User } from '../../entities/users.entity';
import { Warehouse } from '../../entities/warehouse.entity';
import { CodeGroup } from '../../entities/code-group.entity';
import { CodeItem } from '../../entities/code-item.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  PermissionGuard,
  ModulePermission,
} from '../../common/guards/permission.guard';
import { RoleDetail } from '../../entities/role-detail.entity';
import { AppModule, AppModuleLabel } from '../../common/constants/module.constants';
import { getTenantContext } from '../../common/context/tenant.context';

@Controller('api/mdm')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class MdmController {
  constructor(private readonly mdmService: MdmService) {}

  // =========================================================================
  // 2. 플랜트 (Plant)
  // =========================================================================
  @Get('plants')
  @ModulePermission(AppModule.MDM, 'R')
  async getPlants(@Query('plantId') plantId?: string): Promise<Plant[]> {
    const { companyId, userId } = getTenantContext();
    return this.mdmService.getPlantsForUse(companyId, userId, plantId);
  }


  @Post('plants')
  @ModulePermission(AppModule.MDM, 'C')
  async createPlant(@Body() plant: Partial<Plant>): Promise<Plant> {
    const { companyId, userId } = getTenantContext();
    return this.mdmService.savePlant(companyId, plant, userId);
  }

  @Put('plants/:id')
  @ModulePermission(AppModule.MDM, 'U')
  async updatePlant(@Param('id') id: string, @Body() plant: Partial<Plant>): Promise<Plant> {
    const { companyId, userId } = getTenantContext();
    return this.mdmService.updatePlant(companyId, id, plant, userId);
  }

  @Delete('plants/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ModulePermission(AppModule.MDM, 'D')
  async deletePlant(@Param('id') id: string): Promise<void> {
    const { companyId, userId } = getTenantContext();
    await this.mdmService.deletePlant(companyId, id, userId);
  }

  // =========================================================================
  // 3. 부서 (Department)
  // =========================================================================
  @Get('departments')
  @ModulePermission(AppModule.MDM, 'R')
  async getDepartments(): Promise<Department[]> {
    const { companyId } = getTenantContext();
    return this.mdmService.getDepartmentsByCompany(companyId);
  }

  @Get('lookups/departments')
  @ModulePermission(AppModule.MDM, 'R')
  async getDepartmentOptions(
    @Query('keyword') keyword?: string,
    @Query('limit') limit?: string,
  ): Promise<Department[]> {
    const { companyId } = getTenantContext();
    return this.mdmService.getDepartmentOptions(companyId, keyword, limit);
  }

  @Post('departments')
  @ModulePermission(AppModule.MDM, 'C')
  async createDepartment(@Body() dept: Partial<Department>): Promise<Department> {
    const { companyId, userId } = getTenantContext();
    return this.mdmService.saveDepartment(companyId, dept, userId);
  }

  @Put('departments/:id')
  @ModulePermission(AppModule.MDM, 'U')
  async updateDepartment(@Param('id') id: string, @Body() dept: Partial<Department>): Promise<Department> {
    const { companyId, userId } = getTenantContext();
    return this.mdmService.updateDepartment(companyId, id, dept, userId);
  }

  @Delete('departments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ModulePermission(AppModule.MDM, 'D')
  async deleteDepartment(@Param('id') id: string): Promise<void> {
    const { companyId, userId } = getTenantContext();
    await this.mdmService.deleteDepartment(companyId, id, userId);
  }

  // =========================================================================
  // 4. 권한 그룹 (Role)
  // =========================================================================
  @Get('roles')
  @ModulePermission(AppModule.MDM, 'R')
  async getRoles(): Promise<Role[]> {
    const { companyId } = getTenantContext();
    return this.mdmService.getRolesByCompany(companyId);
  }

  @Post('roles')
  @ModulePermission(AppModule.MDM, 'C')
  async createRole(@Body() role: Partial<Role>): Promise<Role> {
    const { companyId, userId } = getTenantContext();
    return this.mdmService.saveRole(companyId, role, userId);
  }

  @Get('roles/:id/details')
  @ModulePermission(AppModule.MDM, 'R')
  async getRoleDetails(@Param('id') id: string): Promise<RoleDetail[]> {
    const { companyId } = getTenantContext();
    return this.mdmService.getRoleDetails(companyId, id);
  }

  @Put('roles/:id/details')
  @ModulePermission(AppModule.MDM, 'U')
  async saveRoleDetails(
    @Param('id') id: string,
    @Body() details: Partial<RoleDetail>[],
  ): Promise<void> {
    const { companyId, userId } = getTenantContext();
    await this.mdmService.saveRoleDetails(companyId, id, details, userId);
  }

  @Put('roles/:id')
  @ModulePermission(AppModule.MDM, 'U')
  async updateRole(
    @Param('id') id: string,
    @Body() role: Partial<Role>,
  ): Promise<Role> {
    const { companyId, userId } = getTenantContext();
    return this.mdmService.updateRole(companyId, id, role, userId);
  }

  @Delete('roles/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ModulePermission(AppModule.MDM, 'D')
  async deleteRole(@Param('id') id: string): Promise<void> {
    const { companyId, userId } = getTenantContext();
    await this.mdmService.deleteRole(companyId, id, userId);
  }

  // =========================================================================
  // 5. 사용자 (User)
  // =========================================================================
  @Get('users')
  @ModulePermission(AppModule.MDM, 'R')
  async getUsers(): Promise<MdmUserResponse[]> {
    const { companyId } = getTenantContext();
    return this.mdmService.getUsersByCompany(companyId);
  }

  @Get('lookups/users')
  @ModulePermission(AppModule.MDM, 'R')
  async getUserOptions(
    @Query('keyword') keyword?: string,
    @Query('limit') limit?: string,
  ): Promise<Partial<User>[]> {
    const { companyId } = getTenantContext();
    return this.mdmService.getUserOptions(companyId, keyword, limit);
  }

  @Post('users')
  @ModulePermission(AppModule.MDM, 'C')
  async createUser(@Body() user: MdmUserInput): Promise<MdmUserResponse> {
    const { companyId, userId } = getTenantContext();
    return this.mdmService.saveUser(companyId, user, userId);
  }

  @Put('users/:id')
  @ModulePermission(AppModule.MDM, 'U')
  async updateUser(@Param('id') id: string, @Body() user: MdmUserInput): Promise<MdmUserResponse> {
    const { companyId, userId } = getTenantContext();
    return this.mdmService.updateUser(companyId, id, user, userId); // userId 가 operator 로서 C1-sub 로직 검사 수행
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ModulePermission(AppModule.MDM, 'D')
  async deleteUser(@Param('id') id: string): Promise<void> {
    const { companyId, userId } = getTenantContext();
    await this.mdmService.deleteUser(companyId, id, userId);
  }

  // =========================================================================
  // 6. 저장소 (Warehouse)
  // =========================================================================
  @Get('warehouses')
  @ModulePermission(AppModule.MDM, 'R')
  async getWarehouses(@Query('plantId') plantId?: string): Promise<Warehouse[]> {
    const { companyId, userId } = getTenantContext();
    return this.mdmService.getWarehousesForUse(companyId, userId, plantId);
  }


  @Post('warehouses')
  @ModulePermission(AppModule.MDM, 'C')
  async createWarehouse(@Body() warehouse: Partial<Warehouse>): Promise<Warehouse> {
    const { companyId, userId } = getTenantContext();
    return this.mdmService.saveWarehouse(companyId, warehouse, userId);
  }

  @Put('warehouses/:id')
  @ModulePermission(AppModule.MDM, 'U')
  async updateWarehouse(@Param('id') id: string, @Body() warehouse: Partial<Warehouse>): Promise<Warehouse> {
    const { companyId, userId } = getTenantContext();
    return this.mdmService.updateWarehouse(companyId, id, warehouse, userId);
  }

  @Delete('warehouses/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ModulePermission(AppModule.MDM, 'D')
  async deleteWarehouse(@Param('id') id: string): Promise<void> {
    const { companyId, userId } = getTenantContext();
    await this.mdmService.deleteWarehouse(companyId, id, userId);
  }

  // =========================================================================
  // 7. 공통코드 그룹 & 아이템
  // =========================================================================
  @Get('code-groups')
  @ModulePermission(AppModule.MDM, 'R')
  async getCodeGroups(): Promise<CodeGroup[]> {
    const { companyId } = getTenantContext();
    return this.mdmService.getCodeGroupsByCompany(companyId);
  }

  @Post('code-groups')
  @ModulePermission(AppModule.MDM, 'C')
  async createCodeGroup(@Body() group: Partial<CodeGroup>): Promise<CodeGroup> {
    const { companyId, userId } = getTenantContext();
    return this.mdmService.saveCodeGroup(companyId, group, userId);
  }

  @Put('code-groups/:id')
  @ModulePermission(AppModule.MDM, 'U')
  async updateCodeGroup(@Param('id') id: string, @Body() group: Partial<CodeGroup>): Promise<CodeGroup> {
    const { companyId, userId } = getTenantContext();
    return this.mdmService.updateCodeGroup(companyId, id, group, userId);
  }

  @Delete('code-groups/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ModulePermission(AppModule.MDM, 'D')
  async deleteCodeGroup(@Param('id') id: string): Promise<void> {
    const { companyId, userId } = getTenantContext();
    await this.mdmService.deleteCodeGroup(companyId, id, userId);
  }

  @Get('code-groups/:groupId/items')
  @ModulePermission(AppModule.MDM, 'R')
  async getCodeItems(@Param('groupId') groupId: string): Promise<CodeItem[]> {
    const { companyId } = getTenantContext();
    return this.mdmService.getCodeItems(companyId, groupId);
  }


  @Post('code-groups/:groupId/items')
  @ModulePermission(AppModule.MDM, 'C')
  async createCodeItem(
    @Param('groupId') groupId: string,
    @Body() item: Partial<CodeItem>,
  ): Promise<CodeItem> {
    const { companyId } = getTenantContext();
    return this.mdmService.saveCodeItem(companyId, groupId, item);
  }

  @Put('code-groups/:groupId/items/:id')
  @ModulePermission(AppModule.MDM, 'U')
  async updateCodeItem(
    @Param('groupId') groupId: string,
    @Param('id') id: string,
    @Body() item: Partial<CodeItem>,
  ): Promise<CodeItem> {
    const { companyId } = getTenantContext();
    return this.mdmService.updateCodeItem(companyId, groupId, id, item);
  }

  @Delete('code-groups/:groupId/items/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ModulePermission(AppModule.MDM, 'D')
  async deleteCodeItem(
    @Param('groupId') groupId: string,
    @Param('id') id: string,
  ): Promise<void> {
    const { companyId } = getTenantContext();
    await this.mdmService.deleteCodeItem(companyId, groupId, id);
  }

}

@Controller('api/meta')
@UseGuards(JwtAuthGuard)
export class MetaController {
  @Get('modules')
  async getModules(): Promise<{ code: string; label: string }[]> {
    return Object.values(AppModule).map((code) => ({
      code,
      label: AppModuleLabel[code],
    }));
  }
}
