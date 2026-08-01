import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { toast } from 'sonner';
import { requestConfirmation } from '../utils/userActionDialog';
import { useAuthStore } from '../store/useAuthStore';
import { getCommonStatusLabel as getStatusLabel } from '../constants/status';
import { APP_MODULE } from '../constants/module';
import { formatDateOnly, formatPrintStamp, todayLocal } from '../utils/datetime';
import { toastApiError } from '../utils/apiError';
import PrintHeader from '../components/PrintHeader';
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
import { referenceApi } from '../features/mdm/reference.api';
import { masterReferenceApi } from '../features/master/master-reference.api';
import {
  ClipboardList, Edit2, Trash2, Printer, X, Plus, Trash, PlayCircle
} from 'lucide-react';

export default function WorkOrder() {
  const user = useAuthStore((s) => s.user);
  const activePlantId = useAuthStore((s) => s.activePlantId);
  const [activeSubTab, setActiveSubTab] = useState<'plan' | 'history'>('plan');
  const [searchType, setSearchType] = useState<'id' | 'title' | 'worker'>('id');
  const [searchValue, setSearchValue] = useState('');

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
  const [createdAt, setCreatedAt] = useState('');
  const [createdBy, setCreatedBy] = useState('');

  const [workItems, setWorkItems] = useState<WorkOrderItemModel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [approvalRef, setApprovalRef] = useState<{
    refNo: string;
    title: string;
    content: RichTextDocument;
  } | null>(null);

  const permission = user?.permissions?.[APP_MODULE.WO];
  const canCreate = permission?.C === 'Y';
  const canUpdate = permission?.U === 'Y';
  const canDelete = permission?.D === 'Y';
  const canDirectConfirm = permission?.A === 'Y';
  const canSave = woNo ? canUpdate : canCreate;

  const fetchData = async () => {
    try {
      const params = new URLSearchParams();
      if (searchValue) {
        params.set('searchType', searchType);
        params.set('searchValue', searchValue);
      }
      // 폼 선택값 구성을 위한 시스템 참조값 조회다. 작업지시 목록 R 권한을 대체하지 않는다.
      const [loadedWorkOrders, loadedEquipments, loadedDepartments, loadedUsers] = await Promise.all([
        workOrderApi.getAll(params, activePlantId),
        masterReferenceApi.getEquipments(),
        referenceApi.getDepartmentOptions(),
        referenceApi.getUserOptions(),
      ]);
      setWorkOrders((loadedWorkOrders || []).map((workOrder: WorkOrderModel & { step_stage?: string }) => ({
        ...workOrder,
        stepStage: workOrder.stepStage || workOrder.step_stage || 'P',
        workDate: formatDateOnly(workOrder.workDate) || null,
      })));
      setEquipments(loadedEquipments);
      setDepts(loadedDepartments);
      setUsersList(loadedUsers);
    } catch (err) {
      toastApiError(err, '목록을 불러오지 못했습니다.');
    }
  };

  // 검색 실행은 버튼이 담당하므로 최초 진입 시에만 자동 조회한다.
  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchData(); }, 0);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlantId]);

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
    setCreatedAt('');
    setCreatedBy('');
    setWorkItems([]);
    setIsFormOpen(true);
  };

  const handleOpenEdit = async (wo: WorkOrderModel) => {
    setIsLoading(true);
    try {
      const data = await workOrderApi.getDetail(wo.plantId, wo.id);
      const w = data.workOrder;

      const matchedEq = equipments.find(e => e.id === w.equipmentId);
      setEquipmentName(matchedEq ? matchedEq.name : w.equipmentId);

      setWoNo(w.id);
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
      setApprovalId(w.status === 'R' ? '' : (w.approvalId || ''));
      setCreatedAt(w.createdAt || '');
      setCreatedBy(w.createdBy || '');
      setWorkItems(data.workItems || []);

      setIsFormOpen(true);
    } catch (err) {
      toastApiError(err, '작업지시 상세 기록을 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (wo: WorkOrderModel) => {
    if (!(await requestConfirmation('정말 이 작업지시를 삭제하시겠습니까?'))) return;
    try {
      await workOrderApi.delete(wo.plantId, wo.id);
      toast.success('작업지시가 삭제되었습니다.');
      fetchData();
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

  const handleSave = async (submitStatus: 'T' | 'S' | 'P') => {
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
          refNo: refNo || null,
          refModule: refModule || null,
          approvalId: approvalId || null,
          status: saveStatus
        },
        workItems
      };

      const saved = woNo
        ? await workOrderApi.update(payload)
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
      toast.success(submitStatus === 'T' ? '임시저장 되었습니다.' : '작업지시가 직접 확정 완료되었습니다.');
      setIsFormOpen(false);
      fetchData();
    } catch (err) {
      toastApiError(err, '저장 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEquipmentChange = (eqId: string) => {
    const matched = equipments.find(e => e.id === eqId);
    if (matched) {
      setEquipmentId(eqId);
      setEquipmentName(matched.name);
      setPlantId(matched.plantId);
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
    if (plan.status !== 'S' && plan.status !== 'C') {
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
        { header: '지시번호', render: (wo) => wo.id, className: 'font-mono' },
        { header: '지시명', render: (wo) => wo.title },
        { header: '설비명', render: (wo) => equipments.find((item) => item.id === wo.equipmentId)?.name || wo.equipmentId },
        { header: '작업유형', render: (wo) => getWoTypeLabel(wo.woTypeCode) },
        { header: '담당자', render: (wo) => usersList.find((item) => item.id === wo.workerId)?.name || wo.workerId || '-' },
        { header: '계획/수행일자', render: (wo) => wo.workDate || '-' },
        { header: '결재상태', render: (wo) => getStatusLabel(wo.status) },
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
            onKeyDown={(event) => event.key === 'Enter' && fetchData()}
            placeholder="검색어 입력"
            className="flex-1 min-w-[200px] bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-3 text-xs text-slate-300 outline-none"
          />
          <button
            type="button"
            onClick={fetchData}
            className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-1.5 text-xs font-semibold cursor-pointer border-0"
          >
            검색
          </button>
        </div>
      </div>

      {/* Main Grid View */}
      <div className={`bg-slate-900 border border-slate-800 rounded-xl p-6 print:border-0 print:bg-transparent print:p-0 print-landscape ${isFormOpen ? 'print:hidden' : ''}`}>

        {/* Print Only Header */}
        <PrintHeader />
        <h1 className="hidden print:block text-center text-xl font-bold tracking-widest text-black border-b-2 border-black pb-2 mb-4">작 업 지 시 현 황</h1>

        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40 print:border-slate-300 print:bg-white print:rounded-none">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 select-none print:bg-slate-100 print:text-slate-800 print:border-slate-300">
                <th className="p-3 font-semibold">지시번호</th>
                <th className="p-3 font-semibold">지시명</th>
                <th className="p-3 font-semibold">설비명</th>
                <th className="p-3 font-semibold">작업유형</th>
                <th className="p-3 font-semibold">담당자</th>
                <th className="p-3 font-semibold">계획/수행일자</th>
                <th className="p-3 font-semibold">결재상태</th>
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
                      {canCreate && activeSubTab === 'plan' && (wo.status === 'S' || wo.status === 'C') && (
                        <ListIconButton
                          onClick={() => openResultFromPlan(wo)}
                          label="실적 입력"
                          icon={PlayCircle}
                          tone="success"
                        />
                      )}
                      {canUpdate && ['T', 'R'].includes(wo.status) && (
                        <ListIconButton
                          onClick={() => handleOpenEdit(wo)}
                          label="상세/수정"
                          icon={Edit2}
                          tone="accent"
                        />
                      )}
                      {canDelete && wo.status === 'T' && (
                          <ListIconButton
                            onClick={() => handleDelete(wo)}
                            label="삭제"
                            icon={Trash2}
                            tone="danger"
                          />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Input / View Detail Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto print:absolute print:inset-0 print:bg-white print:p-0">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl print:border-0 print:shadow-none print:max-h-none print:w-full print:h-full">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex justify-between items-center shrink-0 print:hidden">
              <h2 className="text-lg font-bold text-slate-200">
                {woNo
                  ? `작업지시 ${stepStage === 'P' ? '계획' : '실적'} 상세/수정 [${woNo}] ${equipmentName}`
                  : `신규 작업지시 ${stepStage === 'P' ? '계획' : '실적'} 등록`}
              </h2>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-slate-500 hover:text-slate-300 p-1 hover:bg-slate-800 rounded transition-colors border-0 cursor-pointer bg-transparent"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 print:hidden">

              {/* Status Header Area */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block mb-0.5">문서번호</span>
                  <span className="font-mono font-semibold text-slate-300">{woNo || '(저장 시 자동발행)'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">작성일</span>
                  <span className="font-mono text-slate-300">{formatDateOnly(createdAt) || (woNo ? '-' : '저장 시 기록')}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">부서</span>
                  <span className="text-slate-300">{departmentId || '-'} / {depts.find((item) => item.id === departmentId)?.name || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">작성자</span>
                  <span className="text-slate-300">{createdBy || user?.id || '-'} / {usersList.find((item) => item.id === (createdBy || user?.id))?.name || user?.name || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">단계</span>
                  <span className="text-slate-300">{stepStage === 'P' ? '계획(P)' : '실적(R)'}</span>
                </div>
              </div>

              {/* Input Form Grid divided into [일반 정보], [작업 정보], [기타 정보] */}
              <div className="space-y-6">
                {/* [일반 정보] 섹션 */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider pl-2 border-l-2 border-blue-500 print:text-slate-800 print:border-slate-400">
                    [일반 정보]
                  </h4>
                  <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-5 print:bg-white print:border-slate-300">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                      <div className="sm:col-span-2 md:col-span-3">
                        <label className="block text-slate-400 mb-1.5 print:text-slate-600 font-semibold">지시명 <span className="text-rose-500 print:hidden">*</span></label>
                        <input
                          type="text"
                          required
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="예: 3호기 순환펌프 메카니컬 씰 교체 작업"
                          className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none print:bg-white print:border-slate-300 print:text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1.5 print:text-slate-600">대상 설비 <span className="text-rose-500 print:hidden">*</span></label>
                        <select
                          value={equipmentId}
                          onChange={(e) => handleEquipmentChange(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-300 outline-none print:bg-white print:border-slate-300 print:text-slate-800"
                        >
                          {equipments.map(eq => (
                            <option key={eq.id} value={eq.id}>{eq.name} [{eq.id}]</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1.5 print:text-slate-600">작업 구분</label>
                        <select
                          value={woTypeCode}
                          onChange={(e) => setWoTypeCode(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-300 outline-none print:bg-white print:border-slate-300 print:text-slate-800"
                        >
                          <option value="BM">고장정비 (BM)</option>
                          <option value="PM">예방보전 (PM)</option>
                          <option value="CM">개조/개선 (CM)</option>
                          <option value="ETC">기타 작업</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* [작업 정보] 섹션 */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider pl-2 border-l-2 border-emerald-500 print:text-slate-800 print:border-slate-400">
                    [작업 정보]
                  </h4>
                  <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-5 print:bg-white print:border-slate-300">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                      <div>
                        <label className="block text-slate-400 mb-1.5 print:text-slate-600">계획/수행 일자</label>
                        <input
                          type="date"
                          value={workDate}
                          onChange={(e) => setWorkDate(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none print:bg-white print:border-slate-300 print:text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1.5 print:text-slate-600">소요 공수시간(M/H)</label>
                        <div className="flex gap-1.5">
                          <input
                            type="number"
                            step="0.5"
                            value={manHours}
                            onChange={(e) => setManHours(Number(e.target.value))}
                            className="flex-1 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none print:bg-white print:border-slate-300 print:text-slate-800"
                          />
                          <select
                            value={manHoursUnit}
                            onChange={(e) => setManHoursUnit(e.target.value)}
                            className="w-16 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-1 text-slate-300 text-center outline-none print:bg-white print:border-slate-300 print:text-slate-800"
                          >
                            <option value="H">시간</option>
                            <option value="D">일(Day)</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1.5 print:text-slate-600">외주/자재 비용 (원)</label>
                        <input
                          type="number"
                          value={cost}
                          onChange={(e) => setCost(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none print:bg-white print:border-slate-300 print:text-slate-800"
                        />
                      </div>
                      <div className="hidden print:block">
                        <label className="block text-slate-400 mb-1.5 print:text-slate-600">연계 참조번호 / 참조모듈</label>
                        <div className="flex gap-1.5 font-mono text-[10px]">
                          <input
                            type="text"
                            placeholder="참조번호"
                            disabled
                            value={refNo}
                            className="w-2/3 bg-slate-950 border border-slate-800 rounded-lg py-2 px-2 text-slate-200 outline-none print:bg-white print:border-slate-300 print:text-slate-800"
                          />
                          <input
                            type="text"
                            placeholder="모듈"
                            disabled
                            value={refModule}
                            className="w-1/3 bg-slate-950 border border-slate-800 rounded-lg py-2 px-2 text-slate-200 text-center outline-none print:bg-white print:border-slate-300 print:text-slate-800"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* [기타 정보] 섹션 */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-2 border-l-2 border-slate-500 print:text-slate-800 print:border-slate-400">
                    [기타 정보]
                  </h4>
                  <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-5 print:bg-white print:border-slate-300">
                    <div className="grid grid-cols-1 gap-4 text-xs">
                      <div>
                        <label className="block text-slate-400 mb-1.5 print:text-slate-600">작업 특이사항 및 조치 비고</label>
                        <textarea
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          placeholder="고장 증상, 원인 분석 및 대책 조치 비고 등을 상세 기술합니다."
                          rows={2}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none resize-none print:bg-white print:border-slate-300 print:text-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Items checklist (Work Order Items) */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider border-l-2 border-blue-500 pl-2 print:text-slate-850 print:border-slate-400">
                    작업 세부 항목 / 절차 리스트
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="bg-slate-850 hover:bg-slate-800 border border-slate-800 text-blue-400 rounded-lg px-2.5 py-1 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer print:hidden"
                  >
                    <Plus size={12} />
                    <span>작업 항목 추가</span>
                  </button>
                </div>
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/20 print:border-slate-300 print:rounded-none">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 select-none print:bg-slate-100 print:text-slate-800 print:border-slate-300">
                        <th className="p-3 font-semibold w-12 text-center">순번</th>
                        <th className="p-3 font-semibold w-2/5">작업/점검 내용 <span className="text-rose-500 print:hidden">*</span></th>
                        <th className="p-3 font-semibold w-2/5">작업 방법/표준</th>
                        <th className="p-3 font-semibold">작업 결과 (실적 조치)</th>
                        <th className="p-3 font-semibold w-16 text-center print:hidden">삭제</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workItems.length === 0 ? (
                        <tr><td colSpan={5} className="p-8 text-center text-slate-600 print:text-slate-400">작업 세부 항목이 없습니다. 우측 상단의 [작업 항목 추가] 버튼을 클릭하세요.</td></tr>
                      ) : (
                        workItems.map((item, idx) => (
                          <tr key={idx} className="border-b border-slate-900 hover:bg-slate-900/30 text-slate-300 print:border-slate-200 print:text-slate-800 print:hover:bg-transparent">
                            <td className="p-3 text-center text-slate-500 font-semibold">{item.itemNo}</td>
                            <td className="p-2">
                              <input
                                type="text"
                                required
                                placeholder="예: 구품 메카니컬 씰 철거"
                                value={item.workName}
                                onChange={(e) => handleItemChange(idx, 'workName', e.target.value)}
                                className="w-full bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-lg py-1.5 px-2.5 text-xs text-slate-200 outline-none print:border-slate-200 print:bg-white print:text-slate-800"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                placeholder="예: 샤프트 흠집 주의 및 이물질 청소"
                                value={item.workMethod || ''}
                                onChange={(e) => handleItemChange(idx, 'workMethod', e.target.value)}
                                className="w-full bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-lg py-1.5 px-2.5 text-xs text-slate-300 outline-none print:border-slate-200 print:bg-white print:text-slate-850"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                placeholder="예: 이상 무 / 청소 및 조치 완료"
                                value={item.workResult || ''}
                                onChange={(e) => handleItemChange(idx, 'workResult', e.target.value)}
                                className="w-full bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-lg py-1.5 px-2.5 text-xs text-slate-300 outline-none print:border-slate-200 print:bg-white print:text-slate-855"
                              />
                            </td>
                            <td className="p-2 text-center print:hidden">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="p-1 hover:bg-slate-850 rounded text-slate-500 hover:text-rose-400 transition-colors border-0 cursor-pointer bg-transparent"
                              >
                                <Trash size={14} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
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
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg py-2 px-5 text-xs font-semibold transition-all cursor-pointer border-0 disabled:opacity-50 shadow-md shadow-emerald-950/20"
                  >
                    직접 확정 (Save)
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
          fetchData();
        }}
      />
    </div>
  );
}
