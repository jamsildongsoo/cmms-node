import { useEffect, useState } from 'react';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import ListIconButton from '../../../components/ListIconButton';
import { getApiErrorMessage } from '../../../utils/apiError';
import { requestConfirmation } from '../../../utils/userActionDialog';
import { plantApi } from '../mdm.api';
import type { Plant } from '../mdm.types';
import type { MdmManagerProps } from '../mdm.utils';

export default function PlantManager({ notify, canCreate, canUpdate, canDelete }: MdmManagerProps) {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchPlants = async () => {
    try {
      setPlants(await plantApi.getAll());
    } catch (err) {
      notify('error', getApiErrorMessage(err, '플랜트 목록 조회에 실패했습니다.'));
    }
  };

  useEffect(() => {
    let active = true;
    void plantApi.getAll()
      .then((loaded) => { if (active) setPlants(loaded); })
      .catch((err) => {
        if (active) notify('error', getApiErrorMessage(err, '플랜트 목록 조회에 실패했습니다.'));
      });
    return () => { active = false; };
  }, [notify]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !name) return;
    try {
      if (editingId) {
        await plantApi.update(editingId, { name });
        notify('success', '플랜트 정보가 수정되었습니다.');
      } else {
        await plantApi.create({ id, name });
        notify('success', '새 플랜트가 생성되었습니다.');
      }
      setId(''); setName(''); setEditingId(null);
      fetchPlants();
    } catch (err) {
      notify('error', getApiErrorMessage(err, '저장에 실패했습니다.'));
    }
  };

  const handleDelete = async (plantId: string) => {
    if (!(await requestConfirmation('정말 삭제하시겠습니까?'))) return;
    try {
      await plantApi.delete(plantId);
      notify('success', '플랜트가 삭제되었습니다.');
      fetchPlants();
    } catch (err) {
      notify('error', getApiErrorMessage(err, '삭제에 실패했습니다.'));
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left: Input Form */}
      {(canCreate || editingId) && <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 h-fit">
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
      </div>}

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
                      {canUpdate && <ListIconButton
                        onClick={() => { setEditingId(plant.id); setId(plant.id); setName(plant.name); }}
                        label={`${plant.name} 수정`}
                        icon={Edit2}
                        tone="accent"
                      />}
                      {canDelete && <ListIconButton
                        onClick={() => handleDelete(plant.id)}
                        label={`${plant.name} 삭제`}
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
