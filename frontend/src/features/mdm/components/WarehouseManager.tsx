import { useEffect, useState } from 'react';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import ListIconButton from '../../../components/ListIconButton';
import { getApiErrorMessage } from '../../../utils/apiError';
import { requestConfirmation } from '../../../utils/userActionDialog';
import { plantApi, warehouseApi } from '../mdm.api';
import type { Plant, Warehouse } from '../mdm.types';
import type { MdmManagerProps } from '../mdm.utils';

export default function WarehouseManager({ notify, canCreate, canUpdate, canDelete }: MdmManagerProps) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [plantId, setPlantId] = useState('');  // 빈값 = 공통부문(null)
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchWarehouses = async () => {
    try {
      setWarehouses(await warehouseApi.getAll());
    } catch (err) {
      notify('error', getApiErrorMessage(err, '창고 목록 조회 실패.'));
    }
  };
  useEffect(() => {
    let active = true;
    void Promise.all([warehouseApi.getAll(), plantApi.getAll()])
      .then(([loadedWarehouses, loadedPlants]) => {
        if (!active) return;
        setWarehouses(loadedWarehouses);
        setPlants(loadedPlants);
      })
      .catch((err) => {
        if (active) notify('error', getApiErrorMessage(err, '창고 기준정보 조회 실패.'));
      });
    return () => { active = false; };
  }, [notify]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !name) return;
    try {
      const payload = { id, name, plantId: plantId || null };
      if (editingId) {
        await warehouseApi.update(editingId, payload);
        notify('success', '창고 정보가 수정되었습니다.');
      } else {
        await warehouseApi.create(payload);
        notify('success', '새로운 창고가 추가되었습니다.');
      }
      setId(''); setName(''); setPlantId(''); setEditingId(null);
      fetchWarehouses();
    } catch (err) {
      notify('error', getApiErrorMessage(err, '저장 실패.'));
    }
  };

  const handleDelete = async (whId: string) => {
    if (!(await requestConfirmation('정말 삭제하시겠습니까?'))) return;
    try {
      await warehouseApi.delete(whId);
      notify('success', '창고가 삭제되었습니다.');
      fetchWarehouses();
    } catch (err) {
      notify('error', getApiErrorMessage(err, '삭제 실패.'));
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Input */}
      {(canCreate || editingId) && <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 h-fit">
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
      </div>}

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
                      {canUpdate && <ListIconButton
                        onClick={() => { setEditingId(wh.id); setId(wh.id); setName(wh.name); setPlantId(wh.plantId || ''); }}
                        label={`${wh.name} 수정`}
                        icon={Edit2}
                        tone="accent"
                      />}
                      {canDelete && <ListIconButton
                        onClick={() => handleDelete(wh.id)}
                        label={`${wh.name} 삭제`}
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
