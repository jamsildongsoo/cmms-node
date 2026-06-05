/* =========================================================================
   AsyncLocalStorage 기반 멀티테넌트 요청 컨텍스트
   Spring의 ThreadLocal + SecurityContextHolder 역할 대체
   ========================================================================= */
import { AsyncLocalStorage } from 'async_hooks';

export interface TenantContext {
  companyId: string;
  userId: string;
  roleId: string;
  departmentId: string | null;
}

/** 요청 수명 동안 컨텍스트를 보유하는 AsyncLocalStorage 인스턴스 */
export const tenantStorage = new AsyncLocalStorage<TenantContext>();

/** 현재 요청의 TenantContext 반환. 인증된 요청 외부에서 호출 시 throw */
export function getTenantContext(): TenantContext {
  const ctx = tenantStorage.getStore();
  if (!ctx) {
    throw new Error('TenantContext is not available outside of a request scope');
  }
  return ctx;
}
