/* =========================================================================
   모듈 코드 — 단일 소스 (DB role_detail.module_detail, 채번 ref_module과 동일)
   채번/권한(@Permission)/연계(ref_module)/회사 시드가 모두 이 enum을 참조한다.
   ========================================================================= */

/** 애플리케이션 모듈 코드 (2~3자) */
export enum AppModule {
  MDM = 'MDM',
  EQP = 'EQP',
  INV = 'INV',
  STK = 'STK',
  PM = 'PM',
  WO = 'WO',
  WP = 'WP',
  APR = 'APR',
  BRD = 'BRD',
  PUR = 'PUR',
}

export const AppModuleLabel: Record<AppModule, string> = {
  [AppModule.MDM]: '기준정보 설정',
  [AppModule.EQP]: '설비 마스터',
  [AppModule.INV]: '재고 마스터',
  [AppModule.STK]: '재고처리',
  [AppModule.PM]: '예방점검',
  [AppModule.WO]: '작업지시서',
  [AppModule.WP]: '작업허가서',
  [AppModule.APR]: '전자결재',
  [AppModule.BRD]: '게시판',
  [AppModule.PUR]: '구매',
};

/** 결재 연계 가능한 모듈 (approval.ref_module 후보) — AppModule의 부분집합 */
export const LINKABLE_MODULES = [
  AppModule.PUR,
  AppModule.WO,
  AppModule.WP,
  AppModule.PM,
] as const;
export type LinkableModule = (typeof LINKABLE_MODULES)[number];
