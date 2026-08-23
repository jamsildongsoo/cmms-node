import { useCallback, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { toast } from 'sonner';
import { requestConfirmation } from '../utils/userActionDialog';
import { useAuthStore } from '../store/useAuthStore';
import { hasModuleCreate } from '../utils/moduleAccess';
import { getCommonStatusLabel as getStatusLabel } from '../constants/status';
import { APP_MODULE } from '../constants/module';
import { formatDateOnly, formatPrintStamp, todayLocal } from '../utils/datetime';
import { toastApiError } from '../utils/apiError';
import WorkOrderPrint from '../components/WorkOrderPrint';
import PrintWindowLayout from '../components/PrintWindowLayout';
import { openPrintWindow } from '../utils/printWindow';
import { openListPrint } from '../utils/listPrint';
import ApprovalDraftModal from '../features/approval/components/ApprovalDraftModal';
import ListBadge from '../components/ListBadge';
import ListIconButton from '../components/ListIconButton';
import type { RichTextDocument } from '../types/richText';
import { createWorkOrderApprovalContent } from '../utils/workOrderApprovalContent';
import { loadApprovalSignatureSteps } from '../features/approval/approval-signature';
import type { WorkOrder as WorkOrderModel, WorkOrderItem as WorkOrderItemModel } from '../features/work-order/work-order.types';
import { workOrderApi } from '../features/work-order/work-order.api';
import { mdmLookupApi } from '../features/mdm/reference.api';
import { masterLookupApi } from '../features/master/master-reference.api';
import DocumentListPanel from '../components/DocumentListPanel';
import WorkOrderFormModal from '../features/work-order/components/WorkOrderFormModal';
import {
  ClipboardList, Edit2, Printer, Plus, PlayCircle
} from 'lucide-react';

export default function WorkOrder() {
  const user = useAuthStore((s) => s.user);
  const activePlantId = useAuthStore((s) => s.activePlantId);
  const [activeSubTab, setActiveSubTab] = useState<'plan' | 'history'>('plan');
  const [searchType, setSearchType] = useState<'id' | 'title' | 'worker'>('id');
  const [searchValue, setSearchValue] = useState('');
  const [tempOnly, setTempOnly] = useState(false);

  const [workOrders, setWorkOrders] = useState<WorkOrderModel[]>([]);
  const [equipments, setEquipments] = useState<{ id: string; name: string; plantId: string }[]>([]);
  const [depts, setDepts] = useState<{ id: string; name: string }[]>([]);
  const [usersList, setUsersList] = useState<{ id: string; name: string; title?: string | null; position?: string | null }[]>([]);

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Fields for WorkOrder
  const [woNo, setWoNo] = useState('');
  const [plantId, setPlantId] = useState('');
  const [equipmentId, setEquipmentId] = useState('');
  const [equipmentName, setEquipmentName] = useState('');
  const [title, setTitle] = useState('');
  const [stepStage, setStepStage] = useState('P'); // Default P
  const [woTypeCode, setWoTypeCode] = useState('BM'); // Default BM
  const [departmentId, setDepartmentId] = useState('');
  const [workerId, setWorkerId] = useState('');
  const [workDate, setWorkDate] = useState(todayLocal());
  const [cost, setCost] = useState(0);
  const [manHours, setManHours] = useState(0);
  const [manHoursUnit, setManHoursUnit] = useState('H');
  const [remarks, setRemarks] = useState('');
  const [refNo, setRefNo] = useState('');
  const [refModule, setRefModule] = useState('');
  const [approvalId, setApprovalId] = useState('');
  const [fileGroupId, setFileGroupId] = useState<number | null>(null);
  const [createdAt, setCreatedAt] = useState('');
  const [createdBy, setCreatedBy] = useState('');
  const [recordStatus, setRecordStatus] = useState('T');

  const [workItems, setWorkItems] = useState<WorkOrderItemModel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [approvalRef, setApprovalRef] = useState<{
    refNo: string;
    title: string;
    content: RichTextDocument;
  } | null>(null);

  const canCreate = hasModuleCreate(user?.moduleAccess, APP_MODULE.WO);
  const isNew = !woNo;
  const isOwnDraft = recordStatus === 'T' && createdBy === user?.id;
  const canEditCurrent = isNew ? canCreate : isOwnDraft;
  const canDeleteCurrent = !isNew && isOwnDraft;

  const loadList = useCallback(async () => {
    try {
      const params = {
        plantId: activePlantId,
        searchType: searchValue ? searchType : undefined,
        searchValue: searchValue || undefined,
        tempOnly,
      };
      // 폼 선택값 구성을 위한 시스템 참조값 조회다. 작업지시 목록 R 권한을 대체하지 않는다.
      const [loadedWorkOrders, loadedEquipments, loadedDepartments, loadedUsers] = await Promise.all([
        workOrderApi.getAll(params),
        masterLookupApi.getEquipments(),
        mdmLookupApi.getDepartmentOptions(),
        mdmLookupApi.getUserOptions(),
      ]);
      setWorkOrders((loadedWorkOrders || []).map((workOrder: WorkOrderModel) => ({
        ...workOrder,
        stepStage: workOrder.stepStage || 'P',
        workDate: formatDateOnly(workOrder.workDate) || null,
      })));
      setEquipments(loadedEquipments);
      setDepts(loadedDepartments);
      setUsersList(loadedUsers);
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
  }, [activeSubTab, loadList]);

  const handleOpenCreate = () => {
    setWoNo('');
    setPlantId(equipments.length > 0 ? equipments[0].plantId : '');
    setEquipmentId(equipments.length > 0 ? equipments[0].id : '');
    setEquipmentName(equipments.length > 0 ? equipments[0].name : '');
    setTitle('');
    setStepStage(activeSubTab === 'plan' ? 'P' : 'R');
    setWoTypeCode('BM');
    setDepartmentId(user?.departmentId || (depts.length > 0 ? depts[0].id : ''));
    setWorkerId(user?.id || '');
    setWorkDate(todayLocal());
    setCost(0);
    setManHours(0);
    setManHoursUnit('H');
    setRemarks('');
    setRefNo('');
    setRefModule('');
    setApprovalId('');
    setFileGroupId(null);
    setCreatedAt('');
    setCreatedBy('');
    setRecordStatus('T');
    setWorkItems([]);
    setIsFormOpen(true);
  };

  const loadDetail = async (wo: WorkOrderModel) => {
    setIsLoading(true);
    try {
      const data = await workOrderApi.getDetail(wo.plantId, wo.id);
      const w = data.workOrder;
      const isRejected = w.status === 'R';

      const matchedEq = equipments.find(e => e.id === w.equipmentId);
      setEquipmentName(matchedEq ? matchedEq.name : w.equipmentId);

      setWoNo(isRejected ? '' : w.id);
      setPlantId(w.plantId);
      setEquipmentId(w.equipmentId);
      setTitle(w.title);
      setStepStage(w.stepStage);
      setWoTypeCode(w.woTypeCode);
      setDepartmentId(w.departmentId);
      setWorkerId(w.workerId || '');
      setWorkDate(formatDateOnly(w.workDate));
      setCost(w.cost || 0);
      setManHours(w.manHours || 0);
      setManHoursUnit(w.manHoursUnit || 'H');
      setRemarks(w.remarks || '');
      setRefNo(w.refNo || '');
      setRefModule(w.refModule || '');
      setApprovalId('');
      setFileGroupId(isRejected ? null : w.fileGroupId ?? null);
      setCreatedAt(isRejected ? '' : (w.createdAt || ''));
      setCreatedBy(isRejected ? '' : (w.createdBy || ''));
      setRecordStatus(isRejected ? 'T' : (w.status || 'T'));
      setWorkItems(data.workItems || []);

      setIsFormOpen(true);
    } catch (err) {
      toastApiError(err, '작업지시 상세 기록을 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!woNo || !plantId) return;
    if (!(await requestConfirmation('정말 이 작업지시를 삭제하시겠습니까?'))) return;
    try {
      await workOrderApi.delete(plantId, woNo);
      toast.success('작업지시가 삭제되었습니다.');
      setIsFormOpen(false);
      await loadList();
    } catch (err) {
      toastApiError(err, '삭제 실패.');
    }
  };

  const handleAddItem = () => {
    const nextNo = workItems.length + 1;
    setWorkItems([...workItems, { itemNo: nextNo, workName: '', workMethod: '', workResult: '' }]);
  };

  const handleRemoveItem = (idx: number) => {
    const updated = workItems.filter((_, i) => i !== idx).map((item, i) => ({
      ...item,
      itemNo: i + 1
    }));
    setWorkItems(updated);
  };

  const handleItemChange = (idx: number, field: keyof WorkOrderItemModel, val: string) => {
    setWorkItems(workItems.map((item, i) => {
      if (i === idx) {
        return { ...item, [field]: val };
      }
      return item;
    }));
  };

  const handleSave = async (submitStatus: 'T' | 'P') => {
    if (!title.trim()) {
      toast.error('지시명을 입력해주세요.');
      return;
    }
    setIsLoading(true);
    try {
      const saveStatus = submitStatus === 'P' ? 'T' : submitStatus;
      const payload = {
        workOrder: {
          id: woNo || null,
          plantId,
          equipmentId,
          title,
          stepStage,
          woTypeCode,
          departmentId,
          workerId: workerId || null,
          workDate: workDate || null,
          cost,
          manHours,
          manHoursUnit,
          remarks: remarks || null,
          fileGroupId,
          refNo: refNo || null,
          refModule: refModule || null,
          approvalId: approvalId || null,
          status: saveStatus
        },
        workItems
      };

      const saved = woNo
        ? await workOrderApi.update(woNo, payload)
        : await workOrderApi.create(payload);
      if (submitStatus === 'P') {
        const savedId = saved.id;
        setWoNo(savedId);
        setApprovalRef({
          refNo: savedId,
          title: `[작업지시] ${title}`,
          content: createWorkOrderApprovalContent({
            woNo: savedId,
            statusLabel: getStatusLabel('P'),
            createdAt: saved.createdAt,
            departmentName: depts.find((dept) => dept.id === departmentId)?.name || departmentId,
            authorName:
              usersList.find((candidate) => candidate.id === saved.createdBy)?.name
              || saved.createdBy
              || user?.name
              || '-',
            equipmentName: `${equipmentId} / ${equipmentName || equipmentId}`,
            workTypeName: getWoTypeLabel(woTypeCode),
            workDate,
            cost,
            manHours,
            manHoursUnit,
            remarks,
            workItems,
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

  const getWoTypeLabel = (code: string) => {
    return {
      BM: '고장정비 (BM)',
      PM: '예방보전 (PM)',
      CM: '개조/개선 (CM)',
      ETC: '기타 작업'
    }[code] || code;
  };

  const openResultFromPlan = async (plan: WorkOrderModel) => {
    if (plan.status !== 'C') {
      toast.error('확정된 작업지시 계획에 대해서만 실적을 입력할 수 있습니다.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await workOrderApi.getDetail(plan.plantId, plan.id);
      const detail = { ...plan, ...response.workOrder } as WorkOrderModel;
      const matchedEquipment = equipments.find((equipment) => equipment.id === detail.equipmentId);

      setWoNo('');
      setPlantId(detail.plantId);
      setEquipmentId(detail.equipmentId);
      setEquipmentName(matchedEquipment?.name || detail.equipmentId);
      setTitle(detail.title);
      setStepStage('R');
      setWoTypeCode(detail.woTypeCode);
      setDepartmentId(detail.departmentId);
      setWorkerId(user?.id || '');
      setWorkDate(todayLocal());
      setCost(0);
      setManHours(0);
      setManHoursUnit(detail.manHoursUnit || 'H');
      setRemarks('');
      setRefNo(detail.id);
      setRefModule(APP_MODULE.WO);
      setApprovalId('');
      setCreatedAt('');
      setCreatedBy('');
      setWorkItems((response.workItems || []).map((item: WorkOrderItemModel) => ({
        ...item,
        workResult: '',
      })));
      setIsFormOpen(true);
    } catch (err) {
      toastApiError(err, '작업지시 계획 항목을 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const openPrintDocument = async (wo: WorkOrderModel) => {
    const printTarget = openPrintWindow({ title: '작업지시서 출력', rootId: 'wo-print-root' });
    if (!printTarget) {
      toast.error('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.');
      return;
    }
    const { printWindow, container } = printTarget;
    try {
      const response = await workOrderApi.getDetail(wo.plantId, wo.id);
      const detail = { ...wo, ...response.workOrder } as WorkOrderModel;
      const approvalSteps = await loadApprovalSignatureSteps(detail.approvalId, usersList);
      createRoot(container).render(
        <PrintWindowLayout printWindow={printWindow} contentClassName="max-w-[180mm]">
          <WorkOrderPrint
            stepStage={detail.stepStage === 'R' ? 'R' : 'P'}
            woNo={detail.id}
            title={detail.title}
            status={detail.status}
            approvalId={detail.approvalId}
            createdAt={formatDateOnly(detail.createdAt)}
            authorName={usersList.find((item) => item.id === detail.createdBy)?.name || detail.createdBy || '-'}
            deptName={depts.find((item) => item.id === detail.departmentId)?.name || detail.departmentId}
            workDate={detail.workDate || '-'}
            equipmentId={detail.equipmentId}
            equipmentName={equipments.find((item) => item.id === detail.equipmentId)?.name || detail.equipmentId}
            woTypeCode={getWoTypeLabel(detail.woTypeCode)}
            cost={detail.cost}
            manHours={detail.manHours}
            manHoursUnit={detail.manHoursUnit}
            remarks={detail.remarks || undefined}
            workItems={response.workItems || []}
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
    const printRows = activeSubTab === 'plan' ? plans : history;
    if (printRows.length === 0) { toast.error('인쇄할 목록이 없습니다.'); return; }
    const stamp = formatPrintStamp(new Date());
    const opened = openListPrint({
      title: '작업지시 현황',
      rows: printRows,
      getRowKey: (wo) => wo.id,
      companyName: user?.companyName || user?.companyId || 'CMMS',
      printerName: user?.name || '-',
      printedAt: stamp,
      columns: [
        { header: '문서번호', render: (wo) => wo.id, className: 'font-mono' },
        { header: '제목', render: (wo) => wo.title },
        { header: '대상설비', render: (wo) => equipments.find((item) => item.id === wo.equipmentId)?.name || wo.equipmentId },
        { header: '유형', render: (wo) => getWoTypeLabel(wo.woTypeCode) },
        { header: '담당자', render: (wo) => usersList.find((item) => item.id === wo.workerId)?.name || wo.workerId || '-' },
        { header: '계획/수행일자', render: (wo) => wo.workDate || '-' },
        { header: '상태', render: (wo) => getStatusLabel(wo.status) },
      ],
    });
    if (!opened) toast.error('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.');
  };

  // Filter plans vs history (completed work orders)
  const plans = workOrders.filter(w => w.stepStage === 'P');
  const history = workOrders.filter(w => w.stepStage === 'R');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <ClipboardList size={24} className="text-blue-500" />
            작업지시 관리
          </h1>
          <p className="text-slate-400 text-sm mt-1">설비 고장/개선 및 보전계획에 기반한 작업 계획과 작업 실적을 통합 관리합니다.</p>
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

          {/* Subtab control */}
          <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setActiveSubTab('plan')}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer border-0 outline-none ${
                activeSubTab === 'plan' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              계획
            </button>
            <button
              onClick={() => setActiveSubTab('history')}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer border-0 outline-none ${
                activeSubTab === 'history' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
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
            onChange={(event) => setSearchType(event.target.value as 'id' | 'title' | 'worker')}
            className="bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-3 text-xs text-slate-300 outline-none"
          >
            <option value="id">문서번호</option>
            <option value="title">제목</option>
            <option value="worker">담당자</option>
          </select>
          <input
            type="text"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && loadList()}
            placeholder="검색어 입력"
            className="flex-1 min-w-[200px] bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-3 text-xs text-slate-300 outline-none"
          />
          <button
            type="button"
            onClick={loadList}
            className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-1.5 text-xs font-semibold cursor-pointer border-0"
          >
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

      {/* Main Grid View */}
      <DocumentListPanel
        isFormOpen={isFormOpen}
        landscape
        heading={<><ClipboardList size={16} className="text-blue-500" /> 작업지시 목록</>}
        printHeading="작 업 지 시 현 황"
      >
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40 print:border-slate-300 print:bg-white print:rounded-none">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 select-none print:bg-slate-100 print:text-slate-800 print:border-slate-300">
                <th className="p-3 font-semibold">문서번호</th>
                <th className="p-3 font-semibold">제목</th>
                <th className="p-3 font-semibold">대상설비</th>
                <th className="p-3 font-semibold">유형</th>
                <th className="p-3 font-semibold">담당자</th>
                <th className="p-3 font-semibold">계획/수행일자</th>
                <th className="p-3 font-semibold">상태</th>
                <th className="p-3 font-semibold text-right print:hidden">작업</th>
              </tr>
            </thead>
            <tbody>
              {(activeSubTab === 'plan' ? plans : history).length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-slate-600 print:text-slate-400">조회된 작업지시 내역이 없습니다.</td></tr>
              ) : (
                (activeSubTab === 'plan' ? plans : history).map((wo) => (
                  <tr key={wo.id} className="border-b border-slate-900 hover:bg-slate-900/30 text-slate-300 print:border-slate-200 print:text-slate-800 print:hover:bg-transparent">
                    <td className="p-3 font-mono">
                      <button
                        type="button"
                        onClick={() => openPrintDocument(wo)}
                        className="no-print bg-transparent border-0 p-0 text-blue-400 hover:text-blue-300 hover:underline font-mono cursor-pointer"
                      >
                        {wo.id}
                      </button>
                      <span className="hidden print:inline text-slate-600">{wo.id}</span>
                    </td>
                    <td className="p-3 font-semibold text-slate-200 print:text-slate-900">{wo.title}</td>
                    <td className="p-3 text-slate-400">{equipments.find(e => e.id === wo.equipmentId)?.name || wo.equipmentId}</td>
                    <td className="p-3">{getWoTypeLabel(wo.woTypeCode)}</td>
                    <td className="p-3">{usersList.find(u => u.id === wo.workerId)?.name || wo.workerId || '-'}</td>
                    <td className="p-3">{wo.workDate || '-'}</td>
                    <td className="p-3">
                      <ListBadge>{getStatusLabel(wo.status)}</ListBadge>
                    </td>
                    <td className="p-3 text-right space-x-2 print:hidden">
                      {canCreate && activeSubTab === 'plan' && wo.status === 'C' && (
                        <ListIconButton
                          onClick={() => openResultFromPlan(wo)}
                          label="실적 입력"
                          icon={PlayCircle}
                          tone="success"
                        />
                      )}
                      {wo.status === 'T' && wo.createdBy === user?.id && (
                        <ListIconButton
                          onClick={() => loadDetail(wo)}
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
        <WorkOrderFormModal
          title={woNo ? `작업지시 ${stepStage === 'P' ? '계획' : '실적'} 상세/수정 [${woNo}] ${equipmentName}` : `신규 작업지시 ${stepStage === 'P' ? '계획' : '실적'} 등록`}
          onClose={() => setIsFormOpen(false)}
          form={{
            woNo,
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
            woTypeCode,
            setWoTypeCode,
            workDate,
            setWorkDate,
            manHours,
            setManHours,
            manHoursUnit,
            setManHoursUnit,
            cost,
            setCost,
            refNo,
            refModule,
            remarks,
            setRemarks,
            workItems,
            handleAddItem,
            handleRemoveItem,
            handleItemChange,
            isLoading,
            handleSave,
            handleDelete,
          }}
        />
      )}
      <ApprovalDraftModal
        open={!!approvalRef}
        mode="linked"
        refModule={APP_MODULE.WO}
        refNo={approvalRef?.refNo || ''}
        defaultTitle={approvalRef?.title || ''}
        defaultContent={approvalRef?.content}
        users={usersList}
        currentUserId={user?.id}
        onClose={() => setApprovalRef(null)}
        onSubmitted={() => {
          setApprovalRef(null);
          setIsFormOpen(false);
          toast.success('작업지시 결재 문서가 상신되었습니다.');
          loadList();
        }}
      />
    </div>
  );
}
