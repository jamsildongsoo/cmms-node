import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { toast } from 'sonner';
import { useAuthStore } from '../store/useAuthStore';
import { getCommonStatusLabel as getStatusLabel, getJudgeLabel } from '../constants/status';
import { APP_MODULE } from '../constants/module';
import { formatDateOnly, todayLocal } from '../utils/datetime';
import { toastApiError } from '../utils/apiError';
import PrintHeader from '../components/PrintHeader';
import PmReportPrint from '../components/PmReportPrint';
import PrintWindowLayout from '../components/PrintWindowLayout';
import ApprovalDraftModal from '../features/approval/components/ApprovalDraftModal';
import ListBadge from '../components/ListBadge';
import ListIconButton from '../components/ListIconButton';
import { loadApprovalSignatureSteps } from '../features/approval/approval-signature';
import { openPrintWindow } from '../utils/printWindow';
import { openListPrint } from '../utils/listPrint';
import type { RichTextDocument } from '../types/richText';
import { createPmApprovalContent } from '../utils/pmApprovalContent';
import type { PmRecord, PmRecordItem, PmStage, PmTab } from '../features/pm/pm.types';
import { pmApi } from '../features/pm/pm.api';
import { referenceApi } from '../features/mdm/reference.api';
import { masterReferenceApi } from '../features/master/master-reference.api';
import type { EquipmentReference } from '../features/master/master-reference.types';
import {
  ClipboardList, ClipboardCheck, Edit2, Trash2, Printer, X, Plus, MinusCircle, PlayCircle
} from 'lucide-react';

const isConfirmed = (status: string) => status === 'S' || status === 'C';

export default function PmRecord() {
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<PmTab>('plans');
  const [plans, setPlans] = useState<PmRecord[]>([]);
  const [results, setResults] = useState<PmRecord[]>([]);
  const [depts, setDepts] = useState<{ id: string; name: string }[]>([]);
  const [pmTypes, setPmTypes] = useState<{ id: string; name: string }[]>([]);
  const [equipments, setEquipments] = useState<EquipmentReference[]>([]);
  const [usersList, setUsersList] = useState<{ id: string; name: string; title?: string | null; position?: string | null }[]>([]);

  // 검색/필터 상태
  const [showAll, setShowAll] = useState(false);
  const [searchType, setSearchType] = useState<'id' | 'title' | 'author'>('id');
  const [searchValue, setSearchValue] = useState('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [stepStage, setStepStage] = useState<PmStage>('P');
  const [pmNo, setPmNo] = useState('');
  const [title, setTitle] = useState('');
  const [plantId, setPlantId] = useState('');
  const [equipmentId, setEquipmentId] = useState('');
  const [equipmentName, setEquipmentName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [checkTypeCode, setCheckTypeCode] = useState('');
  const [cycleFrom, setCycleFrom] = useState('');
  const [cycleEnd, setCycleEnd] = useState('');
  const [workDate, setWorkDate] = useState(todayLocal());
  const [isRecurring, setIsRecurring] = useState(false);
  const [workerId, setWorkerId] = useState('');
  const [judgeCode, setJudgeCode] = useState('OK');
  const [remarks, setRemarks] = useState('');
  const [certNumber, setCertNumber] = useState('');
  const [certExpireDate, setCertExpireDate] = useState('');
  const [certAgency, setCertAgency] = useState('');
  const [approvalId, setApprovalId] = useState('');
  const [refNo, setRefNo] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [createdBy, setCreatedBy] = useState('');
  const [checkItems, setCheckItems] = useState<PmRecordItem[]>([]);
  const [pendingAction, setPendingAction] = useState<{ type: 'close' | 'delete'; record: PmRecord } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [approvalRef, setApprovalRef] = useState<{
    refNo: string;
    title: string;
    content: RichTextDocument;
  } | null>(null);

  const permission = user?.permissions?.[APP_MODULE.PM];
  const canCreate = permission?.C === 'Y';
  const canUpdate = permission?.U === 'Y';
  const canDelete = permission?.D === 'Y';
  const canDirectConfirm = permission?.A === 'Y';
  const canSave = pmNo ? canUpdate : canCreate;

  const normalizeRecord = (record: PmRecord): PmRecord => ({
    ...record,
    stepStage: (record.stepStage || 'R') as PmStage,
    cycleFrom: formatDateOnly(record.cycleFrom) || null,
    cycleEnd: formatDateOnly(record.cycleEnd) || null,
    workDate: formatDateOnly(record.workDate) || null,
    certExpireDate: formatDateOnly(record.certExpireDate) || null,
    closeYn: record.closeYn || 'N',
  });

  const fetchData = async () => {
    try {
      const params = new URLSearchParams();
      params.set('stepStage', activeTab === 'plans' ? 'P' : 'R');
      if (showAll) params.set('showAll', 'Y');
      if (searchValue) {
        params.set('searchType', searchType);
        params.set('searchValue', searchValue);
      }

      // 폼 선택값 구성을 위한 시스템 참조값 조회다. 예방점검 목록 R 권한을 대체하지 않는다.
      const [loadedRecords, loadedDepartments, loadedEquipments, loadedUsers, loadedPmTypes] = await Promise.all([
        pmApi.getAll(params),
        referenceApi.getDepartmentOptions(),
        masterReferenceApi.getEquipments(),
        referenceApi.getUserOptions(),
        referenceApi.getPmTypeOptions(),
      ]);
      const records = (loadedRecords || []).map(normalizeRecord);
      if (activeTab === 'plans') {
        setPlans(records);
        setResults([]);
      } else {
        setResults(records);
        setPlans([]);
      }
      setDepts(loadedDepartments);
      setEquipments(loadedEquipments);
      setUsersList(loadedUsers);
      setPmTypes(loadedPmTypes);
      setCheckTypeCode((current) => current || loadedPmTypes[0]?.id || '');
    } catch (err) {
      toastApiError(err, '예방점검 목록을 불러오지 못했습니다.');
    }
  };

  // 검색 실행은 버튼이 담당하고 탭/전체보기 변경만 자동 조회한다.
  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchData(); }, 0);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, showAll]);

  const resetForm = (stage: PmStage) => {
    setStepStage(stage);
    setPmNo('');
    setTitle('');
    setPlantId('');
    setEquipmentId('');
    setEquipmentName('');
    setDepartmentId(user?.departmentId || (depts[0]?.id ?? ''));
    setCheckTypeCode(pmTypes[0]?.id || '');
    setCycleFrom('');
    setCycleEnd('');
    setWorkDate(todayLocal());
    setIsRecurring(false);
    setWorkerId(user?.id || '');
    setJudgeCode('OK');
    setRemarks('');
    setCertNumber('');
    setCertExpireDate('');
    setCertAgency('');
    setApprovalId('');
    setRefNo('');
    setCreatedAt('');
    setCreatedBy('');
    setCheckItems([]);
  };

  const openNewRecord = () => {
    resetForm(activeTab === 'plans' ? 'P' : 'R');
    setIsFormOpen(true);
  };

  const loadRecordIntoForm = async (record: PmRecord) => {
    setIsLoading(true);
    try {
      const detail = await pmApi.getDetail(record.plantId, record.id);
      const r = detail.pmRecord;
      const selectedEquipment = equipments.find((eq) => eq.plantId === r.plantId && eq.id === r.equipmentId);

      setStepStage((r.stepStage || 'R') as PmStage);
      setPmNo(r.id);
      setTitle(r.title || '');
      setPlantId(r.plantId);
      setEquipmentId(r.equipmentId);
      setEquipmentName(selectedEquipment?.name || record.equipmentName || r.equipmentId);
      setDepartmentId(r.departmentId);
      setCheckTypeCode(r.checkTypeCode);
      setCycleFrom(formatDateOnly(r.cycleFrom) || '');
      setCycleEnd(formatDateOnly(r.cycleEnd) || '');
      setWorkDate(formatDateOnly(r.workDate));
      setIsRecurring(!!(r.cycleFrom || r.cycleEnd));
      setWorkerId(r.workerId);
      setJudgeCode(r.judgeCode);
      setRemarks(r.remarks || '');
      setCertNumber(r.certNumber || '');
      setCertExpireDate(formatDateOnly(r.certExpireDate));
      setCertAgency(r.certAgency || '');
      setApprovalId(r.status === 'R' ? '' : (r.approvalId || ''));
      setRefNo(r.refNo || '');
      setCreatedAt(r.createdAt || '');
      setCreatedBy(r.createdBy || '');
      setCheckItems(detail.checkItems || []);
      setIsFormOpen(true);
    } catch (err) {
      toastApiError(err, '예방점검 상세를 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const openPrintDocument = async (record: PmRecord) => {
    const printTarget = openPrintWindow({
      title: '예방점검 문서 출력',
      rootId: 'pm-print-root',
    });
    if (!printTarget) {
      toast.error('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.');
      return;
    }
    const { printWindow, container } = printTarget;

    setIsLoading(true);
    try {
      const response = await pmApi.getDetail(record.plantId, record.id);
      const detail = normalizeRecord({
        ...record,
        ...response.pmRecord,
        equipmentName: record.equipmentName,
      });
      const approvalSteps = await loadApprovalSignatureSteps(detail.approvalId, usersList);
      const root = createRoot(container);
      root.render(
        <PrintWindowLayout printWindow={printWindow} contentClassName="max-w-[180mm]">
          <PmReportPrint
            stepStage={detail.stepStage}
            pmNo={detail.id}
            title={detail.title || undefined}
            status={detail.status}
              approvalId={detail.approvalId}
              createdAt={formatDateOnly(detail.createdAt)}
              deptName={depts.find((dept) => dept.id === detail.departmentId)?.name || detail.departmentId}
              authorName={usersList.find((candidate) => candidate.id === detail.createdBy)?.name || detail.createdBy || '-'}
              workDate={detail.workDate}
            cycleFrom={detail.cycleFrom}
            cycleEnd={detail.cycleEnd}
              equipmentName={`${detail.equipmentId} / ${detail.equipmentName || detail.equipmentId}`}
              checkTypeCode={pmTypes.find((type) => type.id === detail.checkTypeCode)?.name || detail.checkTypeCode}
            judgeCode={detail.judgeCode}
            certNumber={detail.certNumber || undefined}
            certAgency={detail.certAgency || undefined}
            certExpireDate={detail.certExpireDate || undefined}
            remarks={detail.remarks || undefined}
            checkItems={response.checkItems || []}
            approvalSteps={approvalSteps}
          />
        </PrintWindowLayout>,
      );
      printWindow.focus();
    } catch (err) {
      printWindow.close();
      toastApiError(err, '출력 문서를 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const openResultFromPlan = async (plan: PmRecord) => {
    if (!isConfirmed(plan.status)) {
      toast.error('확정된 예방점검 계획에 대해서만 실적을 입력할 수 있습니다.');
      return;
    }
    setIsLoading(true);
    try {
      const detail = await pmApi.getDetail(plan.plantId, plan.id);
      resetForm('R');
      setPlantId(plan.plantId);
      setEquipmentId(plan.equipmentId);
      setEquipmentName(plan.equipmentName || plan.equipmentId);
      setDepartmentId(plan.departmentId);
      setCheckTypeCode(plan.checkTypeCode);
      setWorkerId(user?.id || '');
      setRefNo(plan.id);
      setCheckItems((detail.checkItems || []).map((item: PmRecordItem) => ({
        ...item,
        checkValue: null,
      })));
      setIsFormOpen(true);
    } catch (err) {
      toastApiError(err, '계획 항목을 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEquipmentChange = (value: string) => {
    const selected = equipments.find((eq) => `${eq.plantId}:${eq.id}` === value);
    setPlantId(selected?.plantId || '');
    setEquipmentId(selected?.id || '');
    setEquipmentName(selected?.name || '');
  };

  const loadTemplates = async (code: string) => {
    if (!plantId) {
      toast.error('플랜트를 먼저 선택해주세요.');
      return;
    }
    setIsLoading(true);
    try {
      const templates = await pmApi.getTemplates(plantId, code);
      if (templates.length === 0) {
        toast.error('등록된 점검 템플릿이 없습니다. 직접 입력해주세요.');
        setCheckItems([]);
      } else {
        setCheckItems(templates.map((item: PmRecordItem, idx: number) => ({
          ...item,
          itemNo: idx + 1,
          minValue: item.minValue != null ? Number(item.minValue) : null,
          maxValue: item.maxValue != null ? Number(item.maxValue) : null,
          baseValue: item.baseValue != null ? Number(item.baseValue) : null,
          checkValue: null,
        })));
        toast.success(`${templates.length}개 템플릿 항목을 불러왔습니다.`);
      }
    } catch (err) {
      toastApiError(err, '템플릿 로딩 실패.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckTypeChange = (code: string) => {
    setCheckTypeCode(code);
  };

  const addPlanItem = () => {
    setCheckItems([
      ...checkItems,
      {
        itemNo: checkItems.length + 1,
        checkName: '',
        checkMethod: '',
        minValue: null,
        maxValue: null,
        baseValue: null,
        unit: '',
        checkValue: null,
      },
    ]);
  };

  const removePlanItem = (idx: number) => {
    setCheckItems(checkItems.filter((_, i) => i !== idx).map((item, i) => ({ ...item, itemNo: i + 1 })));
  };

  const updateItem = (idx: number, field: keyof PmRecordItem, value: string) => {
    setCheckItems(checkItems.map((item, i) => {
      if (i !== idx) return item;
      if (field === 'minValue' || field === 'maxValue' || field === 'baseValue' || field === 'checkValue') {
        return { ...item, [field]: value === '' ? null : Number(value) };
      }
      return { ...item, [field]: value };
    }));
  };

  const handlePrint = () => {
    const list = activeTab === 'plans' ? plans : results;
    if (list.length === 0) { toast.error('인쇄할 목록이 없습니다.'); return; }
    const now = new Date();
    const stamp = now.toLocaleString('sv-SE');
    const tabLabel = activeTab === 'plans' ? '예방점검 계획' : '예방점검 실적';
    const opened = openListPrint({
      title: `${tabLabel} 현황`,
      rows: list,
      getRowKey: (record) => `${record.plantId}:${record.id}`,
      companyName: user?.companyName || user?.companyId || 'CMMS',
      printerName: user?.name || '-',
      printedAt: stamp,
      columns: [
        { header: '문서번호', render: (record) => record.id, className: 'font-mono' },
        { header: '점검명', render: (record) => record.title || '-' },
        { header: '설비명', render: (record) => record.equipmentName || record.equipmentId },
        { header: '부서', render: (record) => depts.find((item) => item.id === record.departmentId)?.name || record.departmentId },
        { header: '계획기간', render: (record) => `${record.cycleFrom || '-'} ~ ${record.cycleEnd || '-'}` },
        { header: '점검일', render: (record) => record.workDate || '-' },
        { header: '담당자', render: (record) => usersList.find((item) => item.id === record.workerId)?.name || record.workerId },
        { header: '결재상태', render: (record) => record.status === 'S' ? '확정' : record.status === 'C' ? '완결' : '임시' },
      ],
    });
    if (!opened) toast.error('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.');
  };

  const handleClosePlan = async (record: PmRecord) => {
    try {
      await pmApi.closePlan(record.plantId, record.id);
      toast.success('계획이 종료되었습니다.');
      setPendingAction(null);
      fetchData();
    } catch (err) {
      toastApiError(err, '종료 실패.');
    }
  };

  const handleDelete = async (record: PmRecord) => {
    try {
      await pmApi.delete(record.plantId, record.id);
      toast.success('예방점검 문서가 삭제되었습니다.');
      setPendingAction(null);
      fetchData();
    } catch (err) {
      toastApiError(err, '삭제 실패.');
    }
  };

  const validateForm = () => {
    if (!plantId || !equipmentId || !departmentId || !checkTypeCode) {
      toast.error('설비, 부서, 점검유형은 필수입니다.');
      return false;
    }
    if (stepStage === 'P' && isRecurring && (!cycleFrom || !cycleEnd)) {
      toast.error('반복작업은 시작일과 종료일을 모두 입력해야 합니다.');
      return false;
    }
    if (stepStage === 'P' && isRecurring && cycleFrom > cycleEnd) {
      toast.error('반복작업 종료일은 시작일보다 빠를 수 없습니다.');
      return false;
    }
    if ((stepStage === 'R' || !isRecurring) && !workDate) {
      toast.error(stepStage === 'R' ? '점검일을 입력하세요.' : '계획일을 입력하세요.');
      return false;
    }
    if (stepStage === 'P' && checkItems.some((item) => !item.checkName?.trim())) {
      toast.error('계획 점검항목명은 비워둘 수 없습니다.');
      return false;
    }
    return true;
  };

  const handleSave = async (submitStatus: 'T' | 'S' | 'P') => {
    if (!validateForm()) return;
    setIsLoading(true);
    try {
      const saveStatus = submitStatus === 'P' ? 'T' : submitStatus;
      const payload = {
        pmRecord: {
          id: pmNo || null,
          title: title || null,
          plantId,
          equipmentId,
          departmentId,
          checkTypeCode,
          stepStage,
          cycleFrom: stepStage === 'P' && isRecurring ? cycleFrom : null,
          cycleEnd: stepStage === 'P' && isRecurring ? cycleEnd : null,
          workDate: stepStage === 'P' && isRecurring ? null : workDate,
          workerId,
          judgeCode,
          remarks: remarks || null,
          certNumber: certNumber || null,
          certExpireDate: certExpireDate || null,
          certAgency: certAgency || null,
          approvalId: approvalId || null,
          refNo: stepStage === 'R' ? refNo : null,
          refModule: stepStage === 'R' && refNo ? APP_MODULE.PM : null,
          status: saveStatus,
        },
        checkItems: checkItems.map((item, idx) => ({
          ...item,
          itemNo: idx + 1,
          checkValue: stepStage === 'P' ? null : item.checkValue,
        })),
      };

      const saved = pmNo
        ? await pmApi.update(payload)
        : await pmApi.create(payload);
      const savedId = saved.id;
      if (submitStatus === 'P') {
        setPmNo(savedId);
        setApprovalRef({
          refNo: savedId,
          title: `[예방점검 ${stepStage === 'P' ? '계획' : '실적'}] ${title || equipmentName || equipmentId}`,
          content: createPmApprovalContent({
            stepStage,
            pmNo: savedId,
            statusLabel: getStatusLabel('P'),
            createdAt: saved.createdAt,
            departmentName: depts.find((dept) => dept.id === departmentId)?.name || departmentId,
            authorName:
              usersList.find((candidate) => candidate.id === saved.createdBy)?.name
              || saved.createdBy
              || user?.name
              || '-',
            equipmentName: `${equipmentId} / ${equipmentName || equipmentId}`,
            checkTypeName: pmTypes.find((type) => type.id === checkTypeCode)?.name || checkTypeCode,
            workDate: stepStage === 'P' && isRecurring ? null : workDate,
            cycleFrom: stepStage === 'P' ? cycleFrom : null,
            cycleEnd: stepStage === 'P' ? cycleEnd : null,
            judgeName: getJudgeLabel(judgeCode),
            certNumber,
            certAgency,
            certExpireDate,
            remarks,
            checkItems,
          }),
        });
        return;
      }
      toast.success(
        submitStatus === 'T'
          ? '임시저장 되었습니다.'
          : stepStage === 'R'
            ? '예방점검 실적이 확정되었습니다. 점검주기가 갱신됩니다.'
            : '예방점검 계획이 확정되었습니다.',
      );
      setIsFormOpen(false);
      fetchData();
    } catch (err) {
      toastApiError(err, '저장 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const currentList = activeTab === 'plans' ? plans : results;

  const handleSearch = () => {
    fetchData();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <ClipboardList size={24} className="text-blue-500" />
            예방점검 관리
          </h1>
          <p className="text-slate-400 text-sm mt-1">확정된 예방점검 계획을 기준으로 실적을 입력하고, 확정 실적일로 점검주기를 갱신합니다.</p>
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
            onClick={openNewRecord}
            className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border-0"
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

      {pendingAction && (
        <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-800 bg-amber-950/40 px-4 py-3 text-xs">
          <span className="text-amber-200">
            {pendingAction.type === 'close'
              ? `[${pendingAction.record.id}] 계획을 종료하시겠습니까? 종료 후 수정할 수 없습니다.`
              : `[${pendingAction.record.id}] 예방점검 문서를 삭제하시겠습니까?`}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPendingAction(null)}
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-300 cursor-pointer"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => pendingAction.type === 'close'
                ? handleClosePlan(pendingAction.record)
                : handleDelete(pendingAction.record)}
              className="rounded-md border-0 bg-amber-600 px-3 py-1.5 font-semibold text-white cursor-pointer"
            >
              {pendingAction.type === 'close' ? '종료' : '삭제'}
            </button>
          </div>
        </div>
      )}

      {/* 검색/필터 바 */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={searchType}
            onChange={(e) => setSearchType(e.target.value as 'id' | 'title' | 'author')}
            className="bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-3 text-xs text-slate-300 outline-none"
          >
            <option value="id">문서번호</option>
            <option value="title">제목</option>
            <option value="author">작성자</option>
          </select>
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="검색어 입력"
            className="flex-1 min-w-[200px] bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-3 text-xs text-slate-300 outline-none"
          />
          <button
            onClick={handleSearch}
            className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors cursor-pointer border-0"
          >
            검색
          </button>
          {searchValue && (
            <button
              onClick={() => { setSearchValue(''); setSearchType('id'); }}
              className="text-slate-400 hover:text-slate-200 text-xs cursor-pointer border-0 bg-transparent"
            >
              초기화
            </button>
          )}
          <div className="flex items-center gap-2 ml-auto">
            <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                className="rounded border-slate-700 bg-slate-950"
              />
              전체 보기 (종료/만료 포함)
            </label>
          </div>
        </div>
      </div>

      <div className={`bg-slate-900 border border-slate-800 rounded-xl p-6 print:border-0 print:bg-transparent print:p-0 print-landscape ${isFormOpen ? 'print:hidden' : ''}`}>
        <div className="space-y-4 print:block">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5 print:hidden">
            {activeTab === 'plans' ? <ClipboardList size={16} className="text-blue-500" /> : <ClipboardCheck size={16} className="text-blue-500" />}
            {activeTab === 'plans' ? '예방점검 계획 목록' : '예방점검 실적 목록'}
          </h3>

          <PrintHeader />
          <h1 className="hidden print:block text-center text-xl font-bold tracking-widest text-black border-b-2 border-black pb-2 mb-4">
            예 방 점 검 {activeTab === 'plans' ? '계 획' : '실 적'} 현 황
          </h1>

          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40 print:border-slate-300 print:bg-white print:rounded-none">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 select-none print:bg-slate-100 print:text-slate-800 print:border-slate-300">
                  <th className="p-3 font-semibold">{activeTab === 'plans' ? '계획번호' : '실적번호'}</th>
                  <th className="p-3 font-semibold">점검명</th>
                  <th className="p-3 font-semibold">설비명</th>
                  {activeTab === 'plans' && <th className="p-3 font-semibold">계획기간</th>}
                  <th className="p-3 font-semibold">{activeTab === 'plans' ? '계획일' : '점검일'}</th>
                  <th className="p-3 font-semibold">담당자</th>
                  <th className="p-3 font-semibold">점검유형</th>
                  {activeTab === 'results' && <th className="p-3 font-semibold">판정</th>}
                  <th className="p-3 font-semibold">결재상태</th>
                  <th className="p-3 font-semibold text-right print:hidden">작업</th>
                </tr>
              </thead>
              <tbody>
                {currentList.length === 0 ? (
                  <tr>
                    <td colSpan={activeTab === 'plans' ? 10 : 10} className="p-8 text-center text-slate-600 print:text-slate-400">
                      등록된 예방점검 {activeTab === 'plans' ? '계획' : '실적'}이 없습니다.
                    </td>
                  </tr>
                ) : (
                  currentList.map((rec) => (
                    <tr key={rec.id} className="border-b border-slate-900 hover:bg-slate-900/30 text-slate-300 print:border-slate-200 print:text-slate-800 print:hover:bg-transparent">
                      <td className="p-3 font-mono">
                        <button
                          type="button"
                          onClick={() => openPrintDocument(rec)}
                          className="no-print bg-transparent border-0 p-0 text-blue-400 hover:text-blue-300 hover:underline font-mono cursor-pointer"
                          title={`${rec.stepStage === 'P' ? '계획서' : '결과보고서'} 출력 화면`}
                        >
                          {rec.id}
                        </button>
                        <span className="hidden print:inline text-slate-600">{rec.id}</span>
                      </td>
                      <td className="p-3 text-slate-300 print:text-slate-800">{rec.title || '-'}</td>
                      <td className="p-3 font-semibold text-slate-200 print:text-slate-900">{rec.equipmentName || rec.equipmentId}</td>
                      {activeTab === 'plans' && (
                        <td className="p-3 text-xs text-slate-400 print:text-slate-600">
                          {rec.cycleFrom && rec.cycleEnd
                            ? `${rec.cycleFrom} ~ ${rec.cycleEnd}`
                            : rec.cycleFrom
                              ? `${rec.cycleFrom} ~`
                              : rec.cycleEnd
                                ? `~ ${rec.cycleEnd}`
                                : '-'}
                        </td>
                      )}
                      <td className="p-3">{rec.workDate}</td>
                      <td className="p-3">{usersList.find((candidate) => candidate.id === rec.workerId)?.name || rec.workerId || '-'}</td>
                      <td className="p-3">{pmTypes.find((type) => type.id === rec.checkTypeCode)?.name || rec.checkTypeCode}</td>
                      {activeTab === 'results' && (
                        <td className="p-3">
                          <span className={`font-semibold ${rec.judgeCode === 'OK' ? 'text-emerald-400 print:text-emerald-700' : 'text-rose-400 print:text-rose-700'}`}>
                            {getJudgeLabel(rec.judgeCode)}
                          </span>
                        </td>
                      )}
                      <td className="p-3">
                        {rec.closeYn === 'Y' ? (
                          <ListBadge>종료</ListBadge>
                        ) : rec.status === 'E' ? (
                          <ListBadge>만료</ListBadge>
                        ) : (
                          <ListBadge>{getStatusLabel(rec.status)}</ListBadge>
                        )}
                      </td>
                      <td className="p-3 text-right print:hidden">
                        <div className="flex justify-end gap-2">
                          {canCreate && activeTab === 'plans' && isConfirmed(rec.status) && rec.closeYn !== 'Y' && (
                            <ListIconButton
                              onClick={() => openResultFromPlan(rec)}
                              label="실적 입력"
                              icon={PlayCircle}
                              tone="success"
                            />
                          )}
                          {canUpdate && activeTab === 'plans' && isConfirmed(rec.status) && rec.closeYn !== 'Y' && (
                            <ListIconButton
                              onClick={() => setPendingAction({ type: 'close', record: rec })}
                              label="계획 종료"
                              icon={ClipboardCheck}
                              tone="warning"
                            />
                          )}
                          {canUpdate && ['T', 'R'].includes(rec.status) && (
                            <ListIconButton
                              onClick={() => loadRecordIntoForm(rec)}
                              label="상세/수정"
                              icon={Edit2}
                              tone="accent"
                            />
                          )}
                          {canDelete && rec.status === 'T' && (
                              <ListIconButton
                                onClick={() => setPendingAction({ type: 'delete', record: rec })}
                                label="삭제"
                                icon={Trash2}
                                tone="danger"
                              />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto print:absolute print:inset-0 print:bg-white print:p-0">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl print:border-0 print:shadow-none print:max-h-none print:w-full print:h-full">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center shrink-0 print:hidden">
              <h2 className="text-lg font-bold text-slate-200">
                {pmNo ? `예방점검 ${stepStage === 'P' ? '계획' : '실적'} 상세/수정 [${pmNo}]` : `신규 예방점검 ${stepStage === 'P' ? '계획' : '실적'} 입력`}
              </h2>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-slate-500 hover:text-slate-300 p-1 hover:bg-slate-800 rounded transition-colors border-0 cursor-pointer bg-transparent"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 print:hidden">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block mb-0.5">문서번호</span>
                  <span className="font-mono font-semibold text-slate-300">{pmNo || '(저장 시 자동발행)'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">작성일</span>
                  <span className="font-mono text-slate-300">{formatDateOnly(createdAt) || (pmNo ? '-' : '저장 시 기록')}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">부서</span>
                  <span className="text-slate-300">
                    {departmentId || '-'} / {depts.find((dept) => dept.id === departmentId)?.name || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">작성자</span>
                  <span className="text-slate-300">
                    {(createdBy || user?.id) || '-'} / {usersList.find((candidate) => candidate.id === (createdBy || user?.id))?.name || user?.name || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">단계</span>
                  <span className="text-slate-300">{stepStage === 'P' ? '계획(P)' : '실적(R)'}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="md:col-span-2">
                  <label className="block text-slate-400 mb-1.5">점검명</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="예방점검명을 입력하세요"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1.5">대상 설비 <span className="text-rose-500">*</span></label>
                  {!pmNo ? (
                    <select
                      value={plantId && equipmentId ? `${plantId}:${equipmentId}` : ''}
                      onChange={(e) => handleEquipmentChange(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none"
                    >
                      <option value="">-- 설비 선택 --</option>
                      {equipments.map((equipment) => (
                        <option key={`${equipment.plantId}:${equipment.id}`} value={`${equipment.plantId}:${equipment.id}`}>
                          {equipment.name} ({equipment.id})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      disabled
                      value={equipmentName || equipmentId}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-slate-200 outline-none disabled:opacity-80"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-slate-400 mb-1.5">점검 유형 <span className="text-rose-500">*</span></label>
                  <div className="flex gap-2">
                    <select
                      disabled={stepStage === 'R' && !!refNo}
                      value={checkTypeCode}
                      onChange={(e) => handleCheckTypeChange(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-300 outline-none disabled:opacity-80"
                    >
                      {pmTypes.map((type) => (
                        <option key={type.id} value={type.id}>{type.name}</option>
                      ))}
                    </select>
                    {(stepStage === 'P' || !refNo) && (
                      <button
                        type="button"
                        onClick={() => loadTemplates(checkTypeCode)}
                        className="bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg px-3 text-[11px] font-semibold transition-colors border-0 cursor-pointer whitespace-nowrap"
                      >
                        템플릿
                      </button>
                    )}
                  </div>
                </div>
                {stepStage === 'P' && (
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_1fr] gap-3 items-end">
                    <div>
                      <label className="block text-slate-400 mb-1.5">계획일 {!isRecurring && <span className="text-rose-500">*</span>}</label>
                      <input
                        type="date"
                        disabled={isRecurring}
                        required={!isRecurring}
                        value={workDate}
                        onChange={(e) => setWorkDate(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none disabled:opacity-40"
                      />
                    </div>
                    <label className="flex h-9 items-center gap-2 px-2 text-slate-300 cursor-pointer whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={isRecurring}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setIsRecurring(checked);
                          if (checked) {
                            setWorkDate('');
                          } else {
                            setCycleFrom('');
                            setCycleEnd('');
                            setWorkDate((current) => current || todayLocal());
                          }
                        }}
                        className="rounded border-slate-700 bg-slate-950"
                      />
                      반복작업
                    </label>
                    <div>
                      <label className="block text-slate-400 mb-1.5">시작일 {isRecurring && <span className="text-rose-500">*</span>}</label>
                      <input
                        type="date"
                        disabled={!isRecurring}
                        required={isRecurring}
                        value={cycleFrom}
                        onChange={(e) => setCycleFrom(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none disabled:opacity-40"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1.5">종료일 {isRecurring && <span className="text-rose-500">*</span>}</label>
                      <input
                        type="date"
                        disabled={!isRecurring}
                        required={isRecurring}
                        value={cycleEnd}
                        onChange={(e) => setCycleEnd(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none disabled:opacity-40"
                      />
                    </div>
                  </div>
                )}
                {stepStage === 'R' && (
                  <div>
                    <label className="block text-slate-400 mb-1.5">점검일 <span className="text-rose-500">*</span></label>
                    <input
                      type="date"
                      required
                      value={workDate}
                      onChange={(e) => setWorkDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none"
                    />
                  </div>
                )}
                {stepStage === 'R' && (
                  <div>
                    <label className="block text-slate-400 mb-1.5">종합 판정</label>
                    <select
                      value={judgeCode}
                      onChange={(e) => setJudgeCode(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-300 outline-none"
                    >
                      <option value="OK">양호</option>
                      <option value="NG">불량</option>
                      <option value="OTHER">기타</option>
                    </select>
                  </div>
                )}
                <div className="md:col-span-2">
                  <label className="block text-slate-400 mb-1.5">비고</label>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={2}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none resize-none"
                  />
                </div>
              </div>

              {stepStage === 'R' && (
                <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-5">
                  <h4 className="text-xs font-bold text-amber-400 mb-3 border-l-2 border-amber-500 pl-2">법정 인증 정보</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <input className="bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none" value={certNumber} onChange={(e) => setCertNumber(e.target.value)} placeholder="인증번호" />
                    <input className="bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none" value={certAgency} onChange={(e) => setCertAgency(e.target.value)} placeholder="인증기관" />
                    <input type="date" className="bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none" value={certExpireDate} onChange={(e) => setCertExpireDate(e.target.value)} />
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div className="flex justify-between items-center border-l-2 border-blue-500 pl-2">
                  <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                    {stepStage === 'P' ? '계획 점검 항목' : '실적 측정 항목'}
                  </h3>
                  {stepStage === 'P' && (
                    <button
                      type="button"
                      onClick={addPlanItem}
                      className="bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1 transition-colors border-0 cursor-pointer"
                    >
                      <Plus size={13} />
                      항목 추가
                    </button>
                  )}
                </div>
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/20">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 select-none">
                        <th className="p-3 font-semibold w-12 text-center">번호</th>
                        <th className="p-3 font-semibold">점검 항목</th>
                        <th className="p-3 font-semibold">점검 방법</th>
                        <th className="p-3 font-semibold text-center">Min</th>
                        <th className="p-3 font-semibold text-center">Max</th>
                        <th className="p-3 font-semibold text-center">기준</th>
                        {stepStage === 'R' && <th className="p-3 font-semibold text-center">측정값</th>}
                        <th className="p-3 font-semibold w-24">단위</th>
                        {stepStage === 'P' && <th className="p-3 font-semibold w-12"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {checkItems.length === 0 ? (
                        <tr>
                          <td colSpan={stepStage === 'P' ? 8 : 8} className="p-8 text-center text-slate-600">
                            등록된 점검항목이 없습니다.
                          </td>
                        </tr>
                      ) : (
                        checkItems.map((item, idx) => (
                          <tr key={idx} className="border-b border-slate-900 hover:bg-slate-900/30 text-slate-300">
                            <td className="p-3 text-center text-slate-500">{idx + 1}</td>
                            <td className="p-2">
                              {stepStage === 'P' ? (
                                <input value={item.checkName} onChange={(e) => updateItem(idx, 'checkName', e.target.value)} className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-1 px-2 text-slate-200 outline-none" />
                              ) : <span className="font-semibold text-slate-200">{item.checkName}</span>}
                            </td>
                            <td className="p-2">
                              {stepStage === 'P' ? (
                                <input value={item.checkMethod || ''} onChange={(e) => updateItem(idx, 'checkMethod', e.target.value)} className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-1 px-2 text-slate-200 outline-none" />
                              ) : <span className="text-slate-400">{item.checkMethod || '-'}</span>}
                            </td>
                            {(['minValue', 'maxValue', 'baseValue'] as const).map((field) => (
                              <td key={field} className="p-2">
                                {stepStage === 'P' ? (
                                  <input type="number" step="any" value={item[field] ?? ''} onChange={(e) => updateItem(idx, field, e.target.value)} className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-1 px-2 text-center text-slate-200 outline-none" />
                                ) : <span className="block text-center text-slate-400">{item[field] ?? '-'}</span>}
                              </td>
                            ))}
                            {stepStage === 'R' && (
                              <td className="p-2">
                                <input type="number" step="any" value={item.checkValue ?? ''} onChange={(e) => updateItem(idx, 'checkValue', e.target.value)} className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-1 px-2 text-center text-slate-200 outline-none" />
                              </td>
                            )}
                            <td className="p-2">
                              {stepStage === 'P' ? (
                                <input value={item.unit || ''} onChange={(e) => updateItem(idx, 'unit', e.target.value)} className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-1 px-2 text-slate-200 outline-none" />
                              ) : <span className="text-slate-500">{item.unit || '-'}</span>}
                            </td>
                            {stepStage === 'P' && (
                              <td className="p-2 text-center">
                                <button onClick={() => removePlanItem(idx)} className="p-1.5 text-rose-500 hover:bg-slate-800 rounded border-0 cursor-pointer bg-transparent">
                                  <MinusCircle size={15} />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-800 flex justify-between items-center shrink-0 print:hidden">
              <div className="flex gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg py-2 px-4 text-xs font-semibold transition-colors cursor-pointer border-0"
                >
                  닫기
                </button>
                {canSave && <button
                  onClick={() => handleSave('T')}
                  disabled={isLoading}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-750 rounded-lg py-2 px-4 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                >
                  임시 저장
                </button>}
                {canSave && <button
                  onClick={() => handleSave('P')}
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 px-4 text-xs font-semibold transition-colors cursor-pointer border-0 disabled:opacity-50"
                >
                  결재 상신
                </button>}
                {canSave && canDirectConfirm && (
                  <button
                    onClick={() => handleSave('S')}
                    disabled={isLoading}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg py-2 px-5 text-xs font-semibold transition-colors cursor-pointer border-0 disabled:opacity-50"
                  >
                    직접 확정
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <ApprovalDraftModal
        open={!!approvalRef}
        mode="linked"
        refModule={APP_MODULE.PM}
        refNo={approvalRef?.refNo || ''}
        defaultTitle={approvalRef?.title || ''}
        defaultContent={approvalRef?.content}
        users={usersList}
        currentUserId={user?.id}
        onClose={() => setApprovalRef(null)}
        onSubmitted={() => {
          setApprovalRef(null);
          setIsFormOpen(false);
          toast.success('예방점검 결재 문서가 상신되었습니다.');
          fetchData();
        }}
      />
    </div>
  );
}
