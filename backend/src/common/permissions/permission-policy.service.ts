import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RoleDetail } from '../../entities/role-detail.entity';
import { AppModule } from '../constants/module.constants';
import { DocStatus } from '../constants/status.constants';

@Injectable()
export class PermissionPolicyService {
  constructor(private readonly dataSource: DataSource) {}

  async assertModulePermission(
    companyId: string,
    roleId: string,
    module: AppModule,
    action: 'U' | 'D',
    resourceLabel: string,
  ): Promise<void> {
    const permission = await this.dataSource.getRepository(RoleDetail).findOne({
      where: { companyId, roleId, moduleDetail: module },
    });
    const allowed = action === 'U' ? permission?.permU === 'Y' : permission?.permD === 'Y';
    if (!allowed) {
      throw new ForbiddenException(`${resourceLabel} ${action === 'U' ? '수정' : '삭제'} 권한이 없습니다.`);
    }
  }

  async assertCanUpdateOwnTempOrPermission(params: {
    companyId: string;
    roleId: string;
    module: AppModule;
    status: string | null | undefined;
    ownerId: string | null | undefined;
    operatorId: string;
    resourceLabel: string;
  }): Promise<boolean> {
    return this.assertCanMutateOwnTempOrPermission({ ...params, action: 'U' });
  }

  async assertCanDeleteOwnTempOrPermission(params: {
    companyId: string;
    roleId: string;
    module: AppModule;
    status: string | null | undefined;
    ownerId: string | null | undefined;
    operatorId: string;
    resourceLabel: string;
  }): Promise<boolean> {
    return this.assertCanMutateOwnTempOrPermission({ ...params, action: 'D' });
  }

  private async assertCanMutateOwnTempOrPermission(params: {
    companyId: string;
    roleId: string;
    module: AppModule;
    // mutate = U/D (update/delete) 공통 처리
    action: 'U' | 'D';
    status: string | null | undefined;
    ownerId: string | null | undefined;
    operatorId: string;
    resourceLabel: string;
  }): Promise<boolean> {
    const isOwnTemp = params.status === DocStatus.TEMP && params.ownerId === params.operatorId;
    if (isOwnTemp) return true;
    await this.assertModulePermission(
      params.companyId,
      params.roleId,
      params.module,
      params.action,
      params.resourceLabel,
    );
    return false;
  }
}
