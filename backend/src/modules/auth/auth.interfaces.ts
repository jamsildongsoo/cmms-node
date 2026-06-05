/* =========================================================================
   JWT 공유 인터페이스 — B안 확정
   페이로드에 roleId, departmentId, lastLoginPlantId 포함
   → 매 요청 DB 조회 없이 TenantContext 구성 가능
   ========================================================================= */

/** JWT 서명 페이로드 (토큰에 실제로 담기는 값) */
export interface JwtPayload {
  /** "companyId:userId" — Spring 호환 sub 포맷 유지 */
  sub: string;
  companyId: string;
  userId: string;
  roleId: string;
  departmentId: string | null;
  lastLoginPlantId: string | null;
  multiPlant: 'Y' | 'N';
  iat?: number;
  exp?: number;
}

/** 로그인 요청 */
export interface LoginRequest {
  companyId: string;
  id: string;
  password: string;
}

/** 회원가입 요청 */
export interface SignUpRequest {
  companyId: string;
  id: string;
  name: string;
  password: string;
  departmentId?: string;
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
  roleId: string;
  departmentId: string | null;
  position: string | null;
  title: string | null;
  lastLoginPlantId: string | null;
  /** 역할의 multi_plant 값 — Header 플랜트 셀렉터 표시 여부 */
  multiPlant: 'Y' | 'N';
  mustChangePassword: boolean;
  passwordExpired: boolean;
}

/** 비밀번호 변경 요청 */
export interface PasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
}

/** 사용자 프로필 수정 요청 */
export interface UserUpdateRequest {
  name?: string;
  email?: string;
  phone?: string;
  position?: string;
  title?: string;
}

/** 사용자 프로필 응답 */
export interface UserProfileResponse {
  companyId: string;
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  title: string | null;
  departmentId: string | null;
  roleId: string;
  lastLoginPlantId: string | null;
  multiPlant: 'Y' | 'N';
  mustChangePassword: boolean;
}
