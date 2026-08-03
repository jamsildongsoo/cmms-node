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
import { PermAction } from '../constants/permission.constants';
import { User } from '../../entities/users.entity';
import { RoleDetail } from '../../entities/role-detail.entity';

export type { PermAction };

// 컨트롤러와 메서드에 권한 검사 조건을 메타데이터로 등록한다.
export const PERMISSION_KEY = 'permission';
export const Permission = (module: AppModule, action: PermAction) =>
  SetMetadata(PERMISSION_KEY, { module, action });

// 아래 메타데이터는 Guard의 기본 deny-all 정책에서 허용되는 특수 API를 표시한다.
export const REF_PERMISSION_KEY = 'ref_permission';
export const RefPermission = () => SetMetadata(REF_PERMISSION_KEY, true);

export const WORKFLOW_PERMISSION_KEY = 'workflow_permission';
export const WorkflowPermission = () => SetMetadata(WORKFLOW_PERMISSION_KEY, true);

export const SYSTEM_PERMISSION_KEY = 'system_permission';
export const SystemPermission = () => SetMetadata(SYSTEM_PERMISSION_KEY, true);

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
    // 권한 메타데이터 종류:
    // - @Permission: 역할별 모듈 권한(C/R/U/D/A)을 이 Guard에서 검사
    // - @WorkflowPermission: 결재선·소유자·문서상태를 서비스에서 검사
    // - @RefPermission: 참조 조회 API. 세부 접근 조건은 서비스에서 검사
    const perm = this.reflector.getAllAndOverride<{
      module: string;
      action: PermAction;
    }>(PERMISSION_KEY, [ctx.getHandler(), ctx.getClass()]);
    const isRefApi = this.reflector.getAllAndOverride<boolean>(
      REF_PERMISSION_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    const isWorkflowApi = this.reflector.getAllAndOverride<boolean>(
      WORKFLOW_PERMISSION_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    const isSystemApi = this.reflector.getAllAndOverride<boolean>(
      SYSTEM_PERMISSION_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );

    // 기본은 deny-all이다. 명시적인 권한이 없는 API는 허용된 예외만 통과시킨다.
    if (!perm) {
      if (isRefApi || isWorkflowApi) return true;
      if (isSystemApi) {
        const req = ctx.switchToHttp().getRequest();
        const user = req.user as JwtPayload;
        if (!user) {
          throw new ForbiddenException('요청을 처리할 사용자 권한 정보가 없습니다.');
        }
        if (user.roleId.toUpperCase() !== 'SYSTEM' || user.companyId !== 'SYSTEM') {
          throw new ForbiddenException('SYSTEM 권한이 필요합니다.');
        }
        const systemUser = await this.dataSource.getRepository(User).findOne({
          select: { roleId: true },
          where: {
            companyId: 'SYSTEM',
            id: user.userId,
            deleteYn: 'N',
          },
        });
        if (systemUser?.roleId !== 'SYSTEM') {
          throw new ForbiddenException('SYSTEM 관리자 권한을 확인할 수 없습니다.');
        }
        return true;
      }
      throw new ForbiddenException('권한 정책이 지정되지 않은 API입니다.');
    }

    const req = ctx.switchToHttp().getRequest();
    const user = req.user as JwtPayload;
    if (!user) {
      throw new ForbiddenException('요청을 처리할 사용자 권한 정보가 없습니다.');
    }

    // SYSTEM 역할은 모듈 매트릭스를 우회하지만, 실제 SYSTEM 사용자 여부는 DB로 재검증한다.
    if (user.roleId.toUpperCase() === 'SYSTEM') {
      if (user.companyId !== 'SYSTEM') {
        throw new ForbiddenException('SYSTEM 역할의 회사 정보가 올바르지 않습니다.');
      }
      const systemUser = await this.dataSource.getRepository(User).findOne({
        select: { roleId: true },
        where: {
          companyId: 'SYSTEM',
          id: user.userId,
          deleteYn: 'N',
        },
      });
      if (systemUser?.roleId !== 'SYSTEM') {
        throw new ForbiddenException('SYSTEM 관리자 권한을 확인할 수 없습니다.');
      }
      return true;
    }

    // 일반 사용자는 회사·역할·모듈·행위 조합으로 RoleDetail을 검사한다.
    const hasAction = await this.checkMatrix(
      user.companyId, user.roleId, perm.module, perm.action,
    );
    if (!hasAction) {
      throw this.permissionException(perm.module, perm.action);
    }

    return true;
  }

  private permissionException(module: string, action: PermAction): ForbiddenException {
    return new ForbiddenException(`${this.moduleLabel(module)} ${ACTION_LABEL[action]} 권한이 없습니다.`);
  }

  // 내부 모듈 코드를 사용자에게 표시할 한글 모듈명으로 변환한다.
  private moduleLabel(module: string): string {
    return AppModuleLabel[module as AppModule] ?? module;
  }

  private async checkMatrix(
    companyId: string, roleId: string, module: string, action: PermAction,
  ): Promise<boolean> {
    // 회사·역할·모듈에 해당하는 권한 행을 조회한 뒤 요청 행위의 허용 여부를 확인한다.
    const permission = await this.dataSource.getRepository(RoleDetail).findOne({
      where: { companyId, roleId, moduleDetail: module },
    });
    if (!permission) return false;

    // 행위 코드(C/R/U/D/A)를 RoleDetail의 실제 권한 컬럼으로 매핑한다.
    const actionProperty: Record<PermAction, keyof RoleDetail> = {
      C: 'permC',
      R: 'permR',
      U: 'permU',
      D: 'permD',
      A: 'permA',
    };
    return permission[actionProperty[action]] === 'Y';
  }
}
