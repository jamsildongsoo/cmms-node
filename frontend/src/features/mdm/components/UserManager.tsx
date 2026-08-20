import { useCallback, useEffect, useState } from 'react';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import ListBadge from '../../../components/ListBadge';
import ListIconButton from '../../../components/ListIconButton';
import { getApiErrorMessage } from '../../../utils/apiError';
import { requestConfirmation } from '../../../utils/userActionDialog';
import { departmentApi, plantApi, roleApi, userApi } from '../mdm.api';
import type { Department, MdmUser, Plant, Role, YesNo } from '../mdm.types';
import type { MdmManagerProps } from '../mdm.utils';
import BoundedSelect from '../../../components/BoundedSelect';

export default function UserManager({
  notify,
  canCreate,
  canUpdate,
  canDelete,
  currentUserId,
}: MdmManagerProps & { currentUserId?: string }) {
  const [users, setUsers] = useState<MdmUser[]>([]);
  const [depts, setDepts] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);

  // User form states
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [scope, setScope] = useState<'COMPANY' | 'PLANT'>('PLANT');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [position, setPosition] = useState('');
  const [title, setTitle] = useState('');
  const [useYn, setUseYn] = useState<YesNo>('Y');
  const [homePlantId, setHomePlantId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    try {
      const [loadedUsers, loadedDepts, loadedRoles, loadedPlants] = await Promise.all([
        userApi.getAll(),
        departmentApi.getAll(),
        roleApi.getAll(),
        plantApi.getAll(),
      ]);
      setUsers(loadedUsers);
      setDepts(loadedDepts);
      setRoles(loadedRoles);
      setPlants(loadedPlants);
    } catch (err) {
      notify('error', getApiErrorMessage(err, '데이터를 조회하는 도중 오류가 발생했습니다.'));
    }
  }, [notify]);

  useEffect(() => {
    const run = async () => {
      await loadList();
    };
    void run();
  }, [loadList]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !name) return;
    if (scope === 'PLANT' && !homePlantId) {
      notify('error', '지정 플랜트를 선택해주세요.');
      return;
    }

    try {
      const payload = {
        id, name,
        departmentId: departmentId || null,
        roleId,
        scope,
        email: email || null,
        phone: phone || null,
        position: position || null,
        title: title || null,
        useYn,
        homePlantId: homePlantId || null,
      };

      if (editingId) {
        await userApi.update(editingId, payload);
        notify('success', '사용자 정보가 수정되었습니다.');
      } else {
        const createdUser = await userApi.create(payload);
        notify(
          'success',
          `새로운 사용자가 등록되었습니다. (임시 비밀번호: ${createdUser.initialPassword ?? '관리자에게 확인하세요'})`,
        );
      }
      resetForm();
      await loadList();
    } catch (err) {
      notify('error', getApiErrorMessage(err, '저장에 실패했습니다.'));
    }
  };

  const handleDelete = async (userId: string) => {
    if (!(await requestConfirmation('정말 삭제(퇴사) 처리하시겠습니까?'))) return;
    try {
      await userApi.delete(userId);
      notify('success', '사용자가 시스템에서 삭제되었습니다.');
      await loadList();
    } catch (err) {
      notify('error', getApiErrorMessage(err, '삭제 실패.'));
    }
  };

  const resetForm = () => {
    setId(''); setName(''); setDepartmentId(''); setRoleId(''); setScope('PLANT');
    setEmail(''); setPhone(''); setPosition(''); setTitle(''); setUseYn('Y');
    setHomePlantId('');
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      {/* Form Card */}
      {(canCreate || editingId) && <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
          {editingId ? <Edit2 size={14} className="text-blue-400" /> : <Plus size={14} className="text-blue-400" />}
          {editingId ? `사용자 정보 수정 (${editingId})` : '새 사용자 등록'}
        </h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">사용자 ID</label>
            <input
              type="text"
              required
              disabled={!!editingId}
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="예: hong_gildong"
              className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 text-xs outline-none transition-colors disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">이름</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 홍길동"
              className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 text-xs outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">부서</label>
            <BoundedSelect value={departmentId} onChange={setDepartmentId} options={[{ value: '', label: '없음' }, ...depts.map((d) => ({ value: d.id, label: `${d.name} (${d.id})` }))]} />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">권한 등급</label>
            <BoundedSelect disabled={editingId === currentUserId} value={roleId} onChange={setRoleId} options={[{ value: '', label: '권한 선택' }, ...roles.map((r) => ({ value: r.id, label: `${r.roleName} (${r.id})` }))]} />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">데이터 Scope</label>
            <BoundedSelect value={scope} onChange={(value) => setScope(value as 'COMPANY' | 'PLANT')} options={[{ value: 'PLANT', label: '현재 Plant' }, { value: 'COMPANY', label: '회사 전체' }]} />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 text-xs outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">연락처</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="010-0000-0000"
              className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 text-xs outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">직급</label>
            <input
              type="text"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="예: 과장"
              className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 text-xs outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">직책</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 팀장"
              className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 text-xs outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">사용 상태</label>
            <select
              disabled={editingId === currentUserId}
              value={useYn}
              onChange={(e) => setUseYn(e.target.value as YesNo)}
              className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 text-xs outline-none transition-colors disabled:opacity-50"
            >
              <option value="Y">사용 (Active)</option>
              <option value="N">미사용 (Disabled)</option>
            </select>
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">Home Plant {scope === 'PLANT' && <span className="text-rose-500">*</span>}</label>
            <BoundedSelect value={homePlantId} onChange={setHomePlantId} options={[{ value: '', label: '-- 지정 플랜트 선택 --' }, ...plants.map((p) => ({ value: p.id, label: `${p.id} — ${p.name}` }))]} />
          </div>
          <div className="md:col-span-4 flex justify-end gap-2 mt-2">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg py-2 px-4 text-xs font-semibold transition-colors cursor-pointer border-0"
              >
                취소
              </button>
            )}
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 px-6 text-xs font-semibold transition-colors cursor-pointer border-0"
            >
              {editingId ? '정보 업데이트' : '신규 생성'}
            </button>
          </div>
        </form>
      </div>}

      {/* Grid List */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-200">소속 사용자 관리 리스트</h3>
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 select-none">
                <th className="p-3 font-semibold">ID</th>
                <th className="p-3 font-semibold">이름</th>
                <th className="p-3 font-semibold">부서</th>
                <th className="p-3 font-semibold">권한</th>
                <th className="p-3 font-semibold">이메일</th>
                <th className="p-3 font-semibold">직급/직책</th>
                <th className="p-3 font-semibold">상태</th>
                <th className="p-3 font-semibold text-right">작업</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-slate-600">등록된 사용자가 없습니다.</td></tr>
              ) : users.map(u => (
                <tr key={u.id} className="border-b border-slate-900 hover:bg-slate-900/30 text-slate-300">
                  <td className="p-3 font-mono text-slate-400">{u.id}</td>
                  <td className="p-3 font-semibold text-slate-200">{u.name}</td>
                  <td className="p-3">{depts.find(d => d.id === u.departmentId)?.name || '-'}</td>
                  <td className="p-3">
                    <ListBadge>
                      {roles.find(r => r.id === u.roleId)?.roleName || u.roleId}
                    </ListBadge>
                  </td>
                  <td className="p-3 text-slate-400">{u.email || '-'}</td>
                  <td className="p-3 text-slate-400">{u.position ? `${u.position}/${u.title || '-'}` : '-'}</td>
                  <td className="p-3">
                    <ListBadge>
                      {u.useYn === 'Y' ? '활성' : '비활성'}
                    </ListBadge>
                  </td>
                  <td className="p-3 text-right space-x-1.5">
                    {canUpdate && <ListIconButton
                      onClick={() => {
                        setEditingId(u.id);
                        setId(u.id);
                        setName(u.name);
                        setDepartmentId(u.departmentId || '');
                        setRoleId(u.roleId);
                        setScope(u.scope);
                        setEmail(u.email || '');
                        setPhone(u.phone || '');
                        setPosition(u.position || '');
                        setTitle(u.title || '');
                        setUseYn(u.useYn);
                        setHomePlantId(u.homePlantId || '');
                      }}
                      label={`${u.name} 수정`}
                      icon={Edit2}
                      tone="accent"
                    />}
                    {canDelete && u.id !== currentUserId && <ListIconButton
                      onClick={() => handleDelete(u.id)}
                      label={`${u.name} 삭제`}
                      icon={Trash2}
                      tone="danger"
                    />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
