/* =========================================================================
   PermissionGuard — RBAC 권한 검사
   Spring의 @PreAuthorize("@perm.check('WO','C')") 대응
   ========================================================================= */
import {
  Injectable, CanActivate, ExecutionContext, SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { JwtPayload } from '../../modules/auth/auth.interfaces';
import { AppModule } from '../constants/module.constants';
import { PermAction, PERM_COLUMN } from '../constants/permission.constants';
import { DocStatus } from '../constants/status.constants';

export type { PermAction };

export const PERMISSION_KEY = 'permission';
export const Permission = (module: AppModule, action: PermAction) =>
  SetMetadata(PERMISSION_KEY, { module, action });

/** checkSave: C 권한 필수, status='S'면 A 권한도 필수 (결재 우회 확정) */
export const PermissionSave = (module: AppModule, statusParam?: string) =>
  SetMetadata(PERMISSION_KEY, { module, action: 'C', saveMode: true, statusParam });

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly dataSource: DataSource,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const perm = this.reflector.getAllAndOverride<{
      module: string;
      action: PermAction;
      saveMode?: boolean;
      statusParam?: string;
    }>(PERMISSION_KEY, [ctx.getHandler(), ctx.getClass()]);

    if (!perm) return true; // 메타데이터 없으면 통과 (JwtAuthGuard만 적용)

    const req = ctx.switchToHttp().getRequest();
    const user = req.user as JwtPayload;
    if (!user) return false;

    // SYSTEM 역할은 전 모듈 통과 (테넌트 결속 + 서버 재검증)
    if (user.roleId.toUpperCase() === 'SYSTEM') {
      if (user.companyId !== 'SYSTEM') return false;
      const dbUsers = await this.dataSource.query(
        `SELECT role_id FROM users WHERE company_id = 'SYSTEM' AND id = $1 AND delete_yn = 'N'`,
        [user.userId]
      );
      return dbUsers.length > 0 && dbUsers[0].role_id === 'SYSTEM';
    }

    // 기본 권한 체크
    const hasAction = await this.checkMatrix(
      user.companyId, user.roleId, perm.module, perm.action,
    );
    if (!hasAction) return false;

    // saveMode: status='S'면 A 권한 추가 확인
    if (perm.saveMode && perm.statusParam) {
      const status = req.body?.header?.status ?? req.body?.status ?? req.query?.status;
      if (status === DocStatus.SELF_CONFIRMED) {
        return this.checkMatrix(user.companyId, user.roleId, perm.module, 'A');
      }
    }

    return true;
  }

  private async checkMatrix(
    companyId: string, roleId: string, module: string, action: PermAction,
  ): Promise<boolean> {
    const colName = PERM_COLUMN[action];
    const rows = await this.dataSource.query(
      `SELECT ${colName} FROM role_detail
       WHERE company_id = $1 AND role_id = $2 AND module_detail = $3`,
      [companyId, roleId, module],
    );
    return rows[0]?.[colName] === 'Y';
  }
}
