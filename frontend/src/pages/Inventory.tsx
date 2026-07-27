import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { requestConfirmation } from '../utils/userActionDialog';
import { useAuthStore } from '../store/useAuthStore';
import { getApiErrorMessage } from '../utils/apiError';
import ListIconButton from '../components/ListIconButton';
import { APP_MODULE } from '../constants/module';
import { inventoryApi } from '../features/inventory/inventory.api';
import type { Inventory as InventoryModel, InventoryFormValues } from '../features/inventory/inventory.types';
import { referenceApi } from '../features/mdm/reference.api';
import type { CodeItem, Department } from '../features/mdm/mdm.types';
import { downloadBlob } from '../utils/downloadBlob';
import { openListPrint } from '../utils/listPrint';
import InventoryFormModal from '../features/inventory/components/InventoryFormModal';
import {
  Package, Plus, Edit2, Trash2, Printer, FileSpreadsheet
} from 'lucide-react';

export default function Inventory() {
  const user = useAuthStore((state) => state.user);
  const permission = user?.permissions?.[APP_MODULE.INV];
  const canCreate = permission?.C === 'Y';
  const canUpdate = permission?.U === 'Y';
  const canDelete = permission?.D === 'Y';
  const [inventories, setInventories] = useState<InventoryModel[]>([]);
  const [depts, setDepts] = useState<Department[]>([]);
  const [inventoryTypes, setInventoryTypes] = useState<CodeItem[]>([]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formValues, setFormValues] = useState<InventoryFormValues | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const departmentNames = useMemo(
    () => new Map(depts.map((department) => [department.id, department.name])),
    [depts],
  );

  const fetchData = async () => {
    try {
      const [loadedInventories, loadedDepartments, loadedTypes] = await Promise.all([
        inventoryApi.getAll(),
        referenceApi.getDepartments(),
        referenceApi.getCodes('INV_TYPE'),
      ]);
      setInventories(loadedInventories);
      setDepts(loadedDepartments);
      setInventoryTypes(loadedTypes);
    } catch (err) {
      console.error(err);
      toast.error(getApiErrorMessage(err, '목록을 불러오지 못했습니다.'));
    }
  };

  useEffect(() => {
    let active = true;
    void Promise.all([
      inventoryApi.getAll(),
      referenceApi.getDepartments(),
      referenceApi.getCodes('INV_TYPE'),
    ]).then(([loadedInventories, loadedDepartments, loadedTypes]) => {
      if (!active) return;
      setInventories(loadedInventories);
      setDepts(loadedDepartments);
      setInventoryTypes(loadedTypes);
    }).catch((err) => {
      if (active) toast.error(getApiErrorMessage(err, '목록을 불러오지 못했습니다.'));
    });
    return () => { active = false; };
  }, []);

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormValues({
      id: '', name: '', invTypeCode: inventoryTypes[0]?.id || '',
      departmentId: depts[0]?.id || '', unit: '', makerName: '', spec: '',
      model: '', serialNumber: '', safetyQty: 0, reorderQty: 0,
      leadTimeDays: 0, remarks: '',
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (inv: InventoryModel) => {
    setEditingId(inv.id);
    setFormValues({
      id: inv.id, name: inv.name, invTypeCode: inv.invTypeCode || '',
      departmentId: inv.departmentId || '', unit: inv.unit || '',
      makerName: inv.makerName || '', spec: inv.spec || '', model: inv.model || '',
      serialNumber: inv.serialNumber || '', safetyQty: inv.safetyQty,
      reorderQty: inv.reorderQty, leadTimeDays: inv.leadTimeDays,
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
      fetchData();
    } catch (err) {
      toast.error(getApiErrorMessage(err, '삭제에 실패했습니다.'));
    } finally {
      setPendingAction(null);
    }
  };

  const handleFormSubmit = async (values: InventoryFormValues) => {
    if (!values.id || !values.name) return;

    setIsLoading(true);
    try {
      const payload = {
        id: values.id, name: values.name, invTypeCode: values.invTypeCode,
        departmentId: values.departmentId || null, unit: values.unit || null,
        makerName: values.makerName || null, spec: values.spec || null,
        model: values.model || null, serialNumber: values.serialNumber || null,
        safetyQty: values.safetyQty, reorderQty: values.reorderQty,
        leadTimeDays: values.leadTimeDays, remarks: values.remarks || null,
      };

      if (editingId) await inventoryApi.update(editingId, payload);
      else await inventoryApi.create(payload);
      toast.success('자재 마스터가 저장되었습니다.');
      setIsFormOpen(false);
      fetchData();
    } catch (err) {
      toast.error(getApiErrorMessage(err, '저장 실패.'));
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
      toast.error(getApiErrorMessage(err, 'CSV 다운로드 실패'));
    } finally {
      setPendingAction(null);
    }
  };

  const handlePrint = () => {
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;
    const opened = openListPrint({
      title: '자재 마스터 목록',
      rows: inventories,
      getRowKey: (inventory) => inventory.id,
      companyName: user?.companyName || user?.companyId || 'CMMS',
      printerName: user?.name || '-',
      printedAt: stamp,
      emptyMessage: '등록된 자재가 없습니다.',
      columns: [
        { header: '자재코드', render: (inventory) => inventory.id, className: 'font-mono' },
        { header: '자재명', render: (inventory) => inventory.name },
        { header: '단위', render: (inventory) => inventory.unit || '-' },
        { header: '부서', render: (inventory) => departmentNames.get(inventory.departmentId ?? '') || inventory.departmentId || '-' },
        { header: '제조사', render: (inventory) => inventory.makerName || '-' },
        { header: '모델', render: (inventory) => inventory.model || '-' },
        { header: '안전재고', render: (inventory) => inventory.safetyQty },
        { header: '재주문점', render: (inventory) => inventory.reorderQty },
        { header: '리드타임', render: (inventory) => `${inventory.leadTimeDays}일` },
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
            자재/재고 마스터 관리
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
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40 print:border-slate-300 print:bg-white print:rounded-none">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 select-none print:bg-slate-100 print:text-slate-800 print:border-slate-300">
                <th className="p-3 font-semibold">자재코드</th>
                <th className="p-3 font-semibold">자재명</th>
                <th className="p-3 font-semibold">단위</th>
                <th className="p-3 font-semibold">부서</th>
                <th className="p-3 font-semibold">제조사</th>
                <th className="p-3 font-semibold">모델</th>
                <th className="p-3 font-semibold">안전재고</th>
                <th className="p-3 font-semibold">재주문점</th>
                <th className="p-3 font-semibold">리드타임</th>
                <th className="p-3 font-semibold text-right print:hidden">작업</th>
              </tr>
            </thead>
            <tbody>
              {inventories.length === 0 ? (
                <tr><td colSpan={10} className="p-8 text-center text-slate-600 print:text-slate-400">등록된 자재가 없습니다.</td></tr>
              ) : (
                inventories.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-900 hover:bg-slate-900/30 text-slate-300 print:border-slate-200 print:text-slate-800 print:hover:bg-transparent">
                    <td className="p-3 font-mono text-slate-400 print:text-slate-600">{inv.id}</td>
                    <td className="p-3 font-semibold text-slate-200 print:text-slate-900">{inv.name}</td>
                    <td className="p-3 text-slate-400 print:text-slate-600">{inv.unit || '-'}</td>
                    <td className="p-3">{departmentNames.get(inv.departmentId ?? '') || inv.departmentId || '-'}</td>
                    <td className="p-3 text-slate-400 print:text-slate-600">{inv.makerName || '-'}</td>
                    <td className="p-3 text-slate-400 print:text-slate-600">{inv.model || '-'}</td>
                    <td className="p-3 font-semibold text-slate-300 print:text-slate-800">{inv.safetyQty}</td>
                    <td className="p-3 text-slate-400 print:text-slate-600">{inv.reorderQty}</td>
                    <td className="p-3 text-slate-400 print:text-slate-600">{inv.leadTimeDays}일</td>
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
          departments={depts}
          inventoryTypes={inventoryTypes}
          isSaving={isLoading}
          onClose={() => setIsFormOpen(false)}
          onSubmit={handleFormSubmit}
        />
      )}
    </div>
  );
}
