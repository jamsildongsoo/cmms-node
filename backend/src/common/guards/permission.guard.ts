/* =========================================================================
   PermissionGuard — RBAC 권한 검사
   Spring의 @PreAuthorize("@perm.check('WO','C')") 대응
   ========================================================================= */
import {
  Injectable, CanActivate, ExecutionContext, SetMetadata, ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { JwtPayload } from '../../modules/auth/auth.interfaces';
import { AppModule, AppModuleLabel } from '../constants/module.constants';
import { PermAction, PERM_COLUMN } from '../constants/permission.constants';
import { DocStatus } from '../constants/status.constants';

export type { PermAction };

export const PERMISSION_KEY = 'permission';
export const Permission = (module: AppModule, action: PermAction) =>
  SetMetadata(PERMISSION_KEY, { module, action });

/** checkSave: C 권한 필수, status='S'면 A 권한도 필수 (결재 우회 확정) */
export const PermissionSave = (module: AppModule, statusParam?: string) =>
  SetMetadata(PERMISSION_KEY, { module, action: 'C', saveMode: true, statusParam });

const ACTION_LABEL: Record<PermAction, string> = {
  C: '등록',
  R: '조회',
  U: '수정',
  D: '삭제',
  A: '승인',
};

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
    if (!user) {
      throw new ForbiddenException('요청을 처리할 사용자 권한 정보가 없습니다.');
    }

    // SYSTEM 역할은 전 모듈 통과 (테넌트 결속 + 서버 재검증)
    if (user.roleId.toUpperCase() === 'SYSTEM') {
      if (user.companyId !== 'SYSTEM') {
        throw new ForbiddenException('SYSTEM 역할의 회사 정보가 올바르지 않습니다.');
      }
      const dbUsers = await this.dataSource.query(
        `SELECT role_id FROM users WHERE company_id = 'SYSTEM' AND id = $1 AND delete_yn = 'N'`,
        [user.userId]
      );
      if (!dbUsers.length || dbUsers[0].role_id !== 'SYSTEM') {
        throw new ForbiddenException('SYSTEM 관리자 권한을 확인할 수 없습니다.');
      }
      return true;
    }

    // 기본 권한 체크
    const hasAction = await this.checkMatrix(
      user.companyId, user.roleId, perm.module, perm.action,
    );
    if (!hasAction) {
      throw this.permissionException(perm.module, perm.action);
    }

    // saveMode: status='S'면 A 권한 추가 확인
    if (perm.saveMode && perm.statusParam) {
      const status = this.readPath(req.body, perm.statusParam) ?? req.query?.status;
      if (status === DocStatus.SELF_CONFIRMED) {
        const canApprove = await this.checkMatrix(user.companyId, user.roleId, perm.module, 'A');
        if (!canApprove) {
          throw new ForbiddenException(`${this.moduleLabel(perm.module)} 직접확정 권한이 없습니다.`);
        }
      }
    }

    return true;
  }

  private permissionException(module: string, action: PermAction): ForbiddenException {
    return new ForbiddenException(`${this.moduleLabel(module)} ${ACTION_LABEL[action]} 권한이 없습니다.`);
  }

  private moduleLabel(module: string): string {
    return AppModuleLabel[module as AppModule] ?? module;
  }

  private readPath(source: unknown, path: string): unknown {
    return path.split('.').reduce<unknown>((value, key) => {
      if (!value || typeof value !== 'object') return undefined;
      return (value as Record<string, unknown>)[key];
    }, source);
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
