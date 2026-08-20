import { useCallback, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { requestConfirmation } from '../utils/userActionDialog';
import { useAuthStore } from '../store/useAuthStore';
import { hasModuleCreate } from '../utils/moduleAccess';
import { toastApiError } from '../utils/apiError';
import ListIconButton from '../components/ListIconButton';
import { APP_MODULE } from '../constants/module';
import { inventoryApi } from '../features/inventory/inventory.api';
import type { Inventory as InventoryModel, InventoryFormValues } from '../features/inventory/inventory.types';
import { mdmLookupApi } from '../features/mdm/reference.api';
import type { CodeItem } from '../features/mdm/mdm.types';
import { downloadBlob } from '../utils/downloadBlob';
import { openListPrint } from '../utils/listPrint';
import { formatPrintStamp } from '../utils/datetime';
import InventoryFormModal from '../features/inventory/components/InventoryFormModal';
import {
  Package, Plus, Edit2, Trash2, Printer, FileSpreadsheet
} from 'lucide-react';

export default function Inventory() {
  const user = useAuthStore((state) => state.user);
  const canCreate = hasModuleCreate(user?.moduleAccess, APP_MODULE.INV);
  const canUpdate = canCreate;
  const canDelete = canCreate;
  const [inventories, setInventories] = useState<InventoryModel[]>([]);
  const [inventoryTypes, setInventoryTypes] = useState<CodeItem[]>([]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formValues, setFormValues] = useState<InventoryFormValues | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [searchType, setSearchType] = useState<'id' | 'name' | 'maker'>('id');
  const [searchValue, setSearchValue] = useState('');

  const loadList = useCallback(async () => {
    try {
      // 폼 선택값 구성을 위한 시스템 참조값 조회다. 자재 마스터 R 권한을 대체하지 않는다.
      const [loadedInventories, loadedTypes] = await Promise.all([
        inventoryApi.getAll(),
        mdmLookupApi.getInventoryTypeOptions(),
      ]);
      setInventories(loadedInventories);
      setInventoryTypes(loadedTypes);
    } catch (err) {
      console.error(err);
      toastApiError(err, '목록을 불러오지 못했습니다.');
    }
  }, []);

  useEffect(() => {
    const run = async () => {
      await loadList();
    };
    void run();
  }, [loadList]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormValues({
      id: '', name: '', invTypeCode: inventoryTypes[0]?.id || '',
      unit: '', makerName: '', spec: '',
      model: '', serialNumber: '', safetyQty: 0, reorderQty: 0,
      leadTimeDays: 0, remarks: '',
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (inv: InventoryModel) => {
    setEditingId(inv.id);
    setFormValues({
      id: inv.id, name: inv.name, invTypeCode: inv.invTypeCode || '',
      unit: inv.unit || '',
      makerName: inv.makerName || '', spec: inv.spec || '', model: inv.model || '',
      serialNumber: inv.serialNumber || '', safetyQty: Number(inv.safetyQty),
      reorderQty: Number(inv.reorderQty), leadTimeDays: inv.leadTimeDays,
      remarks: inv.remarks || '',
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (invId: string) => {
    if (pendingAction) return;
    setPendingAction(`delete:${invId}`);
    if (!(await requestConfirmation('정말 이 자재 품목을 삭제하시겠습니까?'))) {
      setPendingAction(null);
      return;
    }
    try {
      await inventoryApi.delete(invId);
      toast.success('자재 품목이 삭제되었습니다.');
      await loadList();
    } catch (err) {
      toastApiError(err, '삭제에 실패했습니다.');
    } finally {
      setPendingAction(null);
    }
  };

  const handleFormSubmit = async (values: InventoryFormValues) => {
    if (!values.id || !values.name) return;

    setIsLoading(true);
    const payload = {
      id: values.id, name: values.name, invTypeCode: values.invTypeCode,
      unit: values.unit || null,
      makerName: values.makerName || null, spec: values.spec || null,
      model: values.model || null, serialNumber: values.serialNumber || null,
      safetyQty: values.safetyQty, reorderQty: values.reorderQty,
      leadTimeDays: values.leadTimeDays, remarks: values.remarks || null,
    };

    try {
      if (editingId) await inventoryApi.update(editingId, payload);
      else await inventoryApi.create(payload);
      toast.success('자재 마스터가 저장되었습니다.');
      setIsFormOpen(false);
      await loadList();
    } catch (err) {
      toastApiError(err, '저장 실패.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCsvDownload = async () => {
    if (pendingAction) return;
    setPendingAction('csv');
    try {
      downloadBlob(await inventoryApi.downloadCsv(), 'inventory_export.csv');
    } catch (err) {
      toastApiError(err, 'CSV 다운로드 실패');
    } finally {
      setPendingAction(null);
    }
  };

  const keyword = searchValue.trim().toLowerCase();
  const filteredInventories = inventories.filter((inventory) => {
    if (!keyword) return true;
    const target = searchType === 'id'
      ? inventory.id
      : searchType === 'name' ? inventory.name : inventory.makerName || '';
    return target.toLowerCase().includes(keyword);
  });

  const handlePrint = () => {
    const stamp = formatPrintStamp(new Date());
    const opened = openListPrint({
      title: '자재 마스터 목록',
      rows: filteredInventories,
      getRowKey: (inventory) => inventory.id,
      companyName: user?.companyName || user?.companyId || 'CMMS',
      printerName: user?.name || '-',
      printedAt: stamp,
      emptyMessage: '등록된 자재가 없습니다.',
      columns: [
        { header: '자재코드', render: (inventory) => inventory.id, className: 'font-mono' },
        { header: '자재명', render: (inventory) => inventory.name },
        { header: '타입명', render: (inventory) => inventoryTypes.find((type) => type.id === inventory.invTypeCode)?.name || inventory.invTypeCode || '-' },
        { header: '단위', render: (inventory) => inventory.unit || '-' },
        { header: '제조사', render: (inventory) => inventory.makerName || '-' },
        { header: '모델', render: (inventory) => inventory.model || '-' },
        { header: '스펙', render: (inventory) => inventory.spec || '-' },
      ],
    });
    if (!opened) toast.error('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.');
  };
  return (
    <div className="space-y-6">
      {/* Header and top actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Package size={24} className="text-blue-500" />
            자재 마스터
          </h1>
          <p className="text-slate-400 text-sm mt-1">부품 및 자재 품목을 마스터에 등록하고 안전재고 기준을 설정합니다.</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleCsvDownload}
            disabled={pendingAction === 'csv'}
            className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileSpreadsheet size={14} />
            CSV
          </button>
          <button
            onClick={handlePrint}
            className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Printer size={14} />
            목록 인쇄
          </button>
          {canCreate && <button
            onClick={handleOpenCreate}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border-0"
          >
            <Plus size={15} />
            입력
          </button>}
        </div>
      </div>

      {/* Grid container */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 print:border-0 print:bg-transparent print:p-0">
        <div className="mb-4 flex gap-2 print:hidden">
          <select value={searchType} onChange={(event) => setSearchType(event.target.value as typeof searchType)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 outline-none">
            <option value="id">자재코드</option>
            <option value="name">자재명</option>
            <option value="maker">제조사</option>
          </select>
          <input value={searchValue} onChange={(event) => setSearchValue(event.target.value)} placeholder="검색어 입력" className="flex-1 min-w-[180px] bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 outline-none" />
        </div>
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40 print:border-slate-300 print:bg-white print:rounded-none">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 select-none print:bg-slate-100 print:text-slate-800 print:border-slate-300">
                <th className="p-3 font-semibold">자재코드</th>
                <th className="p-3 font-semibold">자재명</th>
                <th className="p-3 font-semibold">타입명</th>
                <th className="p-3 font-semibold">단위</th>
                <th className="p-3 font-semibold">제조사</th>
                <th className="p-3 font-semibold">모델</th>
                <th className="p-3 font-semibold">스펙</th>
                <th className="p-3 font-semibold text-right print:hidden">작업</th>
              </tr>
            </thead>
            <tbody>
              {filteredInventories.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-slate-600 print:text-slate-400">등록된 자재가 없습니다.</td></tr>
              ) : (
                filteredInventories.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-900 hover:bg-slate-900/30 text-slate-300 print:border-slate-200 print:text-slate-800 print:hover:bg-transparent">
                    <td className="p-3 font-mono text-slate-400 print:text-slate-600">{inv.id}</td>
                    <td className="p-3 font-semibold text-slate-200 print:text-slate-900">{inv.name}</td>
                    <td className="p-3 text-slate-400 print:text-slate-600">{inventoryTypes.find((type) => type.id === inv.invTypeCode)?.name || inv.invTypeCode || '-'}</td>
                    <td className="p-3 text-slate-400 print:text-slate-600">{inv.unit || '-'}</td>
                    <td className="p-3 text-slate-400 print:text-slate-600">{inv.makerName || '-'}</td>
                    <td className="p-3 text-slate-400 print:text-slate-600">{inv.model || '-'}</td>
                    <td className="p-3 text-slate-400 print:text-slate-600">{inv.spec || '-'}</td>
                    <td className="p-3 text-right space-x-2 print:hidden">
                      {canUpdate && <ListIconButton
                        onClick={() => handleOpenEdit(inv)}
                        disabled={pendingAction !== null}
                        label={`${inv.name} 상세/수정`}
                        icon={Edit2}
                        tone="accent"
                      />}
                      {canDelete && <ListIconButton
                        onClick={() => handleDelete(inv.id)}
                        disabled={pendingAction !== null}
                        label={`${inv.name} 삭제`}
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

      {isFormOpen && formValues && (
        <InventoryFormModal
          key={editingId || 'create'}
          editingId={editingId}
          initialValues={formValues}
          inventoryTypes={inventoryTypes}
          isSaving={isLoading}
          onClose={() => setIsFormOpen(false)}
          onSubmit={handleFormSubmit}
        />
      )}
    </div>
  );
}
