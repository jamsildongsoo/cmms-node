import { useEffect, useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import { mdmMetaApi, roleApi } from '../mdm.api';
import type { ModuleMetadata, Role, RoleDetail, YesNo } from '../mdm.types';
import type { MdmManagerProps } from '../mdm.utils';

const ACTIONS = ['C', 'R', 'U', 'D', 'A'] as const;
type Action = typeof ACTIONS[number];

const emptyDetail = (roleId: string, moduleDetail: string): RoleDetail => ({
  roleId, moduleDetail, permC: 'N', permR: 'N', permU: 'N', permD: 'N', permA: 'N',
});

export default function RolePermissionManager({ notify, canUpdate }: MdmManagerProps) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [modules, setModules] = useState<ModuleMetadata[]>([]);
  const [roleId, setRoleId] = useState('');
  const [details, setDetails] = useState<Record<string, RoleDetail>>({});

  const load = async (selectedRoleId: string) => {
    if (!selectedRoleId) return;
    try {
      const rows = await roleApi.getDetails(selectedRoleId);
      setDetails(Object.fromEntries(rows.map((row) => [row.moduleDetail, row])));
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'Role 권한 조회에 실패했습니다.');
    }
  };

  useEffect(() => {
    Promise.all([roleApi.getAll(), mdmMetaApi.getModules()]).then(([loadedRoles, loadedModules]) => {
      setRoles(loadedRoles);
      setModules(loadedModules);
      const first = loadedRoles[0]?.id ?? '';
      setRoleId(first);
      if (first) void load(first);
    }).catch(() => notify('error', 'Role 권한 화면을 불러오지 못했습니다.'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notify]);

  const orderedModules = useMemo(() => modules.filter((module) => module.code !== 'APR'), [modules]);
  const update = (moduleDetail: string, action: Action, value: YesNo) => {
    const property = `perm${action}` as keyof Pick<RoleDetail, 'permC' | 'permR' | 'permU' | 'permD' | 'permA'>;
    setDetails((current) => ({
      ...current,
      [moduleDetail]: { ...(current[moduleDetail] ?? emptyDetail(roleId, moduleDetail)), [property]: value },
    }));
  };

  const save = async () => {
    if (!roleId || !canUpdate) return;
    try {
      await roleApi.saveDetails(roleId, Object.values(details));
      notify('success', 'Role 권한이 저장되었습니다.');
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'Role 권한 저장에 실패했습니다.');
    }
  };

  return <div className="space-y-4">
    <div className="flex items-center justify-between gap-3">
      <div><h3 className="text-sm font-bold text-slate-200">Role 권한</h3><p className="mt-1 text-xs text-slate-500">Role별 모듈 C/R/U/D 권한을 설정합니다.</p></div>
      <div className="flex items-center gap-2">
        <select value={roleId} onChange={(event) => { setRoleId(event.target.value); void load(event.target.value); }} className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200">
          {roles.map((role) => <option key={role.id} value={role.id}>{role.roleName} ({role.id})</option>)}
        </select>
        <button type="button" disabled={!canUpdate} onClick={() => void save()} className="flex items-center gap-1.5 rounded-lg border-0 bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"><Save size={13} /> 저장</button>
      </div>
    </div>
    <div className="overflow-x-auto rounded-lg border border-slate-800"><table className="w-full text-xs"><thead className="bg-slate-950 text-slate-400"><tr><th className="px-3 py-2 text-left">모듈</th>{ACTIONS.map((action) => <th key={action} className="px-3 py-2 text-center">{action}</th>)}</tr></thead><tbody>
      {orderedModules.map((module) => { const detail = details[module.code] ?? emptyDetail(roleId, module.code); return <tr key={module.code} className="border-t border-slate-800 text-slate-300"><td className="px-3 py-2">{module.label} ({module.code})</td>{ACTIONS.map((action) => { const property = `perm${action}` as keyof Pick<RoleDetail, 'permC' | 'permR' | 'permU' | 'permD' | 'permA'>; return <td key={action} className="px-3 py-2 text-center"><input type="checkbox" disabled={!canUpdate} checked={detail[property] === 'Y'} onChange={(event) => update(module.code, action, event.target.checked ? 'Y' : 'N')} /></td>; })}</tr>; })}
    </tbody></table></div>
  </div>;
}
