import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { toast } from 'sonner';
import { requestConfirmation } from '../utils/userActionDialog';
import axiosInstance from '../api/axios';
import { useAuthStore } from '../store/useAuthStore';
import { getCommonStatusLabel as getStatusLabel, getCommonStatusClass as getStatusClass } from '../constants/status';
import { formatDateOnly, todayLocal } from '../utils/datetime';
import { getApiErrorMessage } from '../utils/apiError';
import PrintHeader from '../components/PrintHeader';
import WorkOrderPrint from '../components/WorkOrderPrint';
import PrintWindowLayout from '../components/PrintWindowLayout';
import { openPrintWindow } from '../utils/printWindow';
import ApprovalSubmitModal from '../components/ApprovalSubmitModal';
import { 
  ClipboardList, Edit2, Trash2, Printer, X, Plus, Trash 
} from 'lucide-react';

interface WorkOrderModel {
  id: string;
  plantId: string;
  equipmentId: string;
  title: string;
  stepStage: string; // P: 계획, R: 실적
  woTypeCode: string;
  departmentId: string;
  workerId: string | null;
  workDate: string | null;
  cost: number;
  manHours: number;
  manHoursUnit: string;
  remarks: string | null;
  fileGroupId: number | null;
  refNo: string | null;
  refModule: string | null;
  approvalId: string | null;
  status: string; // T, S, P, C, R, X
  createdAt?: string | null;
  createdBy?: string | null;
}

interface WorkOrderItemModel {
  itemNo: number;
  workName: string;
  workMethod: string | null;
  workResult: string | null;
}

export default function WorkOrder() {
  const user = useAuthStore((s) => s.user);
  const [activeSubTab, setActiveSubTab] = useState<'plan' | 'history'>('plan');
  const [searchType, setSearchType] = useState<'id' | 'title' | 'worker'>('id');
  const [searchValue, setSearchValue] = useState('');

  const [workOrders, setWorkOrders] = useState<WorkOrderModel[]>([]);
  const [equipments, setEquipments] = useState<{ id: string; name: string; plantId: string }[]>([]);
  const [depts, setDepts] = useState<{ id: string; name: string }[]>([]);
  const [usersList, setUsersList] = useState<{ id: string; name: string }[]>([]);

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
  const [approvalRef, setApprovalRef] = useState<{ refNo: string; title: string } | null>(null);

  const canDirectConfirm = user?.permissions?.WO?.A === 'Y';

  const fetchData = async () => {
    try {
      const params = new URLSearchParams();
      if (searchValue) {
        params.set('searchType', searchType);
        params.set('searchValue', searchValue);
      }
      const [woRes, eqRes, deptRes, userRes] = await Promise.all([
        axiosInstance.get(`/work-order?${params.toString()}`),
        axiosInstance.get('/master/equipments'),
        axiosInstance.get('/mdm/departments'),
        axiosInstance.get('/mdm/users')
      ]);
      setWorkOrders((woRes.data || []).map((workOrder: WorkOrderModel) => ({
        ...workOrder,
        workDate: formatDateOnly(workOrder.workDate) || null,
      })));
      setEquipments(eqRes.data);
      setDepts(deptRes.data);
      setUsersList(userRes.data);
    } catch (err) {
      toast.error(getApiErrorMessage(err, '목록을 불러오지 못했습니다.'));
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleOpenCreate = () => {
    setWoNo('');
    setPlantId(equipments.length > 0 ? equipments[0].plantId : '');
    setEquipmentId(equipments.length > 0 ? equipments[0].id : '');
    setEquipmentName(equipments.length > 0 ? equipments[0].name : '');
    setTitle('');
    setStepStage('P');
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
      const res = await axiosInstance.get(`/work-order/details?plantId=${wo.plantId}&id=${wo.id}`);
      const data = res.data;
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
      setApprovalId(w.approvalId || '');
      setCreatedAt(w.createdAt || '');
      setCreatedBy(w.createdBy || '');
      setWorkItems(data.workItems || []);
      
      setIsFormOpen(true);
    } catch (err) {
      toast.error(getApiErrorMessage(err, '작업지시 상세 기록을 불러오지 못했습니다.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (wo: WorkOrderModel) => {
    if (!(await requestConfirmation('정말 이 작업지시를 삭제하시겠습니까?'))) return;
    try {
      await axiosInstance.delete(`/work-order?plantId=${wo.plantId}&id=${wo.id}`);
      toast.success('작업지시가 삭제되었습니다.');
      fetchData();
    } catch (err) {
      toast.error(getApiErrorMessage(err, '삭제 실패.'));
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
      toast.error('지시명(제목)을 입력해주세요.');
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

      const response = await axiosInstance.post('/work-order', payload);
      if (submitStatus === 'P') {
        const savedId = response.data.id;
        setWoNo(savedId);
        setApprovalRef({ refNo: savedId, title: `[작업지시] ${title}` });
        return;
      }
      toast.success(submitStatus === 'T' ? '임시저장 되었습니다.' : '작업지시가 직접 확정 완료되었습니다.');
      setIsFormOpen(false);
      fetchData();
    } catch (err) {
      toast.error(getApiErrorMessage(err, '저장 중 오류가 발생했습니다.'));
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

  const openPrintDocument = async (wo: WorkOrderModel) => {
    const printTarget = openPrintWindow({ title: '작업지시서 출력', rootId: 'wo-print-root' });
    if (!printTarget) {
      toast.error('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.');
      return;
    }
    const { printWindow, container } = printTarget;
    try {
      const response = await axiosInstance.get(`/work-order/details?plantId=${wo.plantId}&id=${wo.id}`);
      const detail = { ...wo, ...response.data.workOrder } as WorkOrderModel;
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
            workItems={response.data.workItems || []}
          />
        </PrintWindowLayout>,
      );
      printWindow.focus();
    } catch (err) {
      printWindow.close();
      toast.error(getApiErrorMessage(err, '출력 문서를 불러오지 못했습니다.'));
    }
  };

  const handlePrint = () => {
    if (workOrders.length === 0) { toast.error('인쇄할 목록이 없습니다.'); return; }
    const user = useAuthStore.getState().user;
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) { toast.error('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.'); return; }

    const rows = workOrders.map(wo => `
      <tr>
        <td class="mono">${wo.id}</td>
        <td>${wo.title}</td>
        <td>${wo.equipmentId}</td>
        <td>${wo.stepStage === 'P' ? '계획' : '실적'}</td>
        <td>${getWoTypeLabel(wo.woTypeCode)}</td>
        <td>${depts.find(d => d.id === wo.departmentId)?.name || wo.departmentId}</td>
        <td>${usersList.find(u => u.id === wo.workerId)?.name || wo.workerId || '-'}</td>
        <td>${wo.workDate || '-'}</td>
        <td>${getStatusLabel(wo.status)}</td>
      </tr>
    `).join('');

    printWindow.document.title = '작업지시 목록 - 인쇄';
    printWindow.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>작업지시 목록 - 인쇄</title>
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
<h1>작업지시 현황</h1>
<div class="print-info"><span>회사: ${user?.companyName || user?.companyId || 'CMMS'}</span><span>출력자: ${user?.name || '-'} | 출력일시: ${stamp}</span></div>
<table><thead><tr>
<th>지시번호</th><th>지시명</th><th>설비</th><th>단계</th><th>구분</th><th>부서</th><th>작업자</th><th>작업일</th><th>상태</th>
</tr></thead><tbody>${rows}</tbody></table>
</body></html>`);
    printWindow.document.close();
    printWindow.focus();
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

          <button
            onClick={handleOpenCreate}
            className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 transition-colors border-0 cursor-pointer shadow-lg shadow-blue-900/20"
          >
            <Plus size={14} />
            입력
          </button>

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
            <option value="title">타이틀</option>
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
                <th className="p-3 font-semibold">설비코드</th>
                <th className="p-3 font-semibold">구분</th>
                <th className="p-3 font-semibold">부서</th>
                <th className="p-3 font-semibold">작업자</th>
                <th className="p-3 font-semibold">계획/수행일자</th>
                <th className="p-3 font-semibold">공수(M/H)</th>
                <th className="p-3 font-semibold">연계결재번호</th>
                <th className="p-3 font-semibold">문서상태</th>
                <th className="p-3 font-semibold text-right print:hidden">작업</th>
              </tr>
            </thead>
            <tbody>
              {(activeSubTab === 'plan' ? plans : history).length === 0 ? (
                <tr><td colSpan={11} className="p-8 text-center text-slate-600 print:text-slate-400">조회된 작업지시 내역이 없습니다.</td></tr>
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
                    <td className="p-3 font-mono text-slate-400">{wo.equipmentId}</td>
                    <td className="p-3">{getWoTypeLabel(wo.woTypeCode)}</td>
                    <td className="p-3">{depts.find(d => d.id === wo.departmentId)?.name || wo.departmentId}</td>
                    <td className="p-3">{usersList.find(u => u.id === wo.workerId)?.name || wo.workerId || '-'}</td>
                    <td className="p-3">{wo.workDate || '-'}</td>
                    <td className="p-3 font-mono">{wo.manHours} {wo.manHoursUnit}</td>
                    <td className="p-3 font-mono text-slate-500">{wo.approvalId || '-'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${getStatusClass(wo.status)}`}>
                        {getStatusLabel(wo.status)}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-2 print:hidden">
                      <button
                        onClick={() => handleOpenEdit(wo)}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-blue-400 transition-colors border-0 cursor-pointer bg-transparent"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(wo)}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-rose-400 transition-colors border-0 cursor-pointer bg-transparent"
                      >
                        <Trash2 size={13} />
                      </button>
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
                {woNo ? `작업지시 상세/수정 [${woNo}] ${equipmentName}` : `신규 작업지시 등록`}
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
                        <label className="block text-slate-400 mb-1.5 print:text-slate-600 font-semibold">지시명 (제목) <span className="text-rose-500 print:hidden">*</span></label>
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
                      <div>
                        <label className="block text-slate-400 mb-1.5 print:text-slate-600">작업 단계</label>
                        <select
                          value={stepStage}
                          onChange={(e) => setStepStage(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-300 outline-none print:bg-white print:border-slate-300 print:text-slate-800"
                        >
                          <option value="P">작업 계획/지시 (P)</option>
                          <option value="R">작업 실적/완료 (R)</option>
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
                        <label className="block text-slate-400 mb-1.5 print:text-slate-600 font-semibold">소요 공수시간(M/H)</label>
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
                <button
                  onClick={() => handleSave('T')}
                  disabled={isLoading}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-750 rounded-lg py-2 px-4 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                >
                  임시 저장
                </button>
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
      <ApprovalSubmitModal
        open={!!approvalRef}
        refModule="WO"
        refNo={approvalRef?.refNo || ''}
        defaultTitle={approvalRef?.title || ''}
        users={usersList}
        currentUserId={user?.id}
        onClose={() => setApprovalRef(null)}
        onSubmitted={(newApprovalId) => {
          setApprovalId(newApprovalId);
          setApprovalRef(null);
          setIsFormOpen(false);
          toast.success('작업지시 결재 문서가 상신되었습니다.');
          fetchData();
        }}
      />
    </div>
  );
}
