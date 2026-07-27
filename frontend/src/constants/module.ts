/**
 * BE 모듈 상수의 FE 미러.
 *
 * 단일 원천: backend/src/common/constants/module.constants.ts
 * FE 컴포넌트와 API 요청에서 문자열 오타를 방지하기 위한 개발 편의용 복제본이다.
 */
export const APP_MODULE = {
  MDM: 'MDM',
  EQP: 'EQP',
  INV: 'INV',
  STK: 'STK',
  PM: 'PM',
  WO: 'WO',
  WP: 'WP',
  APR: 'APR',
  BRD: 'BRD',
  PUR: 'PUR',
} as const;

export type AppModule = (typeof APP_MODULE)[keyof typeof APP_MODULE];

export const LINKABLE_MODULES = [
  APP_MODULE.WO,
  APP_MODULE.WP,
  APP_MODULE.PM,
  APP_MODULE.PUR,
] as const;

export type LinkableModule = (typeof LINKABLE_MODULES)[number];
