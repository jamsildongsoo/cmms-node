export type ModuleAccess = {
  permC?: 'Y' | 'N';
  permR?: 'Y' | 'N';
  permU?: 'Y' | 'N';
  permD?: 'Y' | 'N';
  permA?: 'Y' | 'N';
};

export type ModuleAccessMap = Record<string, ModuleAccess>;

export const hasModuleRead = (access: ModuleAccessMap | undefined, moduleCode: string): boolean =>
  access?.[moduleCode]?.permR === 'Y';

export const hasModuleManage = (access: ModuleAccessMap | undefined, moduleCode: string): boolean =>
  access?.[moduleCode]?.permC === 'Y';
