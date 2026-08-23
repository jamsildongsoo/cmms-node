/* =========================================================================
   권한 코드 — 단일 소스
   ========================================================================= */

/**
 * 권한 액션 (role_detail.perm_c/r/u/d/a)
 * A는 직접확정 등 모듈별 확장 업무 action에 사용한다. 승인권한이 아니며, 결재연계모듈 연계없어 직접 확정 시 사용한다.
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
