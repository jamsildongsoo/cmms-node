import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { toast } from 'sonner';
import axiosInstance from '../api/axios';
import { useAuthStore } from '../store/useAuthStore';
import { getCommonStatusLabel as getStatusLabel, getCommonStatusClass as getStatusClass } from '../constants/status';
import { formatDateOnly, todayLocal } from '../utils/datetime';
import { getApiErrorMessage } from '../utils/apiError';
import PrintHeader from '../components/PrintHeader';
import PmReportPrint from '../components/PmReportPrint';
import PrintWindowLayout from '../components/PrintWindowLayout';
import ApprovalSubmitModal from '../components/ApprovalSubmitModal';
import { openPrintWindow } from '../utils/printWindow';
import { requestConfirmation } from '../utils/userActionDialog';
import {
  ClipboardList, ClipboardCheck, Edit2, Trash2, Printer, X, Plus, MinusCircle, PlayCircle
} from 'lucide-react';

type PmStage = 'P' | 'R';
type PmTab = 'plans' | 'results';

interface PmRecord {
  id: string;
  plantId: string;
  title: string | null;
  equipmentId: string;
  equipmentName?: string | null;
  departmentId: string;
  checkTypeCode: string;
  stepStage: PmStage;
  cycleFrom: string | null;
  cycleEnd: string | null;
  closeYn: string;
  workDate: string | null;
  workerId: string;
  judgeCode: string;
  remarks: string | null;
  certNumber: string | null;
  certExpireDate: string | null;
  certAgency: string | null;
  approvalId: string | null;
  refNo: string | null;
  refModule: string | null;
  status: string;
  createdAt?: string | null;
  createdBy?: string | null;
}

interface PmRecordItem {
  itemNo: number;
  checkName: string;
  checkMethod: string | null;
  minValue: number | null;
  maxValue: number | null;
  baseValue: number | null;
  unit: string | null;
  checkValue: number | null;
}

interface EquipmentOption {
  id: string;
  plantId: string;
  name: string;
}

const PM_TYPE_LABELS: Record<string, string> = {
  INSPECT: '예방점검',
  PATROL: '순회점검',
  REPLACE: '소모품교체',
  LEGAL: '정기법정검사',
};

const JUDGE_LABELS: Record<string, string> = {
  OK: '양호',
  NG: '불량',
  OTHER: '기타',
};

const isConfirmed = (status: string) => status === 'S' || status === 'C';

export default function PmRecord() {
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<PmTab>('plans');
  const [plans, setPlans] = useState<PmRecord[]>([]);
  const [results, setResults] = useState<PmRecord[]>([]);
  const [depts, setDepts] = useState<{ id: string; name: string }[]>([]);
  const [equipments, setEquipments] = useState<EquipmentOption[]>([]);
  const [usersList, setUsersList] = useState<{ id: string; name: string }[]>([]);

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
  const [checkTypeCode, setCheckTypeCode] = useState('INSPECT');
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
  const [status, setStatus] = useState('T');
  const [closeYn, setCloseYn] = useState('N');
  const [createdAt, setCreatedAt] = useState('');
  const [createdBy, setCreatedBy] = useState('');
  const [checkItems, setCheckItems] = useState<PmRecordItem[]>([]);
  const [pendingAction, setPendingAction] = useState<{ type: 'close' | 'delete'; record: PmRecord } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [approvalRef, setApprovalRef] = useState<{ refNo: string; title: string } | null>(null);

  const canDirectConfirm = user?.permissions?.PM?.A === 'Y';

  const normalizeRecord = (record: PmRecord): PmRecord => ({
    ...record,
    stepStage: (record.stepStage || 'R') as PmStage,
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

      const [recordRes, deptRes, equipmentRes, userRes] = await Promise.all([
        axiosInstance.get(`/pm/records?${params.toString()}`),
        axiosInstance.get('/mdm/departments'),
        axiosInstance.get('/master/equipments'),
        axiosInstance.get('/mdm/users'),
      ]);
      const records = (recordRes.data || []).map(normalizeRecord);
      if (activeTab === 'plans') {
        setPlans(records);
        setResults([]);
      } else {
        setResults(records);
        setPlans([]);
      }
      setDepts(deptRes.data || []);
      setEquipments(equipmentRes.data || []);
      setUsersList(userRes.data || []);
    } catch (err) {
      toast.error(getApiErrorMessage(err, '예방점검 목록을 불러오지 못했습니다.'));
    }
  };

  useEffect(() => { fetchData(); }, [activeTab, showAll]);

  const resetForm = (stage: PmStage) => {
    setStepStage(stage);
    setPmNo('');
    setTitle('');
    setPlantId('');
    setEquipmentId('');
    setEquipmentName('');
    setDepartmentId(user?.departmentId || (depts[0]?.id ?? ''));
    setCheckTypeCode('INSPECT');
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
    setStatus('T');
    setCloseYn('N');
    setCreatedAt('');
    setCreatedBy('');
    setCheckItems([]);
  };

  const openNewPlan = () => {
    resetForm('P');
    setIsFormOpen(true);
  };

  const loadRecordIntoForm = async (record: PmRecord) => {
    setIsLoading(true);
    try {
      const res = await axiosInstance.get(`/pm/records/details?plantId=${record.plantId}&id=${record.id}`);
      const r = res.data.pmRecord;
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
      setApprovalId(r.approvalId || '');
      setRefNo(r.refNo || '');
      setStatus(r.status || 'T');
      setCloseYn(r.closeYn || 'N');
      setCreatedAt(r.createdAt || '');
      setCreatedBy(r.createdBy || '');
      setCheckItems(res.data.checkItems || []);
      setIsFormOpen(true);
    } catch (err) {
      toast.error(getApiErrorMessage(err, '예방점검 상세를 불러오지 못했습니다.'));
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
      const res = await axiosInstance.get(`/pm/records/details?plantId=${record.plantId}&id=${record.id}`);
      const detail = normalizeRecord({
        ...record,
        ...res.data.pmRecord,
        equipmentName: record.equipmentName,
      });
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
            checkTypeCode={PM_TYPE_LABELS[detail.checkTypeCode] || detail.checkTypeCode}
            judgeCode={detail.judgeCode}
            certNumber={detail.certNumber || undefined}
            certAgency={detail.certAgency || undefined}
            certExpireDate={detail.certExpireDate || undefined}
            remarks={detail.remarks || undefined}
            checkItems={res.data.checkItems || []}
          />
        </PrintWindowLayout>,
      );
      printWindow.focus();
    } catch (err) {
      printWindow.close();
      toast.error(getApiErrorMessage(err, '출력 문서를 불러오지 못했습니다.'));
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
      const res = await axiosInstance.get(`/pm/records/details?plantId=${plan.plantId}&id=${plan.id}`);
      resetForm('R');
      setPlantId(plan.plantId);
      setEquipmentId(plan.equipmentId);
      setEquipmentName(plan.equipmentName || plan.equipmentId);
      setDepartmentId(plan.departmentId);
      setCheckTypeCode(plan.checkTypeCode);
      setWorkerId(user?.id || '');
      setRefNo(plan.id);
      setCheckItems((res.data.checkItems || []).map((item: PmRecordItem) => ({
        ...item,
        checkValue: null,
      })));
      setIsFormOpen(true);
    } catch (err) {
      toast.error(getApiErrorMessage(err, '계획 항목을 불러오지 못했습니다.'));
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
      const res = await axiosInstance.get(`/pm/templates?plantId=${plantId}&checkTypeCode=${code}`);
      const templates = res.data || [];
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
      toast.error(getApiErrorMessage(err, '템플릿 로딩 실패.'));
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

    const user = useAuthStore.getState().user;
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) { toast.error('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.'); return; }

    const tabLabel = activeTab === 'plans' ? '예방점검 계획' : '예방점검 실적';
    const rows = list.map(rec => `
      <tr>
        <td class="mono">${rec.id}</td>
        <td>${rec.title || '-'}</td>
        <td>${rec.equipmentName || rec.equipmentId}</td>
        <td>${depts.find(d => d.id === rec.departmentId)?.name || rec.departmentId}</td>
        <td>${rec.cycleFrom || '-'} ~ ${rec.cycleEnd || '-'}</td>
        <td>${rec.workDate || '-'}</td>
        <td>${usersList.find(u => u.id === rec.workerId)?.name || rec.workerId}</td>
        <td>${rec.status === 'S' ? '확정' : rec.status === 'C' ? '완결' : '임시'}</td>
      </tr>
    `).join('');

    printWindow.document.title = `${tabLabel} 목록 - 인쇄`;
    printWindow.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${tabLabel} 목록 - 인쇄</title>
<style>
@page { size: A4 landscape; margin: 10mm 10mm 14mm 10mm; }
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #000; padding: 10mm; }
h1 { text-align: center; font-size: 14pt; margin-bottom: 4mm; border-bottom: 2px solid #000; padding-bottom: 3mm; }
.print-info { display: flex; justify-content: space-between; font-size: 8pt; color: #666; border-bottom: 1px solid #ccc; padding-bottom: 2mm; margin-bottom: 4mm; }
table { width: 100%; border-collapse: collapse; font-size: 8pt; }
th, td { border: 1px solid #333; padding: 4px 6px; text-align: center; }
th { background: #eee; font-weight: 600; }
.mono { font-family: monospace; }
.no-print { text-align: right; margin-bottom: 12px; }
.no-print button { padding: 8px 20px; background: #2563eb; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 10pt; }
@media print { .no-print { display: none; } }
</style></head><body>
<div class="no-print"><button onclick="window.print()">인쇄</button></div>
<h1>${tabLabel} 현황</h1>
<div class="print-info"><span>회사: ${user?.companyName || user?.companyId || 'CMMS'}</span><span>출력자: ${user?.name || '-'} | 출력일시: ${stamp}</span></div>
<table><thead><tr>
<th>문서번호</th><th>제목</th><th>설비</th><th>부서</th><th>계획기간</th><th>점검일</th><th>작업자</th><th>상태</th>
</tr></thead><tbody>${rows}</tbody></table>
</body></html>`);
    printWindow.document.close();
    printWindow.focus();
  };

  const handleClosePlan = async (record: PmRecord) => {
    try {
      await axiosInstance.patch(`/pm/plans/${record.id}/close?plantId=${record.plantId}`);
      toast.success('계획이 종료되었습니다.');
      setPendingAction(null);
      fetchData();
    } catch (err) {
      toast.error(getApiErrorMessage(err, '종료 실패.'));
    }
  };

  const handleDelete = async (record: PmRecord) => {
    try {
      await axiosInstance.delete(`/pm/records?plantId=${record.plantId}&id=${record.id}`);
      toast.success('예방점검 문서가 삭제되었습니다.');
      setPendingAction(null);
      fetchData();
    } catch (err) {
      toast.error(getApiErrorMessage(err, '삭제 실패.'));
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
    if (stepStage === 'R' && !refNo) {
      toast.error('실적은 확정된 계획번호를 참조해야 합니다.');
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
          refModule: stepStage === 'R' ? 'PM' : null,
          status: saveStatus,
        },
        checkItems: checkItems.map((item, idx) => ({
          ...item,
          itemNo: idx + 1,
          checkValue: stepStage === 'P' ? null : item.checkValue,
        })),
      };

      const response = await axiosInstance.post('/pm/records', payload);
      const savedId = response.data.id;
      if (submitStatus === 'P') {
        setPmNo(savedId);
        setApprovalRef({
          refNo: savedId,
          title: `[예방점검 ${stepStage === 'P' ? '계획' : '실적'}] ${title || equipmentName || equipmentId}`,
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
      toast.error(getApiErrorMessage(err, '저장 중 오류가 발생했습니다.'));
    } finally {
      setIsLoading(false);
    }
  };

  const currentList = activeTab === 'plans' ? plans : results;

  const handleSearch = () => {
    fetchData();
  };

  const handleCloseCurrentPlan = async () => {
    if (!pmNo || stepStage !== 'P' || !['C', 'S'].includes(status) || closeYn === 'Y') return;
    const confirmed = await requestConfirmation(
      `[${pmNo}] 예방점검 계획을 종료하시겠습니까?\n종료 후 수정할 수 없습니다.`,
      '계획 종료',
    );
    if (!confirmed) return;

    setIsLoading(true);
    try {
      await axiosInstance.patch(`/pm/plans/${pmNo}/close?plantId=${plantId}`);
      setCloseYn('Y');
      setIsFormOpen(false);
      toast.success('계획이 종료되었습니다.');
      fetchData();
    } catch (err) {
      toast.error(getApiErrorMessage(err, '종료 실패.'));
    } finally {
      setIsLoading(false);
    }
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
          {activeTab === 'plans' && (
            <button
              onClick={openNewPlan}
              className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border-0"
            >
              <Plus size={14} />
              입력
            </button>
          )}
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
            <option value="title">타이틀</option>
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
                  {activeTab === 'plans' && <th className="p-3 font-semibold">제목</th>}
                  {activeTab === 'results' && <th className="p-3 font-semibold">참조계획</th>}
                  <th className="p-3 font-semibold">설비</th>
                  {activeTab === 'plans' && <th className="p-3 font-semibold">계획기간</th>}
                  <th className="p-3 font-semibold">{activeTab === 'plans' ? '계획일' : '점검일'}</th>
                  <th className="p-3 font-semibold">담당자</th>
                  <th className="p-3 font-semibold">점검유형</th>
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
                      {activeTab === 'plans' && (
                        <td className="p-3 text-slate-300 print:text-slate-800">{rec.title || '-'}</td>
                      )}
                      {activeTab === 'results' && <td className="p-3 font-mono text-slate-500">{rec.refNo || '-'}</td>}
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
                      <td className="p-3">{rec.workerId}</td>
                      <td className="p-3">{PM_TYPE_LABELS[rec.checkTypeCode] || rec.checkTypeCode}</td>
                      {activeTab === 'results' && (
                        <td className="p-3">
                          <span className={`font-semibold ${rec.judgeCode === 'OK' ? 'text-emerald-400 print:text-emerald-700' : 'text-rose-400 print:text-rose-700'}`}>
                            {JUDGE_LABELS[rec.judgeCode] || rec.judgeCode}
                          </span>
                        </td>
                      )}
                      <td className="p-3">
                        {rec.closeYn === 'Y' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-700 text-gray-300 print:bg-gray-200 print:text-gray-700">종료</span>
                        ) : rec.status === 'E' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-900/50 text-amber-400 print:bg-amber-100 print:text-amber-700">만료</span>
                        ) : (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${getStatusClass(rec.status)}`}>
                            {getStatusLabel(rec.status)}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right print:hidden">
                        <div className="flex justify-end gap-2">
                          {activeTab === 'plans' && isConfirmed(rec.status) && rec.closeYn !== 'Y' && (
                            <button
                              onClick={() => openResultFromPlan(rec)}
                              title="실적 입력"
                              className="p-1.5 text-emerald-400 hover:bg-emerald-950/40 rounded transition-colors border-0 cursor-pointer bg-transparent"
                            >
                              <PlayCircle size={14} />
                            </button>
                          )}
                          {activeTab === 'plans' && rec.closeYn !== 'Y' && (
                            <button
                              onClick={() => setPendingAction({ type: 'close', record: rec })}
                              title="계획 종료"
                              className="p-1.5 text-amber-400 hover:bg-amber-950/40 rounded transition-colors border-0 cursor-pointer bg-transparent"
                            >
                              <ClipboardCheck size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => loadRecordIntoForm(rec)}
                            title="상세/수정"
                            className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded transition-colors border-0 cursor-pointer bg-transparent"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => setPendingAction({ type: 'delete', record: rec })}
                            title="삭제"
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors border-0 cursor-pointer bg-transparent"
                          >
                            <Trash2 size={13} />
                          </button>
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
                  <label className="block text-slate-400 mb-1.5">제목</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="예방점검 계획 제목"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1.5">대상 설비 <span className="text-rose-500">*</span></label>
                  {stepStage === 'P' && !pmNo ? (
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
                      disabled={stepStage === 'R'}
                      value={checkTypeCode}
                      onChange={(e) => handleCheckTypeChange(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-300 outline-none disabled:opacity-80"
                    >
                      <option value="INSPECT">예방점검</option>
                      <option value="PATROL">순회점검</option>
                      <option value="REPLACE">소모품교체</option>
                      <option value="LEGAL">정기법정검사</option>
                    </select>
                    {stepStage === 'P' && (
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
                <button
                  onClick={() => handleSave('T')}
                  disabled={isLoading}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-750 rounded-lg py-2 px-4 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                >
                  임시 저장
                </button>
                {stepStage === 'P' && ['C', 'S'].includes(status) && closeYn !== 'Y' && (
                  <button
                    type="button"
                    onClick={handleCloseCurrentPlan}
                    disabled={isLoading}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-750 rounded-lg py-2 px-4 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    계획 종료
                  </button>
                )}
                <button
                  onClick={() => handleSave('P')}
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 px-4 text-xs font-semibold transition-colors cursor-pointer border-0 disabled:opacity-50"
                >
                  결재 상신
                </button>
                {canDirectConfirm && (
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

      <ApprovalSubmitModal
        open={!!approvalRef}
        refModule="PM"
        refNo={approvalRef?.refNo || ''}
        defaultTitle={approvalRef?.title || ''}
        users={usersList}
        currentUserId={user?.id}
        onClose={() => setApprovalRef(null)}
        onSubmitted={(newApprovalId) => {
          setApprovalId(newApprovalId);
          setApprovalRef(null);
          setIsFormOpen(false);
          toast.success('예방점검 결재 문서가 상신되었습니다.');
          fetchData();
        }}
      />
    </div>
  );
}
