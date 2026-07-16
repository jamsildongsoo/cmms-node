/* =========================================================================
   권한 코드 — 단일 소스
   ========================================================================= */

/**
 * 권한 액션 (role_detail.perm_c/r/u/d/a)
 * A = 결재/직접확정 우회 권한. A가 없으면 status='S'(직접확정) 불가 → 결재 상신 강제.
 */
export type PermAction = 'C' | 'R' | 'U' | 'D' | 'A';

export const PERM_ACTIONS: readonly PermAction[] = ['C', 'R', 'U', 'D', 'A'];

/** 액션 → role_detail 컬럼명 화이트리스트 (SQL 컬럼명 보간 방지) */
export const PERM_COLUMN: Record<PermAction, string> = {
  C: 'perm_c',
  R: 'perm_r',
  U: 'perm_u',
  D: 'perm_d',
  A: 'perm_a',
};
