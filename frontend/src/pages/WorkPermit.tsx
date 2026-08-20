import { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { toast } from 'sonner';
import { requestConfirmation } from '../utils/userActionDialog';
import { useAuthStore } from '../store/useAuthStore';
import { hasModuleCreate } from '../utils/moduleAccess';
import { getCommonStatusLabel as getStatusLabel } from '../constants/status';
import { APP_MODULE } from '../constants/module';
import {
  formatDateOnly,
  formatDateTime,
  formatPrintStamp,
  nowLocalInput,
  utcToInput,
  inputToUtc,
} from '../utils/datetime';
import { toastApiError } from '../utils/apiError';
import WorkPermitPrint from '../components/WorkPermitPrint';
import PrintWindowLayout from '../components/PrintWindowLayout';
import { openPrintWindow } from '../utils/printWindow';
import { openListPrint } from '../utils/listPrint';
import ApprovalDraftModal from '../features/approval/components/ApprovalDraftModal';
import ListIconButton from '../components/ListIconButton';
import type { RichTextDocument } from '../types/richText';
import { createWorkPermitApprovalContent } from '../utils/workPermitApprovalContent';
import { loadApprovalSignatureSteps } from '../features/approval/approval-signature';
import type {
  WorkPermit as WorkPermitModel,
  WorkPermitCheckItem as CheckItem,
} from '../features/work-permit/work-permit.types';
import { workPermitApi } from '../features/work-permit/work-permit.api';
import { workOrderApi } from '../features/work-order/work-order.api';
import { mdmLookupApi } from '../features/mdm/reference.api';
import { masterLookupApi } from '../features/master/master-reference.api';
import DocumentListPanel from '../components/DocumentListPanel';
import WorkPermitFormModal from '../features/work-permit/components/WorkPermitFormModal';
import {
  INITIAL_CONFINED,
  INITIAL_ELECTRIC,
  INITIAL_EXCAVATION,
  INITIAL_FIRE,
  INITIAL_GENERAL,
  INITIAL_HEAVY_LOAD,
  INITIAL_HIGH_PLACE,
  parseCheckItems,
} from '../features/work-permit/work-permit.defaults';
import {
  ClipboardList, Edit2, Printer, Plus
} from 'lucide-react';

export default function WorkPermit() {
  const user = useAuthStore((s) => s.user);
  const activePlantId = useAuthStore((s) => s.activePlantId);
  const [activeTab, setActiveTab] = useState<'plans' | 'results'>('plans');
  const [searchType, setSearchType] = useState<'id' | 'title' | 'supervisor'>('id');
  const [searchValue, setSearchValue] = useState('');
  const [tempOnly, setTempOnly] = useState(false);


  const [permits, setPermits] = useState<WorkPermitModel[]>([]);
  const [equipments, setEquipments] = useState<{ id: string; name: string; plantId: string }[]>([]);
  const [depts, setDepts] = useState<{ id: string; name: string }[]>([]);
  const [usersList, setUsersList] = useState<{ id: string; name: string; title?: string | null; position?: string | null }[]>([]);
  const [workOrders, setWorkOrders] = useState<{ id: string; title: string }[]>([]);

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Fields for WorkPermit
  const [wpNo, setWpNo] = useState('');
  const [plantId, setPlantId] = useState('');
  const [equipmentId, setEquipmentId] = useState('');
  const [equipmentName, setEquipmentName] = useState('');
  const [workOrderId, setWorkOrderId] = useState('');
  const [title, setTitle] = useState('');
  const [stepStage, setStepStage] = useState('P');
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['GENERAL']); // GENERAL is always selected
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [supervisorId, setSupervisorId] = useState('');
  const [workSummary, setWorkSummary] = useState('');
  const [riskFactors, setRiskFactors] = useState('');
  const [safetyMeasures, setSafetyMeasures] = useState('');
  const [remarks, setRemarks] = useState('');
  const [refNo, setRefNo] = useState('');
  const [refModule, setRefModule] = useState('');
  const [approvalId, setApprovalId] = useState('');
  const [fileGroupId, setFileGroupId] = useState<number | null>(null);
  const [createdAt, setCreatedAt] = useState('');
  const [createdBy, setCreatedBy] = useState('');
  const [recordStatus, setRecordStatus] = useState('T');

  // JSON Checksheets
  const [genChecks, setGenChecks] = useState<CheckItem[]>(INITIAL_GENERAL);
  const [fireChecks, setFireChecks] = useState<CheckItem[]>(INITIAL_FIRE);
  const [confChecks, setConfChecks] = useState<CheckItem[]>(INITIAL_CONFINED);
  const [elecChecks, setElecChecks] = useState<CheckItem[]>(INITIAL_ELECTRIC);
  const [highChecks, setHighChecks] = useState<CheckItem[]>(INITIAL_HIGH_PLACE);
  const [excaChecks, setExcaChecks] = useState<CheckItem[]>(INITIAL_EXCAVATION);
  const [heavyChecks, setHeavyChecks] = useState<CheckItem[]>(INITIAL_HEAVY_LOAD);

  // Accordion Expand states
  const [accordionOpen, setAccordionOpen] = useState<{ [key: string]: boolean }>({
    GENERAL: true,
    FIRE: false,
    CONFINED: false,
    ELECTRIC: false,
    HIGH_PLACE: false,
    EXCAVATION: false,
    HEAVY_LOAD: false
  });

  const [isLoading, setIsLoading] = useState(false);
  const [approvalRef, setApprovalRef] = useState<{
    refNo: string;
    title: string;
    content: RichTextDocument;
  } | null>(null);

  const canCreate = hasModuleCreate(user?.moduleAccess, APP_MODULE.WP);
  const canUpdate = canCreate;
  const canDelete = canCreate;
  const canEditCurrent = !wpNo
    ? canCreate
    : canUpdate || (recordStatus === 'T' && createdBy === user?.id);
  const canDeleteCurrent = !!wpNo
    && recordStatus === 'T'
    && (canDelete || createdBy === user?.id);
  const currentPermits = permits.filter((permit) =>
    activeTab === 'plans' ? permit.stepStage === 'P' : permit.stepStage === 'R',
  );

  const loadList = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (searchValue) {
        params.set('searchType', searchType);
        params.set('searchValue', searchValue);
      }
      if (tempOnly) params.set('tempOnly', 'Y');
      // 폼 선택값 구성을 위한 시스템 참조값 조회다. 작업허가서 목록 R 권한을 대체하지 않는다.
      const [loadedPermits, loadedEquipments, loadedDepartments, loadedUsers, loadedWorkOrders] = await Promise.all([
        workPermitApi.getAll(params, activePlantId),
        masterLookupApi.getEquipments(),
        mdmLookupApi.getDepartmentOptions(),
        mdmLookupApi.getUserOptions(),
        workOrderApi.getAll(undefined, activePlantId),
      ]);
      setPermits((loadedPermits || []).map((permit: WorkPermitModel & { step_stage?: string }) => ({
        ...permit,
        stepStage: permit.stepStage || permit.step_stage || 'P',
      })));
      setEquipments(loadedEquipments);
      setDepts(loadedDepartments);
      setUsersList(loadedUsers);
      setWorkOrders(loadedWorkOrders);
    } catch (err) {
      toastApiError(err, '목록을 불러오지 못했습니다.');
    }
  }, [activePlantId, searchType, searchValue, tempOnly]);

  // 검색 실행은 버튼이 담당하므로 최초 진입 시에만 자동 조회한다.
  useEffect(() => {
    const run = async () => {
      await loadList();
    };
    void run();
  }, [activeTab, loadList]);

  const toggleAccordion = (type: string) => {
    setAccordionOpen(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const handleTypeToggle = (type: string) => {
    if (type === 'GENERAL') return; // GENERAL cannot be toggled off

    let updated;
    if (selectedTypes.includes(type)) {
      updated = selectedTypes.filter(t => t !== type);
      setAccordionOpen(prev => ({ ...prev, [type]: false }));
    } else {
      updated = [...selectedTypes, type];
      setAccordionOpen(prev => ({ ...prev, [type]: true }));
    }
    setSelectedTypes(updated);
  };

  const handleCheckChange = (
    type: string,
    idx: number,
    field: 'checked' | 'remarks',
    val: boolean | string,
  ) => {
    const updater = (prev: CheckItem[]) => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item);
    switch (type) {
      case 'GENERAL': setGenChecks(updater); break;
      case 'FIRE': setFireChecks(updater); break;
      case 'CONFINED': setConfChecks(updater); break;
      case 'ELECTRIC': setElecChecks(updater); break;
      case 'HIGH_PLACE': setHighChecks(updater); break;
      case 'EXCAVATION': setExcaChecks(updater); break;
      case 'HEAVY_LOAD': setHeavyChecks(updater); break;
    }
  };

  const handleOpenCreate = () => {
    setWpNo('');
    setPlantId(equipments.length > 0 ? equipments[0].plantId : '');
    setEquipmentId(equipments.length > 0 ? equipments[0].id : '');
    setEquipmentName(equipments.length > 0 ? equipments[0].name : '');
    setWorkOrderId('');
    setTitle('');
    setStepStage(activeTab === 'plans' ? 'P' : 'R');
    setSelectedTypes(['GENERAL']);
    setStartAt(nowLocalInput());
    setEndAt(utcToInput(new Date(Date.now() + 8 * 3600 * 1000).toISOString()));
    setDepartmentId(user?.departmentId || (depts.length > 0 ? depts[0].id : ''));
    setSupervisorId(user?.id || '');
    setWorkSummary('');
    setRiskFactors('');
    setSafetyMeasures('');
    setRemarks('');
    setRefNo('');
    setRefModule('');
    setApprovalId('');
    setFileGroupId(null);
    setCreatedAt('');
    setCreatedBy('');
    setRecordStatus('T');

    // Reset checksheets
    setGenChecks(INITIAL_GENERAL);
    setFireChecks(INITIAL_FIRE);
    setConfChecks(INITIAL_CONFINED);
    setElecChecks(INITIAL_ELECTRIC);
    setHighChecks(INITIAL_HIGH_PLACE);
    setExcaChecks(INITIAL_EXCAVATION);
    setHeavyChecks(INITIAL_HEAVY_LOAD);

    setAccordionOpen({
      GENERAL: true, FIRE: false, CONFINED: false, ELECTRIC: false, HIGH_PLACE: false, EXCAVATION: false, HEAVY_LOAD: false
    });

    setIsFormOpen(true);
  };

  const loadDetail = async (wp: WorkPermitModel) => {
    setIsLoading(true);
    try {
      const w = await workPermitApi.getDetail(wp.plantId, wp.id);
      const isRejected = w.status === 'R';

      const matchedEq = equipments.find(e => e.id === w.equipmentId);
      setEquipmentName(matchedEq ? matchedEq.name : w.equipmentId);

      setWpNo(isRejected ? '' : w.id);
      setPlantId(w.plantId);
      setEquipmentId(w.equipmentId);
      setWorkOrderId(w.workOrderId || '');
      setTitle(w.title);
      setStepStage(w.stepStage);
      setSelectedTypes(w.permitTypeCodes.split(','));
      setStartAt(utcToInput(w.startAt));
      setEndAt(utcToInput(w.endAt));
      setDepartmentId(w.departmentId);
      setSupervisorId(w.supervisorId);
      setWorkSummary(w.workSummary || '');
      setRiskFactors(w.riskFactors || '');
      setSafetyMeasures(w.safetyMeasures || '');
      setRemarks(w.remarks || '');
      setRefNo(w.refNo || '');
      setRefModule(w.refModule || '');
      setApprovalId('');
      setFileGroupId(isRejected ? null : w.fileGroupId ?? null);
      setCreatedAt(isRejected ? '' : (w.createdAt || ''));
      setCreatedBy(isRejected ? '' : (w.createdBy || ''));
      setRecordStatus(isRejected ? 'T' : (w.status || 'T'));

      // Parse JSON checksheets
      setGenChecks(parseCheckItems(w.jsonGeneral, INITIAL_GENERAL));
      setFireChecks(parseCheckItems(w.jsonFire, INITIAL_FIRE));
      setConfChecks(parseCheckItems(w.jsonConfined, INITIAL_CONFINED));
      setElecChecks(parseCheckItems(w.jsonElectric, INITIAL_ELECTRIC));
      setHighChecks(parseCheckItems(w.jsonHighPlace, INITIAL_HIGH_PLACE));
      setExcaChecks(parseCheckItems(w.jsonExcavation, INITIAL_EXCAVATION));
      setHeavyChecks(parseCheckItems(w.jsonHeavyLoad, INITIAL_HEAVY_LOAD));

      // Accordion setup based on selected types
      const types = w.permitTypeCodes.split(',');
      setAccordionOpen({
        GENERAL: true,
        FIRE: types.includes('FIRE'),
        CONFINED: types.includes('CONFINED'),
        ELECTRIC: types.includes('ELECTRIC'),
        HIGH_PLACE: types.includes('HIGH_PLACE'),
        EXCAVATION: types.includes('EXCAVATION'),
        HEAVY_LOAD: types.includes('HEAVY_LOAD')
      });

      setIsFormOpen(true);
    } catch (err) {
      toastApiError(err, '작업허가서 상세 기록을 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!wpNo || !plantId) return;
    if (!(await requestConfirmation('정말 이 작업허가서를 삭제하시겠습니까?'))) return;
    try {
      await workPermitApi.delete(plantId, wpNo);
      toast.success('작업허가서가 삭제되었습니다.');
      setIsFormOpen(false);
      await loadList();
    } catch (err) {
      toastApiError(err, '삭제 실패.');
    }
  };

  const handleSave = async (submitStatus: 'T' | 'P') => {
    if (!title.trim()) {
      toast.error('허가명을 입력해주세요.');
      return;
    }
    setIsLoading(true);
    try {
      const saveStatus = submitStatus === 'P' ? 'T' : submitStatus;
      const payload = {
        id: wpNo || null,
        plantId,
        equipmentId,
        workOrderId: workOrderId || null,
        title,
        stepStage,
        permitTypeCodes: selectedTypes.join(','),
        startAt: inputToUtc(startAt),
        endAt: inputToUtc(endAt),
        departmentId,
        supervisorId,
        workSummary: workSummary || null,
        riskFactors: riskFactors || null,
        safetyMeasures: safetyMeasures || null,
        jsonGeneral: JSON.stringify(genChecks),
        jsonFire: selectedTypes.includes('FIRE') ? JSON.stringify(fireChecks) : null,
        jsonConfined: selectedTypes.includes('CONFINED') ? JSON.stringify(confChecks) : null,
        jsonElectric: selectedTypes.includes('ELECTRIC') ? JSON.stringify(elecChecks) : null,
        jsonHighPlace: selectedTypes.includes('HIGH_PLACE') ? JSON.stringify(highChecks) : null,
        jsonExcavation: selectedTypes.includes('EXCAVATION') ? JSON.stringify(excaChecks) : null,
        jsonHeavyLoad: selectedTypes.includes('HEAVY_LOAD') ? JSON.stringify(heavyChecks) : null,
        remarks: remarks || null,
        fileGroupId,
        refNo: refNo || null,
        refModule: refModule || null,
        approvalId: approvalId || null,
        status: saveStatus
      };

      const saved = wpNo
        ? await workPermitApi.update(payload)
        : await workPermitApi.create(payload);
      if (submitStatus === 'P') {
        const savedId = saved.id;
        setWpNo(savedId);
        const checksheetMap = [
          { id: 'GENERAL', name: '일반위험작업 체크시트', items: genChecks },
          { id: 'FIRE', name: '화기작업 체크시트', items: fireChecks },
          { id: 'CONFINED', name: '밀폐공간출입 체크시트', items: confChecks },
          { id: 'ELECTRIC', name: '정전작업 체크시트', items: elecChecks },
          { id: 'HIGH_PLACE', name: '고소작업 체크시트', items: highChecks },
          { id: 'EXCAVATION', name: '굴착작업 체크시트', items: excaChecks },
          { id: 'HEAVY_LOAD', name: '중량물취급 체크시트', items: heavyChecks },
        ];
        setApprovalRef({
          refNo: savedId,
          title: `[작업허가서] ${title}`,
          content: createWorkPermitApprovalContent({
            wpNo: savedId,
            statusLabel: getStatusLabel('P'),
            createdAt: formatDateOnly(saved.createdAt) || '-',
            departmentName: depts.find((dept) => dept.id === departmentId)?.name || departmentId,
            authorName:
              usersList.find((candidate) => candidate.id === saved.createdBy)?.name
              || saved.createdBy
              || user?.name
              || '-',
            equipmentName: `${equipmentId} / ${equipmentName || equipmentId}`,
            permitTypeName: selectedTypes.map(getWpTypeLabel).join(', '),
            startAt: formatDateTime(inputToUtc(startAt)),
            endAt: formatDateTime(inputToUtc(endAt)),
            supervisorName:
              usersList.find((candidate) => candidate.id === supervisorId)?.name || supervisorId,
            workOrderId,
            workSummary,
            riskFactors,
            safetyMeasures,
            remarks,
            checksheets: checksheetMap
              .filter((sheet) => selectedTypes.includes(sheet.id))
              .map(({ name, items }) => ({ name, items })),
          }),
        });
        return;
      }
      toast.success('임시저장 되었습니다.');
      setIsFormOpen(false);
      loadList();
    } catch (err) {
      toastApiError(err, '저장 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const getWpTypeLabel = (code: string) => {
    return {
      GENERAL: '일반위험작업',
      FIRE: '화기작업',
      CONFINED: '밀폐공간출입',
      ELECTRIC: '정전작업',
      HIGH_PLACE: '고소작업',
      EXCAVATION: '굴착작업',
      HEAVY_LOAD: '중량물취급'
    }[code] || code;
  };

  const openPrintDocument = async (wp: WorkPermitModel) => {
    const printTarget = openPrintWindow({ title: '안전작업허가서 출력', rootId: 'wp-print-root' });
    if (!printTarget) {
      toast.error('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.');
      return;
    }
    const { printWindow, container } = printTarget;
    try {
      const data = await workPermitApi.getDetail(wp.plantId, wp.id);
      const detail = { ...wp, ...data } as WorkPermitModel;
      const types = detail.permitTypeCodes.split(',');
      const approvalSteps = await loadApprovalSignatureSteps(detail.approvalId, usersList);
      const printChecksheets = [
        { id: 'GENERAL', name: '일반위험작업 체크시트', state: parseCheckItems(detail.jsonGeneral, INITIAL_GENERAL) },
        { id: 'FIRE', name: '화기작업 체크시트', state: parseCheckItems(detail.jsonFire, INITIAL_FIRE) },
        { id: 'CONFINED', name: '밀폐공간출입 체크시트', state: parseCheckItems(detail.jsonConfined, INITIAL_CONFINED) },
        { id: 'ELECTRIC', name: '정전작업 체크시트', state: parseCheckItems(detail.jsonElectric, INITIAL_ELECTRIC) },
        { id: 'HIGH_PLACE', name: '고소작업 체크시트', state: parseCheckItems(detail.jsonHighPlace, INITIAL_HIGH_PLACE) },
        { id: 'EXCAVATION', name: '굴착작업 체크시트', state: parseCheckItems(detail.jsonExcavation, INITIAL_EXCAVATION) },
        { id: 'HEAVY_LOAD', name: '중량물취급 체크시트', state: parseCheckItems(detail.jsonHeavyLoad, INITIAL_HEAVY_LOAD) },
      ];
      createRoot(container).render(
        <PrintWindowLayout printWindow={printWindow} contentClassName="max-w-[180mm]">
          <WorkPermitPrint
            wpNo={detail.id}
            title={detail.title}
            status={detail.status}
            approvalId={detail.approvalId}
            createdAt={formatDateOnly(detail.createdAt) || '-'}
            authorName={usersList.find((item) => item.id === detail.createdBy)?.name || detail.createdBy || '-'}
            deptName={depts.find((item) => item.id === detail.departmentId)?.name || detail.departmentId}
            supervisorName={usersList.find((item) => item.id === detail.supervisorId)?.name || detail.supervisorId}
            startAt={detail.startAt || ''}
            endAt={detail.endAt || ''}
            equipmentId={detail.equipmentId}
            equipmentName={equipments.find((item) => item.id === detail.equipmentId)?.name || detail.equipmentId}
            workOrderId={detail.workOrderId || '-'}
            permitTypeLabel={types.map(getWpTypeLabel).join(', ')}
            workSummary={detail.workSummary || undefined}
            riskFactors={detail.riskFactors || undefined}
            safetyMeasures={detail.safetyMeasures || undefined}
            remarks={detail.remarks || undefined}
            checksheets={printChecksheets}
            selectedTypes={types}
            approvalSteps={approvalSteps}
          />
        </PrintWindowLayout>,
      );
      printWindow.focus();
    } catch (err) {
      printWindow.close();
      toastApiError(err, '출력 문서를 불러오지 못했습니다.');
    }
  };

  const handlePrint = () => {
    if (currentPermits.length === 0) { toast.error('인쇄할 목록이 없습니다.'); return; }
    const stamp = formatPrintStamp(new Date());
    const opened = openListPrint({
      title: '안전작업허가서 현황',
      rows: currentPermits,
      getRowKey: (permit) => permit.id,
      companyName: user?.companyName || user?.companyId || 'CMMS',
      printerName: user?.name || '-',
      printedAt: stamp,
      columns: [
        { header: '문서번호', render: (permit) => permit.id, className: 'font-mono' },
        { header: '제목', render: (permit) => permit.title },
        { header: '대상설비', render: (permit) => equipments.find((item) => item.id === permit.equipmentId)?.name || permit.equipmentId },
        { header: '담당자', render: (permit) => usersList.find((item) => item.id === permit.createdBy)?.name || permit.createdBy || '-' },
        { header: '감독자', render: (permit) => usersList.find((item) => item.id === permit.supervisorId)?.name || permit.supervisorId },
        { header: '시작 시간', render: (permit) => formatDateTime(permit.startAt) },
        { header: '종료 시간', render: (permit) => formatDateTime(permit.endAt) },
      ],
    });
    if (!opened) toast.error('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.');
  };

  const checksheets = [
    { id: 'GENERAL', name: '일반위험작업 체크시트', state: genChecks },
    { id: 'FIRE', name: '화기작업 체크시트', state: fireChecks },
    { id: 'CONFINED', name: '밀폐공간출입 체크시트', state: confChecks },
    { id: 'ELECTRIC', name: '정전작업 체크시트', state: elecChecks },
    { id: 'HIGH_PLACE', name: '고소작업 체크시트', state: highChecks },
    { id: 'EXCAVATION', name: '굴착작업 체크시트', state: excaChecks },
    { id: 'HEAVY_LOAD', name: '중량물취급 체크시트', state: heavyChecks }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <ClipboardList size={24} className="text-blue-500" />
            안전작업허가서 관리
          </h1>
          <p className="text-slate-400 text-sm mt-1">현장 안전 사고 방지를 위한 작업 유형별 허가서 발급 및 체크시트를 작성합니다.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Printer size={14} />
            목록 인쇄
          </button>

          {canCreate && <button
            onClick={handleOpenCreate}
            className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 transition-colors border-0 cursor-pointer shadow-lg shadow-blue-900/20"
          >
            <Plus size={14} />
            입력
          </button>}
          <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('plans')}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer border-0 outline-none ${
                activeTab === 'plans' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              계획
            </button>
            <button
              onClick={() => setActiveTab('results')}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer border-0 outline-none ${
                activeTab === 'results' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              실적
            </button>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={searchType}
            onChange={(event) => setSearchType(event.target.value as 'id' | 'title' | 'supervisor')}
            className="bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-3 text-xs text-slate-300 outline-none"
          >
            <option value="id">문서번호</option>
            <option value="title">제목</option>
            <option value="supervisor">담당자</option>
          </select>
          <input
            type="text"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && loadList()}
            placeholder="검색어 입력"
            className="flex-1 min-w-[200px] bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-3 text-xs text-slate-300 outline-none"
          />
          <button type="button" onClick={loadList} className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-1.5 text-xs font-semibold cursor-pointer border-0">
            검색
          </button>
          <button
            type="button"
            onClick={() => setTempOnly((current) => !current)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold cursor-pointer ${tempOnly ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-800 bg-slate-950 text-slate-400'}`}
          >
            임시저장 {tempOnly ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Main Grid View — 모달(허가서) 열림 시 인쇄 제외(전용뷰와 중복 방지) */}
      <DocumentListPanel
        isFormOpen={isFormOpen}
        landscape
        heading={<><ClipboardList size={16} className="text-blue-500" /> 작업허가서 목록</>}
        printHeading="작 업 허 가 대 장"
      >
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40 print:border-slate-300 print:bg-white print:rounded-none">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 select-none print:bg-slate-100 print:text-slate-800 print:border-slate-300">
                <th className="p-3 font-semibold">허가번호</th>
                <th className="p-3 font-semibold">허가명</th>
                <th className="p-3 font-semibold">설비명</th>
                <th className="p-3 font-semibold">담당자</th>
                <th className="p-3 font-semibold">감독자</th>
                <th className="p-3 font-semibold">시작 시간</th>
                <th className="p-3 font-semibold">종료 시간</th>
                <th className="p-3 font-semibold text-right print:hidden">작업</th>
              </tr>
            </thead>
            <tbody>
              {currentPermits.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-slate-600 print:text-slate-400">조회된 작업허가서 내역이 없습니다.</td></tr>
              ) : (
                currentPermits.map((wp) => (
                  <tr key={wp.id} className="border-b border-slate-900 hover:bg-slate-900/30 text-slate-300 print:border-slate-200 print:text-slate-800 print:hover:bg-transparent">
                    <td className="p-3 font-mono">
                      <button type="button" onClick={() => openPrintDocument(wp)} className="no-print bg-transparent border-0 p-0 text-blue-400 hover:text-blue-300 hover:underline font-mono cursor-pointer">
                        {wp.id}
                      </button>
                      <span className="hidden print:inline text-slate-600">{wp.id}</span>
                    </td>
                    <td className="p-3 font-semibold text-slate-200 print:text-slate-900">{wp.title}</td>
                    <td className="p-3 text-slate-400">{equipments.find(e => e.id === wp.equipmentId)?.name || wp.equipmentId}</td>
                    <td className="p-3">{usersList.find(u => u.id === wp.createdBy)?.name || wp.createdBy || '-'}</td>
                    <td className="p-3">{usersList.find(u => u.id === wp.supervisorId)?.name || wp.supervisorId}</td>
                    <td className="p-3 font-mono text-slate-400">{formatDateTime(wp.startAt)}</td>
                    <td className="p-3 font-mono text-slate-400">{formatDateTime(wp.endAt)}</td>
                    <td className="p-3 text-right space-x-2 print:hidden">
                      {(canUpdate || (wp.status === 'T' && wp.createdBy === user?.id)) && ['T', 'R'].includes(wp.status) && (
                        <ListIconButton
                          onClick={() => loadDetail(wp)}
                          label="상세/수정"
                          icon={Edit2}
                          tone="accent"
                        />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DocumentListPanel>

      {/* Input / View Detail Modal */}
      {isFormOpen && (
        <WorkPermitFormModal
          title={wpNo ? `작업허가 ${stepStage === 'P' ? '계획' : '실적'} 수정/상세 [${wpNo}] ${equipmentName}` : `신규 작업허가 ${stepStage === 'P' ? '계획' : '실적'} 작성`}
          onClose={() => setIsFormOpen(false)}
          form={{
            wpNo,
            stepStage,
            createdAt,
            departmentId,
            depts,
            createdBy,
            user,
            usersList,
            title,
            setTitle,
            equipmentId,
            plantId,
            activePlantId,
            canEditCurrent,
            canDeleteCurrent,
            setEquipmentId,
            setEquipmentName,
            setPlantId,
            supervisorId,
            setSupervisorId,
            workOrderId,
            setWorkOrderId,
            workOrders,
            startAt,
            setStartAt,
            endAt,
            setEndAt,
            selectedTypes,
            handleTypeToggle,
            getWpTypeLabel,
            workSummary,
            setWorkSummary,
            riskFactors,
            setRiskFactors,
            safetyMeasures,
            setSafetyMeasures,
            checksheets,
            accordionOpen,
            toggleAccordion,
            handleCheckChange,
            isLoading,
            handleSave,
            handleDelete,
          }}
        />
      )}
      <ApprovalDraftModal
        open={!!approvalRef}
        mode="linked"
        refModule={APP_MODULE.WP}
        refNo={approvalRef?.refNo || ''}
        defaultTitle={approvalRef?.title || ''}
        defaultContent={approvalRef?.content}
        users={usersList}
        currentUserId={user?.id}
        onClose={() => setApprovalRef(null)}
        onSubmitted={() => {
          setApprovalRef(null);
          setIsFormOpen(false);
          toast.success('작업허가서 결재 문서가 상신되었습니다.');
          loadList();
        }}
      />
    </div>
  );
}
