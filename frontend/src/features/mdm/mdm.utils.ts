import type { MdmPermission } from './mdm.types';

export interface MdmCapabilities {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export interface MdmManagerProps extends MdmCapabilities {
  notify: (type: 'success' | 'error', text: string) => void;
}

export const getMdmCapabilities = (
  permission?: MdmPermission,
): MdmCapabilities => ({
  canCreate: permission?.C === 'Y',
  canUpdate: permission?.U === 'Y',
  canDelete: permission?.D === 'Y',
});
