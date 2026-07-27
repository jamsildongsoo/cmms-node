import { useEffect, useState } from 'react';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import ListIconButton from '../../../components/ListIconButton';
import { getApiErrorMessage } from '../../../utils/apiError';
import { requestConfirmation } from '../../../utils/userActionDialog';
import { codeGroupApi } from '../mdm.api';
import type { CodeGroup, CodeItem, YesNo } from '../mdm.types';
import type { MdmManagerProps } from '../mdm.utils';

export default function CodeManager({ notify, canCreate, canUpdate, canDelete }: MdmManagerProps) {
  const [groups, setGroups] = useState<CodeGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [items, setItems] = useState<CodeItem[]>([]);

  // Code Group form states
  const [grpId, setGrpId] = useState('');
  const [grpName, setGrpName] = useState('');
  const [groupEditingId, setGroupEditingId] = useState<string | null>(null);

  // Code Item form states
  const [itemId, setItemId] = useState('');
  const [itemName, setItemName] = useState('');
  const [legalInspectYn, setLegalInspectYn] = useState<YesNo>('N');
  const [sortOrder, setSortOrder] = useState(0);
  const [itemEditingId, setItemEditingId] = useState<string | null>(null);

  const fetchGroups = async () => {
    try {
      const loadedGroups = await codeGroupApi.getAll();
      setGroups(loadedGroups);
      setSelectedGroupId((current) =>
        loadedGroups.some((group) => group.id === current)
          ? current
          : loadedGroups[0]?.id ?? null,
      );
    } catch (err) {
      notify('error', getApiErrorMessage(err, '공통코드 그룹 조회 실패.'));
    }
  };

  const fetchItems = async (groupId: string) => {
    try {
      setItems(await codeGroupApi.getItems(groupId));
    } catch (err) {
      notify('error', getApiErrorMessage(err, '상세 코드 조회 실패.'));
    }
  };

  useEffect(() => {
    let active = true;
    void codeGroupApi.getAll()
      .then((loadedGroups) => {
        if (!active) return;
        setGroups(loadedGroups);
        setSelectedGroupId(loadedGroups[0]?.id ?? null);
      })
      .catch((err) => {
        if (active) notify('error', getApiErrorMessage(err, '공통코드 그룹 조회 실패.'));
      });
    return () => { active = false; };
  }, [notify]);
  useEffect(() => {
    if (!selectedGroupId) return;
    let active = true;
    void codeGroupApi.getItems(selectedGroupId)
      .then((loaded) => { if (active) setItems(loaded); })
      .catch((err) => {
        if (active) notify('error', getApiErrorMessage(err, '상세 코드 조회 실패.'));
      });
    return () => { active = false; };
  }, [notify, selectedGroupId]);

  const resetGroupForm = () => {
    setGrpId('');
    setGrpName('');
    setGroupEditingId(null);
  };

  const handleGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!grpId || !grpName) return;
    try {
      const payload = { id: grpId.toUpperCase(), name: grpName };
      if (groupEditingId) {
        await codeGroupApi.update(groupEditingId, payload);
        notify('success', '코드 그룹이 수정되었습니다.');
      } else {
        await codeGroupApi.create(payload);
        notify('success', '새 코드 그룹이 추가되었습니다.');
      }
      resetGroupForm();
      await fetchGroups();
    } catch (err) {
      notify('error', getApiErrorMessage(err, '그룹 저장 실패.'));
    }
  };

  const handleEditGroup = (group: CodeGroup) => {
    setGroupEditingId(group.id);
    setGrpId(group.id);
    setGrpName(group.name);
  };

  const handleDeleteGroup = async (group: CodeGroup) => {
    if (group.systemUseYn === 'Y') return;
    if (!(await requestConfirmation(`${group.name} 코드 그룹을 삭제하시겠습니까?`))) return;
    try {
      await codeGroupApi.delete(group.id);
      notify('success', '코드 그룹이 삭제되었습니다.');
      if (groupEditingId === group.id) resetGroupForm();
      if (selectedGroupId === group.id) {
        setSelectedGroupId(null);
        setItems([]);
        resetItemForm();
      }
      await fetchGroups();
    } catch (err) {
      notify('error', getApiErrorMessage(err, '그룹 삭제 실패.'));
    }
  };

  const handleItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupId || !itemId || !itemName) return;

    try {
      const payload = { id: itemId.toUpperCase(), name: itemName, legalInspectYn, sortOrder };
      if (itemEditingId) {
        await codeGroupApi.updateItem(selectedGroupId, itemEditingId, payload);
        notify('success', '상세 코드가 수정되었습니다.');
      } else {
        await codeGroupApi.createItem(selectedGroupId, payload);
        notify('success', '상세 코드가 등록되었습니다.');
      }
      resetItemForm();
      fetchItems(selectedGroupId);
    } catch (err) {
      notify('error', getApiErrorMessage(err, '저장 실패.'));
    }
  };

  const handleItemDelete = async (id: string) => {
    if (!selectedGroupId || !(await requestConfirmation('정말 삭제하시겠습니까?'))) return;
    try {
      await codeGroupApi.deleteItem(selectedGroupId, id);
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
        {(canCreate || groupEditingId) && <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
          <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center gap-2">
            {groupEditingId ? <Edit2 size={14} className="text-blue-400" /> : <Plus size={14} className="text-blue-400" />}
            {groupEditingId ? '코드 그룹 수정' : '코드 그룹 추가'}
          </h3>
          <form onSubmit={handleGroupSubmit} className="space-y-4">
            <div>
              <label className="block text-slate-400 text-xs mb-1.5">그룹 코드</label>
              <input
                type="text"
                required
                disabled={!!groupEditingId}
                value={grpId}
                onChange={(e) => setGrpId(e.target.value)}
                placeholder="예: PM_TYPE"
                className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 text-xs outline-none transition-colors disabled:opacity-50"
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
            <div className="flex gap-2">
              {groupEditingId && (
                <button
                  type="button"
                  onClick={resetGroupForm}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg py-2 text-xs font-semibold cursor-pointer border-0"
                >
                  취소
                </button>
              )}
              <button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 text-xs font-semibold transition-colors cursor-pointer border-0"
              >
                {groupEditingId ? '그룹 수정' : '그룹 추가'}
              </button>
            </div>
          </form>
        </div>}

        {/* Group List Selector */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">코드 그룹 선택</h3>
          <div className="space-y-1">
            {groups.map(g => (
              <div
                key={g.id}
                className={`flex items-center rounded-lg border transition-colors ${
                  selectedGroupId === g.id
                    ? 'bg-blue-600/10 border-blue-500/30 text-blue-400'
                    : 'bg-slate-950/40 border-slate-900 text-slate-400 hover:bg-slate-800/40'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedGroupId(g.id)}
                  className="min-w-0 flex-1 bg-transparent border-0 text-left px-4 py-2.5 text-xs font-semibold text-inherit cursor-pointer"
                >
                  {g.name} ({g.id})
                  {g.systemUseYn === 'Y' && (
                    <span className="ml-2 text-[9px] font-bold text-amber-400">SYSTEM</span>
                  )}
                </button>
                <div className="flex items-center gap-1 pr-2">
                  {canUpdate && <ListIconButton
                    onClick={() => handleEditGroup(g)}
                    label={`${g.name} 수정`}
                    icon={Edit2}
                    tone="accent"
                  />}
                  {canDelete && g.systemUseYn !== 'Y' && (
                    <ListIconButton
                      onClick={() => void handleDeleteGroup(g)}
                      label={`${g.name} 삭제`}
                      icon={Trash2}
                      tone="danger"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Code Items Detail column */}
      <div className="lg:col-span-2 space-y-6">
        {/* Item Form Card */}
        {(canCreate || itemEditingId) && <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
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
                onChange={(e) => setLegalInspectYn(e.target.value as YesNo)}
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
        </div>}

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
                        {canUpdate && <ListIconButton
                          onClick={() => {
                            setItemEditingId(item.id);
                            setItemId(item.id);
                            setItemName(item.name);
                            setLegalInspectYn(item.legalInspectYn);
                            setSortOrder(item.sortOrder);
                          }}
                          label={`${item.name} 수정`}
                          icon={Edit2}
                          tone="accent"
                        />}
                        {canDelete && <ListIconButton
                          onClick={() => handleItemDelete(item.id)}
                          label={`${item.name} 삭제`}
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
    </div>
  );
}
