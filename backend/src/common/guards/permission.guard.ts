/* =========================================================================
   PermissionGuard — RBAC 권한 검사
   Spring의 @PreAuthorize("@perm.check('WO','C')") 대응
   ========================================================================= */
import {
  Injectable, CanActivate, ExecutionContext, SetMetadata, ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtPayload } from '../../modules/auth/auth.interfaces';
import { AppModule } from '../constants/module.constants';
import { DepartmentAccessService } from '../permissions/department-access.service';
import type { PermAction } from '../constants/permission.constants';

// 컨트롤러와 메서드에 권한 검사 조건을 메타데이터로 등록한다.
export const MODULE_ACCESS_KEY = 'module_access';
export const ModuleAccess = (module: AppModule) =>
  SetMetadata(MODULE_ACCESS_KEY, { module });
export const ModulePermission = (module: AppModule, action: PermAction) =>
  SetMetadata(MODULE_ACCESS_KEY, { module, action });

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly departmentAccessService: DepartmentAccessService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const moduleAccess = this.reflector.getAllAndOverride<{
      module: AppModule;
      action?: PermAction;
    }>(MODULE_ACCESS_KEY, [ctx.getHandler(), ctx.getClass()]);
    // 기본은 deny-all이다. 명시적인 권한이 없는 API는 허용된 예외만 통과시킨다.
    if (!moduleAccess) {
      throw new ForbiddenException('권한 정책이 지정되지 않은 API입니다.');
    }

    const req = ctx.switchToHttp().getRequest();
    const user = req.user as JwtPayload;
    if (!user) {
      throw new ForbiddenException('요청을 처리할 사용자 권한 정보가 없습니다.');
    }

    if (moduleAccess) {
      const action = moduleAccess.action ?? this.actionForMethod(req.method);
      await this.departmentAccessService.assertAction(
        user.companyId,
        user.userId,
        moduleAccess.module,
        action,
      );
      return true;
    }

    throw new ForbiddenException('권한 정책이 지정되지 않은 API입니다.');
  }

  private actionForMethod(method: string): PermAction {
    switch (method.toUpperCase()) {
      case 'GET': return 'R';
      case 'POST': return 'C';
      case 'PUT':
      case 'PATCH': return 'U';
      case 'DELETE': return 'D';
      default: throw new ForbiddenException('지원하지 않는 HTTP 메서드입니다.');
    }
  }
}
