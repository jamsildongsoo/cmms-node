import { hasModuleCreate, hasModuleDelete, hasModuleUpdate } from '../../utils/moduleAccess';
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
  canCreate: hasModuleCreate(access, 'MDM'),
  canUpdate: hasModuleUpdate(access, 'MDM'),
  canDelete: hasModuleDelete(access, 'MDM'),
});
