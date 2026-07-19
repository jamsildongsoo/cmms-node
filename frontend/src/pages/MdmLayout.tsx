import { useState, useEffect } from 'react';
import axiosInstance from '../api/axios';
import { getApiErrorMessage } from '../utils/apiError';
import { 
  Building2, FolderTree, 
  Plus, Edit2, Trash2, Check, X, Shield, Save 
} from 'lucide-react';

interface Plant { id: string; name: string; }
interface Department { id: string; name: string; parentId: string | null; }
interface Role { id: string; roleName: string; multiPlant: string; }
interface RoleDetail { companyId: string; roleId: string; moduleDetail: string; permC: string; permR: string; permU: string; permD: string; permA: string; }
interface User { id: string; name: string; departmentId: string | null; roleId: string; email: string | null; phone: string | null; position: string | null; title: string | null; useYn: string; lastLoginPlantId?: string | null; }
interface WarehouseType { id: string; name: string; plantId?: string | null; }
interface CodeGroup { id: string; name: string; systemUseYn: string; }
interface CodeItem { id: string; name: string; legalInspectYn: string; sortOrder: number; }

export default function MdmLayout() {
  const [subTab, setSubTab] = useState<'plant' | 'dept' | 'role' | 'user' | 'warehouse' | 'code'>('plant');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Common Notification Helper
  const notify = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Building2 size={24} className="text-blue-500" />
            기준 정보 설정
          </h1>
          <p className="text-slate-400 text-sm mt-1">시스템 운영의 뼈대가 되는 조직, 공통코드, 권한 등을 설정합니다.</p>
        </div>

        {/* Sub Navigation */}
        <div className="flex flex-wrap gap-1 bg-slate-900 border border-slate-800 p-1.5 rounded-lg">
          {(['plant', 'dept', 'user', 'role', 'warehouse', 'code'] as const).map((tab) => {
            const label = {
              plant: '플랜트',
              dept: '부서',
              user: '사용자',
              role: '권한 매트릭스',
              warehouse: '창고',
              code: '공통코드'
            }[tab];
            const isActive = subTab === tab;
            return (
              <button
                key={tab}
                onClick={() => { setSubTab(tab); setMessage(null); }}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer border-0 outline-none ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {message && (
        <div className="p-3 rounded-lg border border-slate-800 bg-slate-900 text-xs text-center text-slate-200 transition-all flex items-center justify-center gap-2">
          {message.type === 'success' ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Render sub components */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        {subTab === 'plant' && <PlantManager notify={notify} />}
        {subTab === 'dept' && <DeptManager notify={notify} />}
        {subTab === 'user' && <UserManager notify={notify} />}
        {subTab === 'role' && <RoleManager notify={notify} />}
        {subTab === 'warehouse' && <WarehouseManager notify={notify} />}
        {subTab === 'code' && <CodeManager notify={notify} />}
      </div>
    </div>
  );
}

/* =========================================================================
   1. PLANT MANAGER
   ========================================================================= */
function PlantManager({ notify }: { notify: (type: 'success' | 'error', t: string) => void }) {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchPlants = async () => {
    try {
      const res = await axiosInstance.get('/mdm/plants');
      setPlants(res.data);
    } catch (err) {
      notify('error', getApiErrorMessage(err, '플랜트 목록 조회에 실패했습니다.'));
    }
  };

  useEffect(() => { fetchPlants(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !name) return;

    try {
      if (editingId) {
        await axiosInstance.put(`/mdm/plants/${editingId}`, { name });
        notify('success', '플랜트 정보가 수정되었습니다.');
      } else {
        await axiosInstance.post('/mdm/plants', { id, name });
        notify('success', '새 플랜트가 생성되었습니다.');
      }
      setId(''); setName(''); setEditingId(null);
      fetchPlants();
    } catch (err) {
      notify('error', getApiErrorMessage(err, '저장에 실패했습니다.'));
    }
  };

  const handleDelete = async (plantId: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      await axiosInstance.delete(`/mdm/plants/${plantId}`);
      notify('success', '플랜트가 삭제되었습니다.');
      fetchPlants();
    } catch (err) {
      notify('error', getApiErrorMessage(err, '삭제에 실패했습니다.'));
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left: Input Form */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 h-fit">
        <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
          {editingId ? <Edit2 size={14} className="text-blue-400" /> : <Plus size={14} className="text-blue-400" />}
          {editingId ? '플랜트 수정' : '새 플랜트 추가'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">플랜트 코드</label>
            <input
              type="text"
              required
              disabled={!!editingId}
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="예: PLANT_01"
              className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 text-xs outline-none transition-colors disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">플랜트 이름</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 서울 공장"
              className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 text-xs outline-none transition-colors"
            />
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
                onClick={() => { setEditingId(null); setId(''); setName(''); }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg py-2 px-3 text-xs transition-colors cursor-pointer border-0"
              >
                취소
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Right: List Grid */}
      <div className="lg:col-span-2 space-y-4">
        <h3 className="text-sm font-bold text-slate-200">등록된 플랜트 목록</h3>
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 select-none">
                <th className="p-3 font-semibold">플랜트 코드</th>
                <th className="p-3 font-semibold">플랜트 이름</th>
                <th className="p-3 font-semibold text-right">작업</th>
              </tr>
            </thead>
            <tbody>
              {plants.length === 0 ? (
                <tr><td colSpan={3} className="p-8 text-center text-slate-600">등록된 플랜트가 없습니다.</td></tr>
              ) : (
                plants.map((plant) => (
                  <tr key={plant.id} className="border-b border-slate-900 hover:bg-slate-900/30 text-slate-300">
                    <td className="p-3 font-mono text-slate-400">{plant.id}</td>
                    <td className="p-3 font-semibold">{plant.name}</td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => { setEditingId(plant.id); setId(plant.id); setName(plant.name); }}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-blue-400 transition-colors border-0 cursor-pointer bg-transparent"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(plant.id)}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-rose-400 transition-colors border-0 cursor-pointer bg-transparent"
                      >
                        <Trash2 size={14} />
                      </button>
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

/* =========================================================================
   2. DEPARTMENT MANAGER (Hierarchical Layout)
   ========================================================================= */
function DeptManager({ notify }: { notify: (type: 'success' | 'error', t: string) => void }) {
  const [depts, setDepts] = useState<Department[]>([]);
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchDepts = async () => {
    try {
      const res = await axiosInstance.get('/mdm/departments');
      setDepts(res.data);
    } catch (err) {
      notify('error', getApiErrorMessage(err, '부서 목록 조회에 실패했습니다.'));
    }
  };

  useEffect(() => { fetchDepts(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !name) return;

    try {
      const payload = { id, name, parentId: parentId || null };
      if (editingId) {
        await axiosInstance.put(`/mdm/departments/${editingId}`, payload);
        notify('success', '부서 정보가 수정되었습니다.');
      } else {
        await axiosInstance.post('/mdm/departments', payload);
        notify('success', '새 부서가 생성되었습니다.');
      }
      setId(''); setName(''); setParentId(''); setEditingId(null);
      fetchDepts();
    } catch (err) {
      notify('error', getApiErrorMessage(err, '저장에 실패했습니다.'));
    }
  };

  const handleDelete = async (deptId: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      await axiosInstance.delete(`/mdm/departments/${deptId}`);
      notify('success', '부서가 삭제되었습니다.');
      fetchDepts();
    } catch (err) {
      notify('error', getApiErrorMessage(err, '삭제에 실패했습니다.'));
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Input Form */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 h-fit">
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
      </div>

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
                      <button
                        onClick={() => {
                          setEditingId(dept.id);
                          setId(dept.id);
                          setName(dept.name);
                          setParentId(dept.parentId || '');
                        }}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-blue-400 transition-colors border-0 cursor-pointer bg-transparent"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(dept.id)}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-rose-400 transition-colors border-0 cursor-pointer bg-transparent"
                      >
                        <Trash2 size={14} />
                      </button>
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

/* =========================================================================
   3. USER MANAGER
   ========================================================================= */
function UserManager({ notify }: { notify: (type: 'success' | 'error', t: string) => void }) {
  const [users, setUsers] = useState<User[]>([]);
  const [depts, setDepts] = useState<Department[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);

  // User form states
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [roleId, setRoleId] = useState('USER');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [position, setPosition] = useState('');
  const [title, setTitle] = useState('');
  const [useYn, setUseYn] = useState('Y');
  const [lastLoginPlantId, setLastLoginPlantId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [userRes, deptRes, roleRes, plantRes] = await Promise.all([
        axiosInstance.get('/mdm/users'),
        axiosInstance.get('/mdm/departments'),
        axiosInstance.get('/mdm/roles'),
        axiosInstance.get('/mdm/plants'),
      ]);
      setUsers(userRes.data);
      setDepts(deptRes.data);
      setRoles(roleRes.data);
      setPlants(plantRes.data || []);
    } catch (err) {
      notify('error', getApiErrorMessage(err, '데이터를 조회하는 도중 오류가 발생했습니다.'));
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !name) return;

    try {
      const payload = {
        id, name,
        departmentId: departmentId || null,
        roleId,
        email: email || null,
        phone: phone || null,
        position: position || null,
        title: title || null,
        useYn,
        lastLoginPlantId: lastLoginPlantId || null,
      };

      if (editingId) {
        await axiosInstance.put(`/mdm/users/${editingId}`, payload);
        notify('success', '사용자 정보가 수정되었습니다.');
      } else {
        await axiosInstance.post('/mdm/users', payload);
        notify('success', '새로운 사용자가 등록되었습니다. (임시 비밀번호: 1234)');
      }
      resetForm();
      fetchData();
    } catch (err) {
      notify('error', getApiErrorMessage(err, '저장에 실패했습니다.'));
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('정말 삭제(퇴사) 처리하시겠습니까?')) return;
    try {
      await axiosInstance.delete(`/mdm/users/${userId}`);
      notify('success', '사용자가 시스템에서 삭제되었습니다.');
      fetchData();
    } catch (err) {
      notify('error', getApiErrorMessage(err, '삭제 실패.'));
    }
  };

  const resetForm = () => {
    setId(''); setName(''); setDepartmentId(''); setRoleId('USER');
    setEmail(''); setPhone(''); setPosition(''); setTitle(''); setUseYn('Y');
    setLastLoginPlantId('');
    setEditingId(null);
  };

  return (
    <div className="space-y-6">
      {/* Form Card */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
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
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 text-xs outline-none transition-colors"
            >
              <option value="">없음</option>
              {depts.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">권한 등급</label>
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 text-xs outline-none transition-colors"
            >
              {roles.map(r => (
                <option key={r.id} value={r.id}>{r.roleName}</option>
              ))}
            </select>
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
              value={useYn}
              onChange={(e) => setUseYn(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 text-xs outline-none transition-colors"
            >
              <option value="Y">사용 (Active)</option>
              <option value="N">미사용 (Disabled)</option>
            </select>
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">지정 플랜트 (선택 — 비우면 로그인 시 자동매핑)</label>
            <select
              value={lastLoginPlantId}
              onChange={(e) => setLastLoginPlantId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 text-xs outline-none transition-colors"
            >
              <option value="">자동매핑</option>
              {plants.map(p => <option key={p.id} value={p.id}>{p.id} — {p.name}</option>)}
            </select>
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
      </div>

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
              {users.map(u => (
                <tr key={u.id} className="border-b border-slate-900 hover:bg-slate-900/30 text-slate-300">
                  <td className="p-3 font-mono text-slate-400">{u.id}</td>
                  <td className="p-3 font-semibold text-slate-200">{u.name}</td>
                  <td className="p-3">{depts.find(d => d.id === u.departmentId)?.name || '-'}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded bg-blue-950/60 border border-blue-900/50 text-blue-400 text-[10px] font-bold">
                      {roles.find(r => r.id === u.roleId)?.roleName || u.roleId}
                    </span>
                  </td>
                  <td className="p-3 text-slate-400">{u.email || '-'}</td>
                  <td className="p-3 text-slate-400">{u.position ? `${u.position}/${u.title || '-'}` : '-'}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      u.useYn === 'Y' 
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' 
                        : 'bg-rose-950 text-rose-400 border border-rose-900'
                    }`}>
                      {u.useYn === 'Y' ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td className="p-3 text-right space-x-1.5">
                    <button
                      onClick={() => {
                        setEditingId(u.id);
                        setId(u.id);
                        setName(u.name);
                        setDepartmentId(u.departmentId || '');
                        setRoleId(u.roleId);
                        setEmail(u.email || '');
                        setPhone(u.phone || '');
                        setPosition(u.position || '');
                        setTitle(u.title || '');
                        setUseYn(u.useYn);
                        setLastLoginPlantId(u.lastLoginPlantId || '');
                      }}
                      className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-blue-400 transition-colors border-0 cursor-pointer bg-transparent"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(u.id)}
                      className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-rose-400 transition-colors border-0 cursor-pointer bg-transparent"
                    >
                      <Trash2 size={13} />
                    </button>
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

/* =========================================================================
   4. ROLE MATRIX MANAGER
   ========================================================================= */
function RoleManager({ notify }: { notify: (type: 'success' | 'error', t: string) => void }) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [details, setDetails] = useState<RoleDetail[]>([]);
  const [newRoleId, setNewRoleId] = useState('');
  const [newRoleName, setNewRoleName] = useState('');
  const [newMultiPlant, setNewMultiPlant] = useState(false);
  // 모듈 라벨 — BE /api/meta/modules 단일 소스(AppModule.label())
  const [moduleLabels, setModuleLabels] = useState<Record<string, string>>({});
  useEffect(() => {
    axiosInstance.get('/meta/modules')
      .then(res => {
        const map: Record<string, string> = {};
        (res.data || []).forEach((m: any) => { map[m.code] = m.label; });
        setModuleLabels(map);
      })
      .catch(() => {});
  }, []);

  const fetchRoles = async () => {
    try {
      const res = await axiosInstance.get('/mdm/roles');
      setRoles(res.data);
      if (res.data.length > 0 && !selectedRoleId) {
        setSelectedRoleId(res.data[0].id);
      }
    } catch (err) {
      notify('error', getApiErrorMessage(err, '권한 목록 조회 실패.'));
    }
  };

  const fetchDetails = async (roleId: string) => {
    try {
      const res = await axiosInstance.get(`/mdm/roles/${roleId}/details`);
      setDetails(res.data);
    } catch (err) {
      notify('error', getApiErrorMessage(err, '상세 권한 매트릭스를 불러오지 못했습니다.'));
    }
  };

  useEffect(() => { fetchRoles(); }, []);
  useEffect(() => { if (selectedRoleId) fetchDetails(selectedRoleId); }, [selectedRoleId]);

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleId || !newRoleName) return;
    try {
      await axiosInstance.post('/mdm/roles', { id: newRoleId.toUpperCase(), roleName: newRoleName, multiPlant: newMultiPlant ? 'Y' : 'N' });
      notify('success', '새로운 권한 그룹이 추가되었습니다.');
      setNewRoleId(''); setNewRoleName(''); setNewMultiPlant(false);
      fetchRoles();
    } catch (err) {
      notify('error', getApiErrorMessage(err, '권한 생성 실패.'));
    }
  };

  const handleTogglePerm = (module: string, type: 'C' | 'R' | 'U' | 'D' | 'A') => {
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
      await axiosInstance.post(`/mdm/roles/${selectedRoleId}/details`, details);
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
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
            <Shield size={14} className="text-blue-500" />
            새 권한그룹 추가
          </h3>
          <form onSubmit={handleCreateRole} className="space-y-4">
            <div>
              <label className="block text-slate-400 text-xs mb-1.5">권한 코드</label>
              <input
                type="text"
                required
                value={newRoleId}
                onChange={(e) => setNewRoleId(e.target.value)}
                placeholder="예: MANAGER_QA"
                className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 text-xs outline-none transition-colors"
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
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 text-xs font-semibold transition-colors cursor-pointer border-0"
            >
              추가
            </button>
          </form>
        </div>

        {/* Roles list */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">권한 그룹 선택</h3>
          <div className="space-y-1">
            {roles.map(r => (
              <button
                key={r.id}
                onClick={() => setSelectedRoleId(r.id)}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors outline-none border border-0 cursor-pointer ${
                  selectedRoleId === r.id 
                    ? 'bg-blue-600/10 border-blue-500/30 text-blue-400' 
                    : 'bg-slate-950/40 border-slate-900 text-slate-400 hover:bg-slate-800/40'
                }`}
              >
                <span className="flex items-center justify-between">
                <span>{r.roleName} ({r.id})</span>
                {r.multiPlant === 'Y' && <span className="ml-2 px-1.5 py-0.5 rounded bg-emerald-950/40 border border-emerald-900/60 text-emerald-400 text-[9px] font-bold">멀티</span>}
              </span>
              </button>
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
          <button
            onClick={handleSaveMatrix}
            className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 px-4 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer border-0"
          >
            <Save size={13} />
            권한 저장
          </button>
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
                <th className="p-3.5 font-semibold text-center">승인 (A)</th>
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
                            onClick={() => handleTogglePerm(detail.moduleDetail, type)}
                            className={`w-6 h-6 rounded flex items-center justify-center mx-auto transition-colors border cursor-pointer ${
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

/* =========================================================================
   5. WAREHOUSE MANAGER
   ========================================================================= */
function WarehouseManager({ notify }: { notify: (type: 'success' | 'error', t: string) => void }) {
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [plantId, setPlantId] = useState('');  // 빈값 = 공통부문(null)
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchWarehouses = async () => {
    try {
      const res = await axiosInstance.get('/mdm/warehouses');
      setWarehouses(res.data);
    } catch (err) {
      notify('error', getApiErrorMessage(err, '창고 목록 조회 실패.'));
    }
  };
  const fetchPlants = async () => {
    try { const res = await axiosInstance.get('/mdm/plants'); setPlants(res.data || []); }
    catch (err) { /* 비치명 */ }
  };

  useEffect(() => { fetchWarehouses(); fetchPlants(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !name) return;
    try {
      const payload = { id, name, plantId: plantId || null };
      if (editingId) {
        await axiosInstance.put(`/mdm/warehouses/${editingId}`, payload);
        notify('success', '창고 정보가 수정되었습니다.');
      } else {
        await axiosInstance.post('/mdm/warehouses', payload);
        notify('success', '새로운 창고가 추가되었습니다.');
      }
      setId(''); setName(''); setPlantId(''); setEditingId(null);
      fetchWarehouses();
    } catch (err) {
      notify('error', getApiErrorMessage(err, '저장 실패.'));
    }
  };

  const handleDelete = async (whId: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    try {
      await axiosInstance.delete(`/mdm/warehouses/${whId}`);
      notify('success', '창고가 삭제되었습니다.');
      fetchWarehouses();
    } catch (err) {
      notify('error', getApiErrorMessage(err, '삭제 실패.'));
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Input */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 h-fit">
        <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
          {editingId ? <Edit2 size={14} className="text-blue-400" /> : <Plus size={14} className="text-blue-400" />}
          {editingId ? '창고 수정' : '새 창고 추가'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">창고(저장소) 코드</label>
            <input
              type="text"
              required
              disabled={!!editingId}
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="예: WH_MAIN"
              className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 text-xs outline-none transition-colors disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">창고 이름</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 본관 원자재 창고"
              className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 text-xs outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">플랜트 (비워두면 공통부문)</label>
            <select
              value={plantId}
              onChange={(e) => setPlantId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 text-xs outline-none transition-colors"
            >
              <option value="">공통부문 (전체 노출)</option>
              {plants.map(p => <option key={p.id} value={p.id}>{p.id} — {p.name}</option>)}
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
                onClick={() => { setEditingId(null); setId(''); setName(''); setPlantId(''); }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg py-2 px-3 text-xs transition-colors cursor-pointer border-0"
              >
                취소
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Right List */}
      <div className="lg:col-span-2 space-y-4">
        <h3 className="text-sm font-bold text-slate-200">등록된 창고(저장소) 목록</h3>
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 select-none">
                <th className="p-3 font-semibold">창고 코드</th>
                <th className="p-3 font-semibold">창고 이름</th>
                <th className="p-3 font-semibold">플랜트</th>
                <th className="p-3 font-semibold text-right">작업</th>
              </tr>
            </thead>
            <tbody>
              {warehouses.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-slate-600">등록된 창고가 없습니다.</td></tr>
              ) : (
                warehouses.map(wh => (
                  <tr key={wh.id} className="border-b border-slate-900 hover:bg-slate-900/30 text-slate-300">
                    <td className="p-3 font-mono text-slate-400">{wh.id}</td>
                    <td className="p-3 font-semibold">{wh.name}</td>
                    <td className="p-3 text-slate-400">{wh.plantId || <span className="text-slate-600">공통</span>}</td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => { setEditingId(wh.id); setId(wh.id); setName(wh.name); setPlantId(wh.plantId || ''); }}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-blue-400 transition-colors border-0 cursor-pointer bg-transparent"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(wh.id)}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-rose-400 transition-colors border-0 cursor-pointer bg-transparent"
                      >
                        <Trash2 size={14} />
                      </button>
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

/* =========================================================================
   6. COMMON CODE MANAGER
   ========================================================================= */
function CodeManager({ notify }: { notify: (type: 'success' | 'error', t: string) => void }) {
  const [groups, setGroups] = useState<CodeGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [items, setItems] = useState<CodeItem[]>([]);

  // Code Group form states
  const [grpId, setGrpId] = useState('');
  const [grpName, setGrpName] = useState('');

  // Code Item form states
  const [itemId, setItemId] = useState('');
  const [itemName, setItemName] = useState('');
  const [legalInspectYn, setLegalInspectYn] = useState('N');
  const [sortOrder, setSortOrder] = useState(0);
  const [itemEditingId, setItemEditingId] = useState<string | null>(null);

  const fetchGroups = async () => {
    try {
      const res = await axiosInstance.get('/mdm/code-groups');
      setGroups(res.data);
      if (res.data.length > 0 && !selectedGroupId) {
        setSelectedGroupId(res.data[0].id);
      }
    } catch (err) {
      notify('error', getApiErrorMessage(err, '공통코드 그룹 조회 실패.'));
    }
  };

  const fetchItems = async (groupId: string) => {
    try {
      const res = await axiosInstance.get(`/mdm/code-groups/${groupId}/items`);
      setItems(res.data);
    } catch (err) {
      notify('error', getApiErrorMessage(err, '상세 코드 조회 실패.'));
    }
  };

  useEffect(() => { fetchGroups(); }, []);
  useEffect(() => { if (selectedGroupId) fetchItems(selectedGroupId); }, [selectedGroupId]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grpId || !grpName) return;
    try {
      await axiosInstance.post('/mdm/code-groups', { id: grpId.toUpperCase(), name: grpName });
      notify('success', '새 코드 그룹이 추가되었습니다.');
      setGrpId(''); setGrpName('');
      fetchGroups();
    } catch (err) {
      notify('error', getApiErrorMessage(err, '그룹 생성 실패.'));
    }
  };

  const handleItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupId || !itemId || !itemName) return;

    try {
      const payload = { id: itemId.toUpperCase(), name: itemName, legalInspectYn, sortOrder };
      if (itemEditingId) {
        await axiosInstance.put(`/mdm/code-groups/${selectedGroupId}/items/${itemEditingId}`, payload);
        notify('success', '상세 코드가 수정되었습니다.');
      } else {
        await axiosInstance.post(`/mdm/code-groups/${selectedGroupId}/items`, payload);
        notify('success', '상세 코드가 등록되었습니다.');
      }
      resetItemForm();
      fetchItems(selectedGroupId);
    } catch (err) {
      notify('error', getApiErrorMessage(err, '저장 실패.'));
    }
  };

  const handleItemDelete = async (id: string) => {
    if (!selectedGroupId || !confirm('정말 삭제하시겠습니까?')) return;
    try {
      await axiosInstance.delete(`/mdm/code-groups/${selectedGroupId}/items/${id}`);
      notify('success', '코드가 삭제되었습니다.');
      fetchItems(selectedGroupId);
    } catch (err) {
      notify('error', getApiErrorMessage(err, '삭제 실패.'));
    }
  };

  const resetItemForm = () => {
    setItemId(''); setItemName(''); setLegalInspectYn('N'); setSortOrder(0);
    setItemEditingId(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Code Groups column */}
      <div className="space-y-6">
        {/* Group Add */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
            <Plus size={14} className="text-blue-400" />
            코드 그룹 추가
          </h3>
          <form onSubmit={handleCreateGroup} className="space-y-4">
            <div>
              <label className="block text-slate-400 text-xs mb-1.5">그룹 코드</label>
              <input
                type="text"
                required
                value={grpId}
                onChange={(e) => setGrpId(e.target.value)}
                placeholder="예: PM_TYPE"
                className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 text-xs outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1.5">그룹 이름</label>
              <input
                type="text"
                required
                value={grpName}
                onChange={(e) => setGrpName(e.target.value)}
                placeholder="예: 점검유형공통코드"
                className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 text-xs outline-none transition-colors"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 text-xs font-semibold transition-colors cursor-pointer border-0"
            >
              그룹 추가
            </button>
          </form>
        </div>

        {/* Group List Selector */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">코드 그룹 선택</h3>
          <div className="space-y-1">
            {groups.map(g => (
              <button
                key={g.id}
                onClick={() => setSelectedGroupId(g.id)}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-xs font-semibold transition-colors border outline-none border border-0 cursor-pointer ${
                  selectedGroupId === g.id 
                    ? 'bg-blue-600/10 border-blue-500/30 text-blue-400' 
                    : 'bg-slate-950/40 border-slate-900 text-slate-400 hover:bg-slate-800/40'
                }`}
              >
                {g.name} ({g.id})
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Code Items Detail column */}
      <div className="lg:col-span-2 space-y-6">
        {/* Item Form Card */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
            {itemEditingId ? <Edit2 size={14} className="text-blue-400" /> : <Plus size={14} className="text-blue-400" />}
            {itemEditingId ? `상세 코드 수정 (${itemEditingId})` : `[${selectedGroupId}] 그룹 내 새 상세코드 등록`}
          </h3>
          <form onSubmit={handleItemSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-slate-400 text-xs mb-1.5">상세 코드</label>
              <input
                type="text"
                required
                disabled={!!itemEditingId}
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
                placeholder="예: TYPE_01"
                className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 text-xs outline-none transition-colors disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1.5">상세 이름</label>
              <input
                type="text"
                required
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="예: 법정검사"
                className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 text-xs outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1.5">법정 검사 여부</label>
              <select
                value={legalInspectYn}
                onChange={(e) => setLegalInspectYn(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 text-xs outline-none transition-colors"
              >
                <option value="N">해당 없음</option>
                <option value="Y">법정 검사 대상</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1.5">정렬 순서</label>
              <input
                type="number"
                required
                value={sortOrder}
                onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
                className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 text-xs outline-none transition-colors"
              />
            </div>
            <div className="md:col-span-4 flex justify-end gap-2">
              {itemEditingId && (
                <button
                  type="button"
                  onClick={resetItemForm}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg py-2 px-4 text-xs font-semibold transition-colors cursor-pointer border-0"
                >
                  취소
                </button>
              )}
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 px-6 text-xs font-semibold transition-colors cursor-pointer border-0"
              >
                {itemEditingId ? '코드 수정' : '상세 코드 생성'}
              </button>
            </div>
          </form>
        </div>

        {/* Item List Grid */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-200">상세 코드 리스트</h3>
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 select-none">
                  <th className="p-3 font-semibold">상세 코드</th>
                  <th className="p-3 font-semibold">코드 이름</th>
                  <th className="p-3 font-semibold">법정검사여부</th>
                  <th className="p-3 font-semibold">정렬순서</th>
                  <th className="p-3 font-semibold text-right">작업</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-600">그룹 내 등록된 코드가 없습니다.</td></tr>
                ) : (
                  items.map(item => (
                    <tr key={item.id} className="border-b border-slate-900 hover:bg-slate-900/30 text-slate-300">
                      <td className="p-3 font-mono text-slate-400">{item.id}</td>
                      <td className="p-3 font-semibold text-slate-200">{item.name}</td>
                      <td className="p-3 text-slate-400">
                        {item.legalInspectYn === 'Y' ? (
                          <span className="px-2 py-0.5 rounded bg-yellow-950 text-yellow-400 border border-yellow-900 text-[10px] font-semibold">
                            대상
                          </span>
                        ) : '-'}
                      </td>
                      <td className="p-3 text-slate-400">{item.sortOrder}</td>
                      <td className="p-3 text-right space-x-2">
                        <button
                          onClick={() => {
                            setItemEditingId(item.id);
                            setItemId(item.id);
                            setItemName(item.name);
                            setLegalInspectYn(item.legalInspectYn);
                            setSortOrder(item.sortOrder);
                          }}
                          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-blue-400 transition-colors border-0 cursor-pointer bg-transparent"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleItemDelete(item.id)}
                          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-rose-400 transition-colors border-0 cursor-pointer bg-transparent"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
