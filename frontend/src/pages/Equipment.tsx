import { useCallback, useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { requestConfirmation } from '../utils/userActionDialog';
import { useAuthStore } from '../store/useAuthStore';
import { toastApiError } from '../utils/apiError';
import { formatDateOnly, formatPrintStamp } from '../utils/datetime';
import { APP_MODULE } from '../constants/module';
import { equipmentApi } from '../features/equipment/equipment.api';
import type { Equipment as EquipmentModel, EquipmentFormValues } from '../features/equipment/equipment.types';
import { mdmLookupApi } from '../features/mdm/reference.api';
import type { CodeItem, Plant } from '../features/mdm/mdm.types';
import { downloadBlob } from '../utils/downloadBlob';
import { openListPrint } from '../utils/listPrint';
import EquipmentFormModal from '../features/equipment/components/EquipmentFormModal';
import ListIconButton from '../components/ListIconButton';
import {
  Wrench, Plus, Edit2, Trash2, Printer, FileSpreadsheet
} from 'lucide-react';
import { hasModuleCreate } from '../utils/moduleAccess';

export default function Equipment() {
  const user = useAuthStore((state) => state.user);
  const activePlantId = useAuthStore((state) => state.activePlantId);
  const canCreate = hasModuleCreate(user?.moduleAccess, APP_MODULE.EQP);
  const canUpdate = canCreate;
  const canDelete = canCreate;
  const [equipments, setEquipments] = useState<EquipmentModel[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [equipmentTypes, setEquipmentTypes] = useState<CodeItem[]>([]);
  const [checkTypes, setCheckTypes] = useState<CodeItem[]>([]);
  const [searchType, setSearchType] = useState<'id' | 'name' | 'maker'>('id');
  const [searchValue, setSearchValue] = useState('');

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formValues, setFormValues] = useState<EquipmentFormValues | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const plantNames = useMemo(
    () => new Map(plants.map((plant) => [plant.id, plant.name])),
    [plants],
  );

  const loadList = useCallback(async () => {
    try {
      // 폼 선택값 구성을 위한 시스템 참조값 조회다. 설비 마스터 R 권한을 대체하지 않는다.
      const [loadedEquipments, loadedPlants, loadedEquipmentTypes, loadedCheckTypes] = await Promise.all([
        equipmentApi.getAll(),
        mdmLookupApi.getPlantOptions(activePlantId),
        mdmLookupApi.getEquipmentTypeOptions(),
        mdmLookupApi.getPmTypeOptions(),
      ]);
      setEquipments(loadedEquipments);
      setPlants(loadedPlants);
      setEquipmentTypes(loadedEquipmentTypes);
      setCheckTypes(loadedCheckTypes);
    } catch (err) {
      console.error(err);
      toastApiError(err, '목록을 불러오지 못했습니다.');
    }
  }, [activePlantId]);

  useEffect(() => {
    const run = async () => {
      await loadList();
    };
    void run();
  }, [loadList]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setFormValues({
      id: '',
      plantId: plants[0]?.id || '',
      name: '',
      location: '',
      eqTypeCode: equipmentTypes[0]?.id || '',
      installDate: '',
      workPermitYn: 'N',
      makerName: '',
      spec: '',
      model: '',
      serialNumber: '',
      remarks: '',
      checkCycles: [],
    });
    setIsFormOpen(true);
  };

  const loadDetail = async (eq: EquipmentModel) => {
    if (pendingAction) return;
    setPendingAction(`edit:${eq.plantId}:${eq.id}`);
    try {
      const data = await equipmentApi.getDetail(eq.plantId, eq.id);
      const targetEq = data.equipment;

      setEditingId(targetEq.id);
      setFormValues({
        id: targetEq.id,
        plantId: targetEq.plantId,
        name: targetEq.name,
        location: targetEq.location || '',
        eqTypeCode: targetEq.eqTypeCode || '',
        installDate: formatDateOnly(targetEq.installDate),
        workPermitYn: targetEq.workPermitYn || 'N',
        makerName: targetEq.makerName || '',
        spec: targetEq.spec || '',
        model: targetEq.model || '',
        serialNumber: targetEq.serialNumber || '',
        remarks: targetEq.remarks || '',
        checkCycles: (data.checkCycles || []).map((cycle) => ({
          ...cycle,
          lastCheckDate: formatDateOnly(cycle.lastCheckDate) || null,
          nextCheckDate: formatDateOnly(cycle.nextCheckDate) || null,
        })),
      });

      setIsFormOpen(true);
    } catch (err) {
      toastApiError(err, '설비 상세 내역을 불러오지 못했습니다.');
    } finally {
      setPendingAction(null);
    }
  };

  const handleDelete = async (eq: EquipmentModel) => {
    if (pendingAction) return;
    setPendingAction(`delete:${eq.plantId}:${eq.id}`);
    if (!(await requestConfirmation('정말 이 설비를 삭제하시겠습니까?'))) {
      setPendingAction(null);
      return;
    }
    try {
      await equipmentApi.delete(eq.plantId, eq.id);
      toast.success('설비가 성공적으로 삭제되었습니다.');
      await loadList();
    } catch (err) {
      toastApiError(err, '설비 삭제 실패.');
    } finally {
      setPendingAction(null);
    }
  };

  const handleFormSubmit = async (values: EquipmentFormValues) => {
    if (!values.id || !values.name || !values.plantId) return;

    setIsLoading(true);
    try {
      const payload = {
        equipment: {
          id: values.id, plantId: values.plantId, name: values.name,
          location: values.location || null, eqTypeCode: values.eqTypeCode || null,
          installDate: values.installDate || null, workPermitYn: values.workPermitYn,
          makerName: values.makerName || null, spec: values.spec || null,
          model: values.model || null, serialNumber: values.serialNumber || null,
          remarks: values.remarks || null,
        },
        checkCycles: values.checkCycles.map(c => ({
          checkTypeCode: c.checkTypeCode,
          cycleVal: c.cycleVal ? Number(c.cycleVal) : null,
          cycleUnit: c.cycleUnit,
          lastCheckDate: c.lastCheckDate || null,
          nextCheckDate: c.nextCheckDate || null,
        }))
      };

      if (editingId) await equipmentApi.update(payload);
      else await equipmentApi.create(payload);
      toast.success('설비 정보가 성공적으로 저장되었습니다.');
      setIsFormOpen(false);
      await loadList();
    } catch (err) {
      toastApiError(err, '저장 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCsvDownload = async () => {
    if (pendingAction) return;
    setPendingAction('csv');
    try {
      downloadBlob(await equipmentApi.downloadCsv(), 'equipments_export.csv');
    } catch (err) {
      toastApiError(err, 'CSV 다운로드 실패');
    } finally {
      setPendingAction(null);
    }
  };

  const handlePrint = () => {
    const stamp = formatPrintStamp(new Date());
    const opened = openListPrint({
      title: '설비 마스터 목록',
      rows: filteredEquipments,
      getRowKey: (equipment) => `${equipment.plantId}:${equipment.id}`,
      companyName: user?.companyName || user?.companyId || 'CMMS',
      printerName: user?.name || '-',
      printedAt: stamp,
      emptyMessage: '등록된 설비가 없습니다.',
      columns: [
        { header: '설비코드', render: (equipment) => equipment.id, className: 'font-mono' },
        { header: '설비명', render: (equipment) => equipment.name },
        { header: '타입명', render: (equipment) => equipmentTypes.find((type) => type.id === equipment.eqTypeCode)?.name || equipment.eqTypeCode || '-' },
        { header: '사업장명', render: (equipment) => plantNames.get(equipment.plantId) || equipment.plantId },
        { header: '설치위치', render: (equipment) => equipment.location || '-' },
        { header: '설치일자', render: (equipment) => formatDateOnly(equipment.installDate) || '-' },
        { header: '제조사', render: (equipment) => equipment.makerName || '-' },
        { header: '모델', render: (equipment) => equipment.model || '-' },
        { header: '스펙', render: (equipment) => equipment.spec || '-' },
        { header: '지난점검일', render: (equipment) => formatDateOnly(equipment.lastCheckDate) || '-' },
        { header: '다음점검일', render: (equipment) => formatDateOnly(equipment.nextCheckDate) || '-' },
      ],
    });
    if (!opened) toast.error('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.');
  };

  const keyword = searchValue.trim().toLowerCase();
  const filteredEquipments = equipments.filter((equipment) => {
    if (!keyword) return true;
    const target = searchType === 'id'
      ? equipment.id
      : searchType === 'name' ? equipment.name : equipment.makerName || '';
    return target.toLowerCase().includes(keyword);
  });
  return (
    <div className="space-y-6">
      {/* Header and top buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Wrench size={24} className="text-blue-500" />
            설비 마스터 관리
          </h1>
          <p className="text-slate-400 text-sm mt-1">공장 내 설비 목록을 등록하고 각 설비별 정기 점검 항목을 지정합니다.</p>
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

      {/* Search and Grid (print:block) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 print:border-0 print:bg-transparent print:p-0">
        <div className="mb-4 flex gap-2 print:hidden">
          <select
            value={searchType}
            onChange={(event) => setSearchType(event.target.value as typeof searchType)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 outline-none"
          >
            <option value="id">설비코드</option>
            <option value="name">설비명</option>
            <option value="maker">제조사</option>
          </select>
          <input value={searchValue} onChange={(event) => setSearchValue(event.target.value)} placeholder="검색어 입력" className="flex-1 min-w-[180px] bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 outline-none" />
        </div>

        {/* Equipment Table Grid */}
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40 print:border-slate-300 print:bg-white print:rounded-none">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 select-none print:bg-slate-100 print:text-slate-800 print:border-slate-300">
                <th className="p-3 font-semibold">설비코드</th>
                <th className="p-3 font-semibold">설비명</th>
                <th className="p-3 font-semibold">타입명</th>
                <th className="p-3 font-semibold">사업장명</th>
                <th className="p-3 font-semibold">설치위치</th>
                <th className="p-3 font-semibold">설치일자</th>
                <th className="p-3 font-semibold">제조사</th>
                <th className="p-3 font-semibold">모델</th>
                <th className="p-3 font-semibold">스펙</th>
                <th className="p-3 font-semibold">지난 점검일</th>
                <th className="p-3 font-semibold">다음 점검일</th>
                <th className="p-3 font-semibold text-right print:hidden">작업</th>
              </tr>
            </thead>
            <tbody>
              {filteredEquipments.length === 0 ? (
                <tr><td colSpan={12} className="p-8 text-center text-slate-600 print:text-slate-400">등록된 설비 내역이 없습니다.</td></tr>
              ) : (
                filteredEquipments.map((eq) => (
                  <tr key={eq.id} className="border-b border-slate-900 hover:bg-slate-900/30 text-slate-300 print:border-slate-200 print:text-slate-800 print:hover:bg-transparent">
                    <td className="p-3 font-mono text-slate-400 print:text-slate-600">{eq.id}</td>
                    <td className="p-3 font-semibold text-slate-200 print:text-slate-900">{eq.name}</td>
                    <td className="p-3">{equipmentTypes.find((type) => type.id === eq.eqTypeCode)?.name || eq.eqTypeCode || '-'}</td>
                    <td className="p-3">{plantNames.get(eq.plantId) || eq.plantId}</td>
                    <td className="p-3 text-slate-400 print:text-slate-600">{eq.location || '-'}</td>
                    <td className="p-3 text-slate-400 print:text-slate-600">{formatDateOnly(eq.installDate) || '-'}</td>
                    <td className="p-3 text-slate-400 print:text-slate-600">{eq.makerName || '-'}</td>
                    <td className="p-3 text-slate-400 print:text-slate-600">{eq.model || '-'}</td>
                    <td className="p-3 text-slate-400 print:text-slate-600">{eq.spec || '-'}</td>
                    <td className="p-3 text-slate-400 print:text-slate-600">{formatDateOnly(eq.lastCheckDate) || '-'}</td>
                    <td className="p-3 font-semibold text-amber-500 print:text-black">{formatDateOnly(eq.nextCheckDate) || '-'}</td>
                    <td className="p-3 text-right space-x-2 print:hidden">
                      {canUpdate && <ListIconButton
                          onClick={() => loadDetail(eq)}
                        disabled={pendingAction !== null}
                        label={`${eq.name} 상세/수정`}
                        icon={Edit2}
                        tone="accent"
                      />}
                      {canDelete && <ListIconButton
                        onClick={() => handleDelete(eq)}
                        disabled={pendingAction !== null}
                        label={`${eq.name} 삭제`}
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
        <EquipmentFormModal
          key={editingId || 'create'}
          editingId={editingId}
          initialValues={formValues}
          plants={plants}
          equipmentTypes={equipmentTypes}
          checkTypes={checkTypes}
          isSaving={isLoading}
          onClose={() => setIsFormOpen(false)}
          onSubmit={handleFormSubmit}
        />
      )}
    </div>
  );
}
