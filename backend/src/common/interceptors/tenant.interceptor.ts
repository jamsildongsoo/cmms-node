/* =========================================================================
   TenantInterceptor — JWT 페이로드에서 직접 TenantContext 구성 (B안)
   
   [B안 확정] JwtStrategy.validate()가 req.user에 JwtPayload 저장.
   DB 조회 없이 페이로드 클레임만으로 TenantContext 완성.
   
   Spring 대응:
     JwtAuthenticationFilter → SecurityContextHolder → 각 서비스에서 @AuthenticationPrincipal
   
   Node.js:
     JwtAuthGuard → req.user(JwtPayload) → TenantInterceptor → AsyncLocalStorage
     → 모든 서비스에서 getTenantContext() 호출
   ========================================================================= */
import {
  Injectable, NestInterceptor, ExecutionContext, CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tenantStorage, TenantContext } from '../context/tenant.context';
import { JwtPayload } from '../../modules/auth/auth.interfaces';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    const req = ctx.switchToHttp().getRequest<{ user?: JwtPayload; headers: Record<string, string> }>();
    const user = req.user; // JwtAuthGuard(AuthGuard('jwt'))가 먼저 실행

    if (!user) return next.handle(); // 공개 엔드포인트 (login, signup)

    const context: TenantContext = {
      companyId: user.companyId,
      userId: user.userId,
      roleId: user.roleId,
      departmentId: user.departmentId ?? null,
    };

    return new Observable((subscriber) => {
      tenantStorage.run(context, () => {
        next.handle().subscribe({
          next: (v) => subscriber.next(v),
          error: (e) => subscriber.error(e),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}
