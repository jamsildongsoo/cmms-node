/* =========================================================================
   JWT 공유 인터페이스 — B안 확정
   페이로드에 roleId, departmentId, homePlantId 포함
   → 매 요청 DB 조회 없이 TenantContext 구성 가능
   ========================================================================= */

/** JWT 서명 페이로드 (토큰에 실제로 담기는 값) */
export interface JwtPayload {
  /** "companyId:userId" — Spring 호환 sub 포맷 유지 */
  sub: string;
  companyId: string;
  userId: string;
  roleId: string;
  scope: 'COMPANY' | 'PLANT';
  departmentId: string | null;
  homePlantId: string | null;
  iat?: number;
  exp?: number;
}

export interface RefreshJwtPayload {
  sub: string;
  companyId: string;
  userId: string;
  sessionId: string;
  type: 'refresh';
  iat?: number;
  exp?: number;
}

/**
 * 로그인 응답 — FE useAuthStore가 기대하는 정확한 구조
 * useAuthStore.ts:58-71 참조
 */
export interface LoginResponse {
  accessToken: string;
  companyId: string;
  companyName: string;
  id: string;
  name: string;
  avatarKey: string;
  roleId: string;
  scope: 'COMPANY' | 'PLANT';
  departmentId: string | null;
  position: string | null;
  title: string | null;
  homePlantId: string | null;
  mustChangePassword: boolean;
  passwordExpired: boolean;
  moduleAccess: Record<string, { permC: 'Y' | 'N'; permR: 'Y' | 'N'; permU: 'Y' | 'N'; permD: 'Y' | 'N'; permA: 'Y' | 'N' }>;
}

/** 사용자 프로필 응답 */
export interface UserProfileResponse {
  companyId: string;
  id: string;
  name: string;
  avatarKey: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  title: string | null;
  departmentId: string | null;
  roleId: string;
  scope: 'COMPANY' | 'PLANT';
  homePlantId: string | null;
  mustChangePassword: boolean;
}
