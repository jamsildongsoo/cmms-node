import { useEffect, useState } from 'react';
import { Edit2, FolderTree, Plus, Trash2 } from 'lucide-react';
import ListIconButton from '../../../components/ListIconButton';
import { getApiErrorMessage } from '../../../utils/apiError';
import { requestConfirmation } from '../../../utils/userActionDialog';
import { departmentApi } from '../mdm.api';
import type { Department } from '../mdm.types';
import type { MdmManagerProps } from '../mdm.utils';

export default function DeptManager({ notify, canCreate, canUpdate, canDelete }: MdmManagerProps) {
  const [depts, setDepts] = useState<Department[]>([]);
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchDepts = async () => {
    try {
      setDepts(await departmentApi.getAll());
    } catch (err) {
      notify('error', getApiErrorMessage(err, '부서 목록 조회에 실패했습니다.'));
    }
  };

  useEffect(() => {
    let active = true;
    void departmentApi.getAll()
      .then((loaded) => { if (active) setDepts(loaded); })
      .catch((err) => {
        if (active) notify('error', getApiErrorMessage(err, '부서 목록 조회에 실패했습니다.'));
      });
    return () => { active = false; };
  }, [notify]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !name) return;

    try {
      const payload = { id, name, parentId: parentId || null };
      if (editingId) {
        await departmentApi.update(editingId, payload);
        notify('success', '부서 정보가 수정되었습니다.');
      } else {
        await departmentApi.create(payload);
        notify('success', '새 부서가 생성되었습니다.');
      }
      setId(''); setName(''); setParentId(''); setEditingId(null);
      fetchDepts();
    } catch (err) {
      notify('error', getApiErrorMessage(err, '저장에 실패했습니다.'));
    }
  };

  const handleDelete = async (deptId: string) => {
    if (!(await requestConfirmation('정말 삭제하시겠습니까?'))) return;
    try {
      await departmentApi.delete(deptId);
      notify('success', '부서가 삭제되었습니다.');
      fetchDepts();
    } catch (err) {
      notify('error', getApiErrorMessage(err, '삭제에 실패했습니다.'));
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Input Form */}
      {(canCreate || editingId) && <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 h-fit">
        <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
          {editingId ? <Edit2 size={14} className="text-blue-400" /> : <Plus size={14} className="text-blue-400" />}
          {editingId ? '부서 수정' : '새 부서 추가'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">부서 코드</label>
            <input
              type="text"
              required
              disabled={!!editingId}
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="예: DEPT_PROD"
              className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 text-xs outline-none transition-colors disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">부서 이름</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 생산팀"
              className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 text-xs outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">상위 부서 (계층 구조)</label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 text-xs outline-none transition-colors"
            >
              <option value="">없음 (최상위 부서)</option>
              {depts.filter(d => d.id !== editingId).map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name} ({dept.id})</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 text-xs font-semibold transition-colors cursor-pointer border-0"
            >
              {editingId ? '수정 완료' : '추가'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => { setEditingId(null); setId(''); setName(''); setParentId(''); }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg py-2 px-3 text-xs transition-colors cursor-pointer border-0"
              >
                취소
              </button>
            )}
          </div>
        </form>
      </div>}

      {/* Right List Grid */}
      <div className="lg:col-span-2 space-y-4">
        <h3 className="text-sm font-bold text-slate-200">등록된 부서 계층형 목록</h3>
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 select-none">
                <th className="p-3 font-semibold">부서 코드</th>
                <th className="p-3 font-semibold">부서명</th>
                <th className="p-3 font-semibold">상위 부서</th>
                <th className="p-3 font-semibold text-right">작업</th>
              </tr>
            </thead>
            <tbody>
              {depts.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-slate-600">등록된 부서가 없습니다.</td></tr>
              ) : (
                depts.map((dept) => (
                  <tr key={dept.id} className="border-b border-slate-900 hover:bg-slate-900/30 text-slate-300">
                    <td className="p-3 font-mono text-slate-400">{dept.id}</td>
                    <td className="p-3">
                      {dept.parentId ? (
                        <span className="flex items-center gap-1.5 text-slate-400 text-xs">
                          <FolderTree size={12} className="text-blue-500" />
                          <span className="font-semibold text-slate-200">{dept.name}</span>
                        </span>
                      ) : (
                        <span className="font-bold text-blue-400">{dept.name}</span>
                      )}
                    </td>
                    <td className="p-3 font-mono text-slate-500">{dept.parentId || '-'}</td>
                    <td className="p-3 text-right space-x-2">
                      {canUpdate && <ListIconButton
                        onClick={() => {
                          setEditingId(dept.id);
                          setId(dept.id);
                          setName(dept.name);
                          setParentId(dept.parentId || '');
                        }}
                        label={`${dept.name} 수정`}
                        icon={Edit2}
                        tone="accent"
                      />}
                      {canDelete && <ListIconButton
                        onClick={() => handleDelete(dept.id)}
                        label={`${dept.name} 삭제`}
                        icon={Trash2}
                        tone="danger"
                      />}
                    </td>
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
