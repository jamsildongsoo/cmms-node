export type ModuleAccess = {
  permC?: 'Y' | 'N';
  permR?: 'Y' | 'N';
  permU?: 'Y' | 'N';
  permD?: 'Y' | 'N';
  permA?: 'Y' | 'N';
};

export type ModuleAccessMap = Record<string, ModuleAccess>;

export type ModuleAction = 'C' | 'R' | 'U' | 'D' | 'A';

/** 화면 버튼용 모듈 행위 권한 검사. 실제 권한은 백엔드에서 다시 검사한다. */
export const hasModuleAction = (
  access: ModuleAccessMap | undefined,
  moduleCode: string,
  action: ModuleAction,
): boolean => access?.[moduleCode]?.[`perm${action}`] === 'Y';

export const hasModuleCreate = (access: ModuleAccessMap | undefined, moduleCode: string): boolean =>
  hasModuleAction(access, moduleCode, 'C');

export const hasModuleRead = (access: ModuleAccessMap | undefined, moduleCode: string): boolean =>
  hasModuleAction(access, moduleCode, 'R');

export const hasModuleUpdate = (access: ModuleAccessMap | undefined, moduleCode: string): boolean =>
  hasModuleAction(access, moduleCode, 'U');

export const hasModuleDelete = (access: ModuleAccessMap | undefined, moduleCode: string): boolean =>
  hasModuleAction(access, moduleCode, 'D');
