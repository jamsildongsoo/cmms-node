import { hasModuleManage } from '../../utils/moduleAccess';
import type { ModuleAccessMap } from '../../utils/moduleAccess';

export interface MdmCapabilities {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export interface MdmManagerProps extends MdmCapabilities {
  notify: (type: 'success' | 'error', text: string) => void;
}

export const getMdmCapabilities = (access?: ModuleAccessMap): MdmCapabilities => ({
  canCreate: hasModuleManage(access, 'MDM'),
  canUpdate: hasModuleManage(access, 'MDM'),
  canDelete: hasModuleManage(access, 'MDM'),
});
