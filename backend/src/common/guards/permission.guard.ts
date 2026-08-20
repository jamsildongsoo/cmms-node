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
import { UserAccessService } from '../permissions/user-access.service';
import type { PermAction } from '../constants/permission.constants';

// 컨트롤러와 메서드에 권한 검사 조건을 메타데이터로 등록한다.
export const MODULE_PERMISSION_KEY = 'module_permission';
export const ModulePermission = (module: AppModule, action: PermAction) =>
  SetMetadata(MODULE_PERMISSION_KEY, { module, action });

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly userAccessService: UserAccessService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const moduleAccess = this.reflector.getAllAndOverride<{
      module: AppModule;
      action: PermAction;
    }>(MODULE_PERMISSION_KEY, [ctx.getHandler(), ctx.getClass()]);
    // 기본은 deny-all이다. 모든 업무 API는 module과 C/R/U/D를 명시해야 한다.
    if (!moduleAccess) {
      throw new ForbiddenException('권한 정책이 지정되지 않은 API입니다.');
    }

    const req = ctx.switchToHttp().getRequest();
    const user = req.user as JwtPayload;
    if (!user) {
      throw new ForbiddenException('요청을 처리할 사용자 권한 정보가 없습니다.');
    }

    await this.userAccessService.assertAction(
      user.companyId,
      user.userId,
      moduleAccess.module,
      moduleAccess.action,
    );
    return true;
  }
}
