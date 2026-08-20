import { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { toast } from 'sonner';
import { useAuthStore } from '../store/useAuthStore';
import { hasModuleCreate } from '../utils/moduleAccess';
import { getCommonStatusLabel as getStatusLabel, getJudgeLabel } from '../constants/status';
import { APP_MODULE } from '../constants/module';
import { formatDateOnly, formatDateTimeSeconds, todayLocal } from '../utils/datetime';
import { toastApiError } from '../utils/apiError';
import { requestConfirmation } from '../utils/userActionDialog';
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
import { mdmLookupApi } from '../features/mdm/reference.api';
import { masterLookupApi } from '../features/master/master-reference.api';
import type { EquipmentReference } from '../features/master/master-reference.types';
import DocumentListPanel from '../components/DocumentListPanel';
import PmFormModal from '../features/pm/components/PmFormModal';
import {
  ClipboardList, ClipboardCheck, Edit2, Printer, Plus, PlayCircle
} from 'lucide-react';

const isConfirmed = (status: string) => status === 'C';

const normalizeRecord = (record: PmRecord): PmRecord => ({
  ...record,
  stepStage: (record.stepStage || 'R') as PmStage,
  cycleFrom: formatDateOnly(record.cycleFrom) || null,
  cycleEnd: formatDateOnly(record.cycleEnd) || null,
  workDate: formatDateOnly(record.workDate) || null,
  certExpireDate: formatDateOnly(record.certExpireDate) || null,
  closeYn: record.closeYn || 'N',
});

export default function PmRecord() {
  const user = useAuthStore((s) => s.user);
  const activePlantId = useAuthStore((s) => s.activePlantId);
  const [activeTab, setActiveTab] = useState<PmTab>('plans');
  const [plans, setPlans] = useState<PmRecord[]>([]);
  const [results, setResults] = useState<PmRecord[]>([]);
  const [depts, setDepts] = useState<{ id: string; name: string }[]>([]);
  const [pmTypes, setPmTypes] = useState<{ id: string; name: string }[]>([]);
  const [equipments, setEquipments] = useState<EquipmentReference[]>([]);
  const [usersList, setUsersList] = useState<{ id: string; name: string; title?: string | null; position?: string | null }[]>([]);

  // 검색/필터 상태
  const [showAll, setShowAll] = useState(false);
  const [tempOnly, setTempOnly] = useState(false);
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
  const [fileGroupId, setFileGroupId] = useState<number | null>(null);
  const [refNo, setRefNo] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [createdBy, setCreatedBy] = useState('');
  const [recordStatus, setRecordStatus] = useState('T');
  const [checkItems, setCheckItems] = useState<PmRecordItem[]>([]);
  const [pendingClose, setPendingClose] = useState<PmRecord | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [approvalRef, setApprovalRef] = useState<{
    refNo: string;
    title: string;
    content: RichTextDocument;
  } | null>(null);

  const canCreate = hasModuleCreate(user?.moduleAccess, APP_MODULE.PM);
  const canUpdate = canCreate;
  const canDelete = canCreate;
  const canEditCurrent = !pmNo
    ? canCreate
    : canUpdate || (recordStatus === 'T' && createdBy === user?.id);
  const canDeleteCurrent = !!pmNo
    && recordStatus === 'T'
    && (canDelete || createdBy === user?.id);

  const loadList = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('stepStage', activeTab === 'plans' ? 'P' : 'R');
      if (showAll) params.set('showAll', 'Y');
      if (tempOnly) params.set('tempOnly', 'Y');
      if (searchValue) {
        params.set('searchType', searchType);
        params.set('searchValue', searchValue);
      }

      // 폼 선택값 구성을 위한 시스템 참조값 조회다. 예방점검 목록 R 권한을 대체하지 않는다.
      const [loadedRecords, loadedDepartments, loadedEquipments, loadedUsers, loadedPmTypes] = await Promise.all([
        pmApi.getAll(params, activePlantId),
        mdmLookupApi.getDepartmentOptions(),
        masterLookupApi.getEquipments(),
        mdmLookupApi.getUserOptions(),
        mdmLookupApi.getPmTypeOptions(),
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
  }, [activePlantId, activeTab, searchType, searchValue, showAll, tempOnly]);

  // 검색 실행은 버튼이 담당하고 탭/전체보기 변경만 자동 조회한다.
  useEffect(() => {
    const run = async () => {
      await loadList();
    };
    void run();
  }, [loadList]);

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
    setFileGroupId(null);
    setRefNo('');
    setCreatedAt('');
    setCreatedBy('');
    setRecordStatus('T');
    setCheckItems([]);
  };

  const openNewRecord = () => {
    resetForm(activeTab === 'plans' ? 'P' : 'R');
    setIsFormOpen(true);
  };

  const loadDetail = async (record: PmRecord) => {
    setIsLoading(true);
    try {
      const detail = await pmApi.getDetail(record.plantId, record.id);
      const r = detail.pmRecord;
      const isRejected = r.status === 'R';
      const selectedEquipment = equipments.find((eq) => eq.plantId === r.plantId && eq.id === r.equipmentId);

      setStepStage((r.stepStage || 'R') as PmStage);
      setPmNo(isRejected ? '' : r.id);
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
      setApprovalId('');
      setFileGroupId(isRejected ? null : r.fileGroupId ?? null);
      setRefNo(r.refNo || '');
      setCreatedAt(isRejected ? '' : (r.createdAt || ''));
      setCreatedBy(isRejected ? '' : (r.createdBy || ''));
      setRecordStatus(isRejected ? 'T' : (r.status || 'T'));
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
    const stamp = formatDateTimeSeconds(new Date());
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
        { header: '제목', render: (record) => record.title || '-' },
        { header: '대상설비', render: (record) => record.equipmentName || record.equipmentId },
        { header: '부서', render: (record) => depts.find((item) => item.id === record.departmentId)?.name || record.departmentId },
        { header: '계획기간', render: (record) => `${record.cycleFrom || '-'} ~ ${record.cycleEnd || '-'}` },
        { header: '점검일', render: (record) => record.workDate || '-' },
        { header: '담당자', render: (record) => usersList.find((item) => item.id === record.workerId)?.name || record.workerId },
        { header: '상태', render: (record) => getStatusLabel(record.status) },
      ],
    });
    if (!opened) toast.error('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.');
  };

  const handleClosePlan = async (record: PmRecord) => {
    try {
      await pmApi.closePlan(record.plantId, record.id);
      toast.success('계획이 종료되었습니다.');
      setPendingClose(null);
      loadList();
    } catch (err) {
      toastApiError(err, '종료 실패.');
    }
  };

  const handleDelete = async () => {
    if (!pmNo || !plantId) return;
    if (!(await requestConfirmation('예방점검 문서를 삭제하시겠습니까?'))) return;
    try {
      await pmApi.delete(plantId, pmNo);
      toast.success('예방점검 문서가 삭제되었습니다.');
      setIsFormOpen(false);
      await loadList();
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

  const handleSave = async (submitStatus: 'T' | 'P') => {
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
          fileGroupId,
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
      loadList();
    } catch (err) {
      toastApiError(err, '저장 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const currentList = activeTab === 'plans' ? plans : results;

  const handleSearch = () => {
    loadList();
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

      {pendingClose && (
        <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-800 bg-amber-950/40 px-4 py-3 text-xs">
          <span className="text-amber-200">
            [{pendingClose.id}] 계획을 종료하시겠습니까? 종료 후 수정할 수 없습니다.
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPendingClose(null)}
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-slate-300 cursor-pointer"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => handleClosePlan(pendingClose)}
              className="rounded-md border-0 bg-amber-600 px-3 py-1.5 font-semibold text-white cursor-pointer"
            >
              종료
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
          <button
            type="button"
            onClick={() => setTempOnly((current) => !current)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold cursor-pointer ${tempOnly ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-800 bg-slate-950 text-slate-400'}`}
          >
            임시저장 {tempOnly ? 'ON' : 'OFF'}
          </button>
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

      <DocumentListPanel
        isFormOpen={isFormOpen}
        landscape
        heading={<>
          {activeTab === 'plans' ? <ClipboardList size={16} className="text-blue-500" /> : <ClipboardCheck size={16} className="text-blue-500" />}
          {activeTab === 'plans' ? '예방점검 계획 목록' : '예방점검 실적 목록'}
        </>}
        printHeading={`예 방 점 검 ${activeTab === 'plans' ? '계 획' : '실 적'} 현 황`}
      >
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40 print:border-slate-300 print:bg-white print:rounded-none">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 select-none print:bg-slate-100 print:text-slate-800 print:border-slate-300">
                  <th className="p-3 font-semibold">문서번호</th>
                  <th className="p-3 font-semibold">제목</th>
                  <th className="p-3 font-semibold">대상설비</th>
                  {activeTab === 'plans' && <th className="p-3 font-semibold">계획기간</th>}
                  <th className="p-3 font-semibold">{activeTab === 'plans' ? '계획일' : '점검일'}</th>
                  <th className="p-3 font-semibold">담당자</th>
                  <th className="p-3 font-semibold">유형</th>
                  {activeTab === 'results' && <th className="p-3 font-semibold">판정</th>}
                  <th className="p-3 font-semibold">상태</th>
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
                              onClick={() => setPendingClose(rec)}
                              label="계획 종료"
                              icon={ClipboardCheck}
                              tone="warning"
                            />
                          )}
                          {(canUpdate || (rec.status === 'T' && rec.createdBy === user?.id)) && ['T', 'R'].includes(rec.status) && (
                            <ListIconButton
                              onClick={() => loadDetail(rec)}
                              label="상세/수정"
                              icon={Edit2}
                              tone="accent"
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
      </DocumentListPanel>

      {isFormOpen && (
        <PmFormModal
          title={pmNo ? `예방점검 ${stepStage === 'P' ? '계획' : '실적'} 상세/수정 [${pmNo}]` : `신규 예방점검 ${stepStage === 'P' ? '계획' : '실적'} 입력`}
          onClose={() => setIsFormOpen(false)}
          form={{
            pmNo,
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
            equipmentName,
            plantId,
            activePlantId,
            canEditCurrent,
            canDeleteCurrent,
            setEquipmentId,
            setEquipmentName,
            setPlantId,
            checkTypeCode,
            pmTypes,
            refNo,
            handleCheckTypeChange,
            loadTemplates,
            workDate,
            setWorkDate,
            isRecurring,
            setIsRecurring,
            cycleFrom,
            setCycleFrom,
            cycleEnd,
            setCycleEnd,
            judgeCode,
            setJudgeCode,
            remarks,
            setRemarks,
            certNumber,
            setCertNumber,
            certAgency,
            setCertAgency,
            certExpireDate,
            setCertExpireDate,
            checkItems,
            addPlanItem,
            updateItem,
            removePlanItem,
            isLoading,
            handleSave,
            handleDelete,
          }}
        />
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
          loadList();
        }}
      />
    </div>
  );
}
