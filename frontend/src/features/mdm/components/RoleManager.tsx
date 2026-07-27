import { useEffect, useState } from 'react';
import { Check, Edit2, Save, Shield, Trash2, X } from 'lucide-react';
import ListIconButton from '../../../components/ListIconButton';
import { getApiErrorMessage } from '../../../utils/apiError';
import { requestConfirmation } from '../../../utils/userActionDialog';
import { mdmMetaApi, roleApi } from '../mdm.api';
import type { PermissionAction, Role, RoleDetail } from '../mdm.types';
import type { MdmManagerProps } from '../mdm.utils';

export default function RoleManager({ notify, canCreate, canUpdate, canDelete }: MdmManagerProps) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [details, setDetails] = useState<RoleDetail[]>([]);
  const [newRoleId, setNewRoleId] = useState('');
  const [newRoleName, setNewRoleName] = useState('');
  const [newMultiPlant, setNewMultiPlant] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  // 모듈 라벨 — BE /api/meta/modules 단일 소스(AppModule.label())
  const [moduleLabels, setModuleLabels] = useState<Record<string, string>>({});
  useEffect(() => {
    mdmMetaApi.getModules()
      .then((modules) => {
        const map: Record<string, string> = {};
        modules.forEach((module) => {
          map[module.code] = module.label;
        });
        setModuleLabels(map);
      })
      .catch(() => {});
  }, []);

  const fetchRoles = async () => {
    try {
      const loadedRoles = await roleApi.getAll();
      setRoles(loadedRoles);
      setSelectedRoleId((current) =>
        loadedRoles.some((role) => role.id === current)
          ? current
          : loadedRoles[0]?.id ?? null,
      );
    } catch (err) {
      notify('error', getApiErrorMessage(err, '권한 목록 조회 실패.'));
    }
  };

  const fetchDetails = async (roleId: string) => {
    try {
      setDetails(await roleApi.getDetails(roleId));
    } catch (err) {
      notify('error', getApiErrorMessage(err, '상세 권한 매트릭스를 불러오지 못했습니다.'));
    }
  };

  useEffect(() => {
    let active = true;
    void roleApi.getAll()
      .then((loadedRoles) => {
        if (!active) return;
        setRoles(loadedRoles);
        setSelectedRoleId(loadedRoles[0]?.id ?? null);
      })
      .catch((err) => {
        if (active) notify('error', getApiErrorMessage(err, '권한 목록 조회 실패.'));
      });
    return () => { active = false; };
  }, [notify]);
  useEffect(() => {
    if (!selectedRoleId) return;
    let active = true;
    void roleApi.getDetails(selectedRoleId)
      .then((loaded) => { if (active) setDetails(loaded); })
      .catch((err) => {
        if (active) notify('error', getApiErrorMessage(err, '상세 권한 매트릭스를 불러오지 못했습니다.'));
      });
    return () => { active = false; };
  }, [notify, selectedRoleId]);

  const resetRoleForm = () => {
    setNewRoleId('');
    setNewRoleName('');
    setNewMultiPlant(false);
    setEditingRoleId(null);
  };

  const handleRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleId || !newRoleName) return;
    try {
      const payload: Partial<Role> = {
        id: newRoleId.toUpperCase(),
        roleName: newRoleName,
        multiPlant: newMultiPlant ? 'Y' : 'N',
      };
      if (editingRoleId) {
        await roleApi.update(editingRoleId, payload);
        notify('success', '권한 그룹이 수정되었습니다.');
      } else {
        await roleApi.create(payload);
        notify('success', '새로운 권한 그룹이 추가되었습니다.');
      }
      resetRoleForm();
      await fetchRoles();
    } catch (err) {
      notify('error', getApiErrorMessage(err, '권한 그룹 저장 실패.'));
    }
  };

  const handleEditRole = (role: Role) => {
    setEditingRoleId(role.id);
    setNewRoleId(role.id);
    setNewRoleName(role.roleName);
    setNewMultiPlant(role.multiPlant === 'Y');
  };

  const handleDeleteRole = async (role: Role) => {
    if (!(await requestConfirmation(`${role.roleName} 권한 그룹을 삭제하시겠습니까?`))) return;
    try {
      await roleApi.delete(role.id);
      notify('success', '권한 그룹이 삭제되었습니다.');
      if (editingRoleId === role.id) resetRoleForm();
      if (selectedRoleId === role.id) {
        setSelectedRoleId(null);
        setDetails([]);
      }
      await fetchRoles();
    } catch (err) {
      notify('error', getApiErrorMessage(err, '권한 그룹 삭제 실패.'));
    }
  };

  const handleTogglePerm = (module: string, type: PermissionAction) => {
    setDetails(prev => prev.map(d => {
      if (d.moduleDetail === module) {
        const key = `perm${type}` as keyof RoleDetail;
        return {
          ...d,
          [key]: d[key] === 'Y' ? 'N' : 'Y'
        };
      }
      return d;
    }));
  };

  const handleSaveMatrix = async () => {
    if (!selectedRoleId) return;
    try {
      await roleApi.saveDetails(selectedRoleId, details);
      notify('success', '권한 제어 매트릭스가 저장되었습니다.');
      fetchDetails(selectedRoleId);
    } catch (err) {
      notify('error', getApiErrorMessage(err, '매트릭스 저장 중 오류가 발생했습니다.'));
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Role list and creation */}
      <div className="space-y-6">
        {(canCreate || editingRoleId) && <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
            <Shield size={14} className="text-blue-500" />
            {editingRoleId ? '권한그룹 수정' : '새 권한그룹 추가'}
          </h3>
          <form onSubmit={handleRoleSubmit} className="space-y-4">
            <div>
              <label className="block text-slate-400 text-xs mb-1.5">권한 코드</label>
              <input
                type="text"
                required
                disabled={!!editingRoleId}
                value={newRoleId}
                onChange={(e) => setNewRoleId(e.target.value)}
                placeholder="예: MANAGER_QA"
                className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 text-xs outline-none transition-colors disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1.5">권한 이름</label>
              <input
                type="text"
                required
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="예: 품질관리부서장"
                className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 text-xs outline-none transition-colors"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={newMultiPlant}
                onChange={(e) => setNewMultiPlant(e.target.checked)}
              />
              멀티 플랜트 권한 (전체 플랜트 조회·전환)
            </label>
            <div className="flex gap-2">
              {editingRoleId && (
                <button
                  type="button"
                  onClick={resetRoleForm}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg py-2 text-xs font-semibold cursor-pointer border-0"
                >
                  취소
                </button>
              )}
              <button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 text-xs font-semibold transition-colors cursor-pointer border-0"
              >
                {editingRoleId ? '수정' : '추가'}
              </button>
            </div>
          </form>
        </div>}

        {/* Roles list */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">권한 그룹 선택</h3>
          <div className="space-y-1">
            {roles.map(r => (
              <div
                key={r.id}
                className={`flex items-center rounded-lg border transition-colors ${
                  selectedRoleId === r.id
                    ? 'bg-blue-600/10 border-blue-500/30 text-blue-400'
                    : 'bg-slate-950/40 border-slate-900 text-slate-400 hover:bg-slate-800/40'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedRoleId(r.id)}
                  className="min-w-0 flex-1 bg-transparent border-0 text-left px-4 py-2.5 text-xs font-semibold text-inherit cursor-pointer"
                >
                  {r.roleName} ({r.id})
                  {r.multiPlant === 'Y' && <span className="ml-2 px-1.5 py-0.5 rounded bg-emerald-950/40 border border-emerald-900/60 text-emerald-400 text-[9px] font-bold">멀티</span>}
                </button>
                <div className="flex items-center gap-1 pr-2">
                  {canUpdate && <ListIconButton
                    onClick={() => handleEditRole(r)}
                    label={`${r.roleName} 수정`}
                    icon={Edit2}
                    tone="accent"
                  />}
                  {canDelete && <ListIconButton
                    onClick={() => void handleDeleteRole(r)}
                    label={`${r.roleName} 삭제`}
                    icon={Trash2}
                    tone="danger"
                  />}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Permission Detail matrix */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-200">
            [{roles.find(r => r.id === selectedRoleId)?.roleName || selectedRoleId}] 모듈 권한 제어 매트릭스
          </h3>
          {canUpdate && <button
            onClick={handleSaveMatrix}
            className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 px-4 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer border-0"
          >
            <Save size={13} />
            권한 저장
          </button>}
        </div>

        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 select-none">
                <th className="p-3.5 font-semibold">모듈명</th>
                <th className="p-3.5 font-semibold text-center">등록 (C)</th>
                <th className="p-3.5 font-semibold text-center">조회 (R)</th>
                <th className="p-3.5 font-semibold text-center">수정 (U)</th>
                <th className="p-3.5 font-semibold text-center">삭제 (D)</th>
                <th className="p-3.5 font-semibold text-center">직접확정 (A)</th>
              </tr>
            </thead>
            <tbody>
              {details.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-600">불러온 매트릭스가 없습니다.</td></tr>
              ) : (
                details.map(detail => (
                  <tr key={detail.moduleDetail} className="border-b border-slate-900 hover:bg-slate-900/30 text-slate-300">
                    <td className="p-3.5 font-semibold text-slate-200">
                      {moduleLabels[detail.moduleDetail] || detail.moduleDetail}
                      <span className="text-[10px] text-slate-500 font-mono ml-2">({detail.moduleDetail})</span>
                    </td>
                    {(['C', 'R', 'U', 'D', 'A'] as const).map(type => {
                      const permKey = `perm${type}` as keyof RoleDetail;
                      const hasPerm = detail[permKey] === 'Y';
                      return (
                        <td key={type} className="p-3.5 text-center">
                          <button
                            type="button"
                            disabled={!canUpdate}
                            onClick={() => handleTogglePerm(detail.moduleDetail, type)}
                            className={`w-6 h-6 rounded flex items-center justify-center mx-auto transition-colors border cursor-pointer disabled:cursor-default disabled:opacity-60 ${
                              hasPerm 
                                ? 'bg-blue-600/10 border-blue-500/40 text-blue-400' 
                                : 'bg-slate-950 border-slate-800 text-slate-700 hover:border-slate-700'
                            }`}
                          >
                            {hasPerm ? <Check size={12} /> : <X size={12} />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
