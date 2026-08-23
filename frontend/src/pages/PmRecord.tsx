import { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ClipboardCheck, Edit2, Plus, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../store/useAuthStore';
import { APP_MODULE } from '../constants/module';
import { getCommonStatusLabel as getStatusLabel, getJudgeLabel } from '../constants/status';
import { formatDateOnly, formatDateTimeSeconds, todayLocal } from '../utils/datetime';
import { hasModuleCreate } from '../utils/moduleAccess';
import { requestConfirmation } from '../utils/userActionDialog';
import { toastApiError } from '../utils/apiError';
import { openListPrint } from '../utils/listPrint';
import { openPrintWindow } from '../utils/printWindow';
import type { RichTextDocument } from '../types/richText';
import DocumentListPanel from '../components/DocumentListPanel';
import ListBadge from '../components/ListBadge';
import ListIconButton from '../components/ListIconButton';
import PrintWindowLayout from '../components/PrintWindowLayout';
import PmReportPrint from '../components/PmReportPrint';
import ApprovalDraftModal from '../features/approval/components/ApprovalDraftModal';
import { loadApprovalSignatureSteps } from '../features/approval/approval-signature';
import PmFormModal from '../features/pm/components/PmFormModal';
import { pmApi } from '../features/pm/pm.api';
import type { PmRecord, PmRecordItem } from '../features/pm/pm.types';
import { equipmentApi } from '../features/equipment/equipment.api';
import { mdmLookupApi } from '../features/mdm/reference.api';
import { createPmApprovalContent } from '../utils/pmApprovalContent';

type Option = { id: string; name: string };
type UserOption = Option & { title?: string | null; position?: string | null };

const normalizeRecord = (record: PmRecord): PmRecord => ({
  ...record,
  workDate: formatDateOnly(record.workDate) || null,
});

export default function PmRecord() {
  const user = useAuthStore((state) => state.user);
  const activePlantId = useAuthStore((state) => state.activePlantId);
  const [results, setResults] = useState<PmRecord[]>([]);
  const [depts, setDepts] = useState<Option[]>([]);
  const [pmTypes, setPmTypes] = useState<Option[]>([]);
  const [availablePmTypes, setAvailablePmTypes] = useState<Option[]>([]);
  const [usersList, setUsersList] = useState<UserOption[]>([]);
  const [searchType, setSearchType] = useState<'id' | 'title' | 'author'>('id');
  const [searchValue, setSearchValue] = useState('');
  const [tempOnly, setTempOnly] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [pmNo, setPmNo] = useState('');
  const [title, setTitle] = useState('');
  const [plantId, setPlantId] = useState('');
  const [equipmentId, setEquipmentId] = useState('');
  const [equipmentName, setEquipmentName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [checkTypeCode, setCheckTypeCode] = useState('');
  const [workDate, setWorkDate] = useState(todayLocal());
  const [workerId, setWorkerId] = useState('');
  const [judgeCode, setJudgeCode] = useState('OK');
  const [remarks, setRemarks] = useState('');
  const [approvalId, setApprovalId] = useState('');
  const [fileGroupId, setFileGroupId] = useState<number | null>(null);
  const [createdAt, setCreatedAt] = useState('');
  const [createdBy, setCreatedBy] = useState('');
  const [recordStatus, setRecordStatus] = useState('T');
  const [checkItems, setCheckItems] = useState<PmRecordItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [approvalRef, setApprovalRef] = useState<{
    refNo: string;
    title: string;
    content: RichTextDocument;
  } | null>(null);

  const canCreate = hasModuleCreate(user?.moduleAccess, APP_MODULE.PM);
  const isNew = !pmNo;
  const isOwnDraft = recordStatus === 'T' && createdBy === user?.id;
  const canEditCurrent = isNew ? canCreate : isOwnDraft;
  const canDeleteCurrent = !isNew && isOwnDraft;

  const loadList = useCallback(async () => {
    try {
      const [loaded, departments, users, types] = await Promise.all([
        pmApi.getAll({ plantId: activePlantId, searchType, searchValue, tempOnly }),
        mdmLookupApi.getDepartmentOptions(),
        mdmLookupApi.getUserOptions(),
        mdmLookupApi.getPmTypeOptions(),
      ]);
      setResults(loaded.map(normalizeRecord));
      setDepts(departments);
      setUsersList(users);
      setPmTypes(types);
      setAvailablePmTypes(types);
    } catch (error) {
      toastApiError(error, '예방점검 실적 목록을 불러오지 못했습니다.');
    }
  }, [activePlantId, searchType, searchValue, tempOnly]);

  useEffect(() => {
    const run = async () => loadList();
    void run();
  }, [loadList]);

  const resetForm = () => {
    setPmNo('');
    setTitle('');
    setPlantId(activePlantId || '');
    setEquipmentId('');
    setEquipmentName('');
    setDepartmentId(user?.departmentId || depts[0]?.id || '');
    setCheckTypeCode('');
    setWorkDate(todayLocal());
    setWorkerId(user?.id || '');
    setJudgeCode('OK');
    setRemarks('');
    setApprovalId('');
    setFileGroupId(null);
    setCreatedAt('');
    setCreatedBy('');
    setRecordStatus('T');
    setCheckItems([]);
    setAvailablePmTypes([]);
  };

  const handleEquipmentChange = async (id: string, selectedPlantId: string, name: string) => {
    setEquipmentId(id);
    setEquipmentName(name);
    setPlantId(selectedPlantId);
    setCheckTypeCode('');
    setAvailablePmTypes([]);
    if (!id || !selectedPlantId) return;
    try {
      const detail = await equipmentApi.getDetail(selectedPlantId, id);
      const allowed = new Set(detail.checkCycles.map((cycle) => cycle.checkTypeCode));
      setAvailablePmTypes(pmTypes.filter((type) => allowed.has(type.id)));
    } catch (error) {
      toastApiError(error, '설비 점검유형을 불러오지 못했습니다.');
    }
  };

  const loadDetail = async (record: PmRecord) => {
    setIsLoading(true);
    try {
      const detail = await pmApi.getDetail(record.plantId, record.id);
      const result = detail.pmRecord;
      const rejected = result.status === 'R';
      setPmNo(rejected ? '' : result.id);
      setTitle(result.title || '');
      setPlantId(result.plantId);
      setEquipmentId(result.equipmentId);
      setEquipmentName(record.equipmentName || result.equipmentId);
      setDepartmentId(result.departmentId);
      setCheckTypeCode(result.checkTypeCode);
      setWorkDate(formatDateOnly(result.workDate));
      setWorkerId(result.workerId);
      setJudgeCode(result.judgeCode);
      setRemarks(result.remarks || '');
      setApprovalId(result.approvalId || '');
      setFileGroupId(rejected ? null : result.fileGroupId ?? null);
      setCreatedAt(rejected ? '' : result.createdAt || '');
      setCreatedBy(rejected ? '' : result.createdBy || '');
      setRecordStatus(rejected ? 'T' : result.status || 'T');
      setCheckItems(detail.checkItems || []);
      setAvailablePmTypes(pmTypes);
      setIsFormOpen(true);
    } catch (error) {
      toastApiError(error, '예방점검 상세를 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTemplates = async (code: string) => {
    if (!plantId || !equipmentId) return;
    setIsLoading(true);
    try {
      const templates = await pmApi.getTemplates(plantId, equipmentId, code);
      setCheckItems(templates.map((item, index) => ({
        ...item,
        itemNo: index + 1,
        checkValue: null,
        minValue: item.minValue == null ? null : Number(item.minValue),
        maxValue: item.maxValue == null ? null : Number(item.maxValue),
        baseValue: item.baseValue == null ? null : Number(item.baseValue),
      })));
    } catch (error) {
      toastApiError(error, '템플릿 로딩 실패.');
    } finally {
      setIsLoading(false);
    }
  };

  const updateItem = (index: number, field: keyof PmRecordItem, value: string) => {
    setCheckItems((items) => items.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const numeric = ['minValue', 'maxValue', 'baseValue', 'checkValue'].includes(field);
      return { ...item, [field]: numeric ? (value === '' ? null : Number(value)) : value };
    }));
  };

  const addPlanItem = () => setCheckItems((items) => [...items, {
    itemNo: items.length + 1, checkName: '', checkMethod: '', minValue: null, maxValue: null,
    baseValue: null, unit: '', checkValue: null,
  }]);

  const removePlanItem = (index: number) => setCheckItems((items) => items
    .filter((_, itemIndex) => itemIndex !== index)
    .map((item, itemIndex) => ({ ...item, itemNo: itemIndex + 1 })));

  const handleSave = async (submitStatus: 'T' | 'P') => {
    if (!plantId || !equipmentId || !departmentId || !checkTypeCode || !workDate
      || checkItems.some((item) => !item.checkName?.trim())) {
      toast.error('설비, 부서, 점검유형, 점검일과 점검항목을 확인하세요.');
      return;
    }
    setIsLoading(true);
    try {
      const payload = {
        pmRecord: {
          id: pmNo || null, title: title || null, plantId, equipmentId, departmentId,
          checkTypeCode, workDate, workerId, judgeCode, remarks: remarks || null,
          approvalId: approvalId || null, fileGroupId, status: 'T',
        },
        checkItems: checkItems.map((item, index) => ({ ...item, itemNo: index + 1 })),
      };
      const saved = pmNo ? await pmApi.update(pmNo, payload) : await pmApi.create(payload);
      if (submitStatus === 'P') {
        setPmNo(saved.id);
        setApprovalRef({
          refNo: saved.id,
          title: `[예방점검 실적] ${title || equipmentName || equipmentId}`,
          content: createPmApprovalContent({
            pmNo: saved.id, statusLabel: getStatusLabel('P'), createdAt: saved.createdAt,
            departmentName: depts.find((dept) => dept.id === departmentId)?.name || departmentId,
            authorName: usersList.find((candidate) => candidate.id === saved.createdBy)?.name
              || saved.createdBy || user?.name || '-',
            equipmentName: `${equipmentId} / ${equipmentName || equipmentId}`,
            checkTypeName: pmTypes.find((type) => type.id === checkTypeCode)?.name || checkTypeCode,
            workDate, judgeName: getJudgeLabel(judgeCode), remarks, checkItems,
          }),
        });
      } else {
        toast.success('예방점검 실적이 임시저장 되었습니다.');
        setIsFormOpen(false);
        await loadList();
      }
    } catch (error) {
      toastApiError(error, '저장 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!pmNo || !plantId || !(await requestConfirmation('예방점검 문서를 삭제하시겠습니까?'))) return;
    try {
      await pmApi.delete(plantId, pmNo);
      toast.success('삭제되었습니다.');
      setIsFormOpen(false);
      await loadList();
    } catch (error) {
      toastApiError(error, '삭제 실패.');
    }
  };

  const handlePrint = () => {
    if (!results.length) { toast.error('인쇄할 목록이 없습니다.'); return; }
    const opened = openListPrint({
      title: '예방점검 실적 현황', rows: results, getRowKey: (record) => `${record.plantId}:${record.id}`,
      companyName: user?.companyName || user?.companyId || 'CMMS', printerName: user?.name || '-',
      printedAt: formatDateTimeSeconds(new Date()),
      columns: [
        { header: '문서번호', render: (record) => record.id },
        { header: '제목', render: (record) => record.title || '-' },
        { header: '대상설비', render: (record) => record.equipmentName || record.equipmentId },
        { header: '점검일', render: (record) => record.workDate || '-' },
        { header: '상태', render: (record) => getStatusLabel(record.status) },
      ],
    });
    if (!opened) toast.error('팝업이 차단되었습니다.');
  };

  const openPrintDocument = async (record: PmRecord) => {
    const target = openPrintWindow({ title: '예방점검 문서 출력', rootId: 'pm-print-root' });
    if (!target) { toast.error('팝업이 차단되었습니다.'); return; }
    try {
      const response = await pmApi.getDetail(record.plantId, record.id);
      const detail = normalizeRecord({ ...record, ...response.pmRecord });
      const root = createRoot(target.container);
      root.render(
        <PrintWindowLayout printWindow={target.printWindow} contentClassName="max-w-[180mm]">
          <PmReportPrint
            pmNo={detail.id} title={detail.title || undefined} status={detail.status}
            approvalId={detail.approvalId} createdAt={formatDateOnly(detail.createdAt)}
            deptName={depts.find((dept) => dept.id === detail.departmentId)?.name || detail.departmentId}
            authorName={detail.createdBy || '-'} workDate={detail.workDate}
            equipmentName={`${detail.equipmentId} / ${detail.equipmentName || detail.equipmentId}`}
            checkTypeCode={pmTypes.find((type) => type.id === detail.checkTypeCode)?.name || detail.checkTypeCode}
            judgeCode={detail.judgeCode} remarks={detail.remarks || undefined}
            checkItems={response.checkItems || []}
            approvalSteps={await loadApprovalSignatureSteps(detail.approvalId, usersList)}
          />
        </PrintWindowLayout>,
      );
      target.printWindow.focus();
    } catch (error) {
      target.printWindow.close();
      toastApiError(error, '출력 문서를 불러오지 못했습니다.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center print:hidden">
        <div><h1 className="text-2xl font-bold text-slate-100">예방점검 관리</h1><p className="text-slate-400 text-sm mt-1">설비 마스터의 점검유형을 기준으로 실적을 입력합니다.</p></div>
        <div className="flex gap-3">
          {canCreate && <button type="button" onClick={() => { resetForm(); setIsFormOpen(true); }} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-xs font-semibold"><Plus size={14} /> 신규 실적</button>}
          <button type="button" onClick={handlePrint} className="bg-slate-900 text-slate-300 rounded-lg px-4 py-2 text-xs"><Printer size={14} /> 목록 인쇄</button>
        </div>
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex gap-3 print:hidden">
        <select value={searchType} onChange={(event) => setSearchType(event.target.value as typeof searchType)} className="bg-slate-950 rounded-lg py-1.5 px-3 text-xs"><option value="id">문서번호</option><option value="title">제목</option><option value="author">작성자</option></select>
        <input value={searchValue} onChange={(event) => setSearchValue(event.target.value)} className="flex-1 bg-slate-950 rounded-lg py-1.5 px-3 text-xs" placeholder="검색어 입력" />
        <button type="button" onClick={() => void loadList()} className="bg-blue-600 text-white rounded-lg px-4 text-xs">검색</button>
        <button type="button" onClick={() => setTempOnly((value) => !value)} className="border border-slate-700 rounded-lg px-3 text-xs">임시저장 {tempOnly ? 'ON' : 'OFF'}</button>
      </div>
      <DocumentListPanel isFormOpen={isFormOpen} landscape heading={<><ClipboardCheck size={16} className="text-blue-500" /> 예방점검 실적 목록</>} printHeading="예 방 점 검 실 적 목 록">
        <div className="border border-slate-800 rounded-xl overflow-hidden"><table className="w-full text-left text-xs"><thead><tr className="bg-slate-900 text-slate-400"><th className="p-3">문서번호</th><th className="p-3">제목</th><th className="p-3">대상설비</th><th className="p-3">점검일</th><th className="p-3">담당자</th><th className="p-3">유형</th><th className="p-3">판정</th><th className="p-3">상태</th><th className="p-3">작업</th></tr></thead><tbody>{results.length === 0 ? <tr><td colSpan={9} className="p-8 text-center text-slate-600">등록된 예방점검 실적이 없습니다.</td></tr> : results.map((record) => <tr key={record.id} className="border-b border-slate-900 text-slate-300"><td className="p-3"><button type="button" onClick={() => void openPrintDocument(record)} className="text-blue-400 bg-transparent border-0">{record.id}</button></td><td className="p-3">{record.title || '-'}</td><td className="p-3">{record.equipmentName || record.equipmentId}</td><td className="p-3">{record.workDate || '-'}</td><td className="p-3">{usersList.find((candidate) => candidate.id === record.workerId)?.name || record.workerId}</td><td className="p-3">{pmTypes.find((type) => type.id === record.checkTypeCode)?.name || record.checkTypeCode}</td><td className="p-3">{getJudgeLabel(record.judgeCode)}</td><td className="p-3"><ListBadge>{getStatusLabel(record.status)}</ListBadge></td><td className="p-3 text-right">{record.status === 'T' && record.createdBy === user?.id && <ListIconButton onClick={() => void loadDetail(record)} label="상세/수정" icon={Edit2} tone="accent" />}</td></tr>)}</tbody></table></div>
      </DocumentListPanel>
      {isFormOpen && <PmFormModal title={pmNo ? `예방점검 실적 상세/수정 [${pmNo}]` : '신규 예방점검 실적 입력'} onClose={() => setIsFormOpen(false)} form={{ pmNo, createdAt, departmentId, depts, createdBy, user, usersList, title, setTitle, equipmentId, equipmentName, plantId, activePlantId, canEditCurrent, canDeleteCurrent, onEquipmentChange: handleEquipmentChange, checkTypeCode, availablePmTypes, handleCheckTypeChange: setCheckTypeCode, loadTemplates, workDate, setWorkDate, judgeCode, setJudgeCode, remarks, setRemarks, checkItems, addPlanItem, updateItem, removePlanItem, isLoading, handleSave, handleDelete }} />}
      {approvalRef && <ApprovalDraftModal open mode="linked" refModule={APP_MODULE.PM} refNo={approvalRef.refNo} defaultTitle={approvalRef.title} defaultContent={approvalRef.content} users={usersList} currentUserId={user?.id} onClose={() => setApprovalRef(null)} onSubmitted={() => { setApprovalRef(null); setIsFormOpen(false); void loadList(); }} />}
    </div>
  );
}
