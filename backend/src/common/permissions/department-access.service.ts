import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from '../../entities/users.entity';
import { RoleDetail } from '../../entities/role-detail.entity';
import { AppModule } from '../constants/module.constants';
import type { PermAction } from '../constants/permission.constants';

export interface DepartmentAccess {
  departmentId: string;
  warehouseId: string | null;
  plantId: string | null;
  permC: 'Y' | 'N';
  permR: 'Y' | 'N';
  permU: 'Y' | 'N';
  permD: 'Y' | 'N';
  permA: 'Y' | 'N';
}

export interface ScopeTarget {
  plantId?: string | null;
  warehouseId?: string | null;
}

export type ModuleAccessMap = Record<string, {
  permC: 'Y' | 'N';
  permR: 'Y' | 'N';
  permU: 'Y' | 'N';
  permD: 'Y' | 'N';
  permA: 'Y' | 'N';
}>;

@Injectable()
export class DepartmentAccessService {
  constructor(private readonly dataSource: DataSource) {}

  async getDepartmentWarehouseId(companyId: string, userId: string): Promise<string | null> {
    const user = await this.dataSource.getRepository(User).findOne({
      select: { departmentId: true, roleId: true, scope: true },
      where: { companyId, id: userId, deleteYn: 'N', useYn: 'Y' },
    });
    if (!user?.departmentId) return null;
    const department = await this.dataSource.getRepository('department').findOne({
      select: { warehouseId: true },
      where: { companyId, id: user.departmentId, deleteYn: 'N' },
    }) as { warehouseId: string | null } | null;
    return department?.warehouseId ?? null;
  }

  async getAccessMap(companyId: string, userId: string): Promise<ModuleAccessMap> {
    const modules = Object.values(AppModule);
    const entries = await Promise.all(modules.map(async (module) => [
      module,
      await this.getAccess(companyId, userId, module),
    ] as const));
    return entries.reduce<ModuleAccessMap>((result, [module, access]) => {
      if (access) {
        result[module] = {
          permC: access.permC,
          permR: access.permR,
          permU: access.permU,
          permD: access.permD,
          permA: access.permA,
        };
      }
      return result;
    }, {});
  }

  async getAccess(
    companyId: string,
    userId: string,
    module: AppModule | string,
  ): Promise<DepartmentAccess | null> {
    const user = await this.dataSource.getRepository(User).findOne({
      select: { departmentId: true, lastLoginPlantId: true },
      where: { companyId, id: userId, deleteYn: 'N', useYn: 'Y' },
    });
    if (!user?.departmentId) return null;

    if (!user.roleId) return null;
    const details = await this.dataSource.getRepository(RoleDetail).findOne({
      where: { companyId, roleId: user.roleId, moduleDetail: module },
    });
    if (!details || ![details.permC, details.permR, details.permU, details.permD, details.permA].includes('Y')) return null;

    const department = await this.dataSource.getRepository('department').findOne({
      select: { warehouseId: true },
      where: { companyId, id: user.departmentId, deleteYn: 'N' },
    }) as { warehouseId: string | null } | null;

    return {
      departmentId: user.departmentId,
      warehouseId: department?.warehouseId ?? null,
      plantId: user.lastLoginPlantId ?? null,
      permC: details.permC as 'Y' | 'N',
      permR: details.permR as 'Y' | 'N',
      permU: details.permU as 'Y' | 'N',
      permD: details.permD as 'Y' | 'N',
      permA: details.permA as 'Y' | 'N',
    };
  }

  async hasAction(
    companyId: string,
    userId: string,
    module: AppModule | string,
    action: PermAction,
    target?: ScopeTarget,
  ): Promise<boolean> {
    const user = await this.dataSource.getRepository(User).findOne({
      select: { roleId: true, scope: true, lastLoginPlantId: true },
      where: { companyId, id: userId, deleteYn: 'N', useYn: 'Y' },
    });
    if (!user?.roleId) return false;
    const detail = await this.dataSource.getRepository(RoleDetail).findOne({
      where: { companyId, roleId: user.roleId, moduleDetail: module },
    });
    if (!detail || detail[`perm${action}` as 'permC' | 'permR' | 'permU' | 'permD' | 'permA'] !== 'Y') return false;
    return this.hasScope(companyId, user.scope, user.lastLoginPlantId, target);
  }

  async assertAction(
    companyId: string,
    userId: string,
    module: AppModule | string,
    action: PermAction,
    target?: ScopeTarget,
  ): Promise<void> {
    if (!await this.hasAction(companyId, userId, module, action, target)) {
      throw new ForbiddenException('모듈 CRUD 권한 또는 데이터 범위가 없습니다.');
    }
  }

  private async hasScope(
    companyId: string,
    scope: 'COMPANY' | 'PLANT',
    activePlantId: string | null,
    target?: ScopeTarget,
  ): Promise<boolean> {
    if (scope === 'COMPANY') return true;
    // 목록·생성 라우트처럼 아직 대상 문서가 없는 경우에는
    // CRUD 권한만 Guard에서 확인하고, 실제 Plant 범위는 Service 쿼리에서 적용한다.
    if (!target?.plantId && !target?.warehouseId) return true;
    let resourcePlantId = target?.plantId ?? null;
    if (!resourcePlantId && target?.warehouseId) {
      const warehouse = await this.dataSource.getRepository('warehouse').findOne({
        select: { plantId: true },
        where: { companyId, id: target.warehouseId, deleteYn: 'N' },
      }) as { plantId: string | null } | null;
      resourcePlantId = warehouse?.plantId ?? null;
    }
    return !!resourcePlantId && !!activePlantId && resourcePlantId === activePlantId;
  }

}
