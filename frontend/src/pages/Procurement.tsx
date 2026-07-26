import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { toast } from 'sonner';
import { requestConfirmation } from '../utils/userActionDialog';
import axiosInstance from '../api/axios';
import ProcurementRequestPrint from '../components/ProcurementRequestPrint';
import PurchaseOrderPrint from '../components/PurchaseOrderPrint';
import { useAuthStore } from '../store/useAuthStore';
import { ShoppingCart, Plus, PackageCheck, X, Trash2, Printer, Truck, PackagePlus, CircleStop, Pencil } from 'lucide-react';
import {
  getCommonStatusLabel,
  getProcStatusLabel,
} from '../constants/status';
import { formatDateOnly, todayLocal } from '../utils/datetime';
import ListBadge from '../components/ListBadge';
import ListIconButton from '../components/ListIconButton';
import ApprovalDraftModal from '../components/ApprovalDraftModal';
import { loadApprovalSignatureSteps } from '../utils/approvalSignature';
import PrintWindowLayout from '../components/PrintWindowLayout';
import { openPrintWindow } from '../utils/printWindow';
import { createProcurementApprovalContent } from '../utils/procurementApprovalContent';

interface Vendor { id: string; name: string; bizNo?: string; contact?: string; manager?: string; remarks?: string; deleteYn?: string }
interface Warehouse { id: string; name: string; plantId?: string | null }
interface Plant { id: string; name: string }
interface CodeItem { id: string; name: string; sortOrder?: number }
interface InventoryRef { id: string; name: string; unit?: string }
interface PurchaseRequest {
  id: string; plantId: string; warehouseId: string; requesterId: string; requestDate: string;
  requestType?: string; vendorId?: string | null; orderDate?: string | null; etaDate?: string | null;
  shipStartDate?: string | null; status: string; procStatus?: string | null; remarks?: string;
  title?: string; approvalId?: string | null; createdAt?: string | null;
  purchaseManager?: string | null; purchaseManagerContact?: string | null;
}
interface ItemLine { lineNo?: number; inventoryId: string; qty: number; unit?: string; remarks?: string }
interface ReceiveLine { lineNo: number; qty: number; unitPrice?: number | null }


export default function Procurement({ mode = 'request' }: { mode?: 'request' | 'management' }) {
  const user = useAuthStore((s) => s.user);
  const activePlantId = useAuthStore((s) => s.activePlantId);
  const [tab, setTab] = useState<'requests' | 'vendors'>('requests');

  // ============ 공통 데이터 ============
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [prTypes, setPrTypes] = useState<CodeItem[]>([]);
  const [inventories, setInventories] = useState<InventoryRef[]>([]);
  const [usersList, setUsersList] = useState<{
    id: string;
    name: string;
    title?: string | null;
    position?: string | null;
    departmentId?: string | null;
    departmentName?: string | null;
  }[]>([]);

  const loadRefs = async () => {
    const load = async <T,>(
      path: string,
      setter: (items: T[]) => void,
      label: string,
    ) => {
      try {
        const response = await axiosInstance.get(path);
        setter(response.data || []);
      } catch (error: any) {
        console.error(`${label} 조회 실패`, error);
        toast.error(error.response?.data?.message || `${label}을 불러오지 못했습니다.`);
        setter([]);
      }
    };
    await Promise.all([
      load<Vendor>('/procurement/vendors', setVendors, '공급업체'),
      load<Warehouse>('/mdm/refs/warehouses', setWarehouses, '창고'),
      load<Plant>('/mdm/refs/plants', setPlants, '플랜트'),
      load<CodeItem>('/mdm/codes/items/PR_TYPE', setPrTypes, '구매요청 유형'),
      load<InventoryRef>('/master/refs/inventories', setInventories, '자재'),
      load<{
        id: string; name: string; title?: string | null; position?: string | null;
        departmentId?: string | null; departmentName?: string | null;
      }>('/mdm/refs/users', setUsersList, '사용자'),
    ]);
  };
  useEffect(() => { loadRefs(); }, []);

  // ============ 구매요청 ============
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [searchType, setSearchType] = useState<'id' | 'title' | 'owner'>('id');
  const [searchValue, setSearchValue] = useState('');
  const filteredRequests = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase();
    if (!keyword) return requests;
    return requests.filter((request) => {
      if (searchType === 'id') return request.id.toLowerCase().includes(keyword);
      if (searchType === 'title') {
        return (request.title || '').toLowerCase().includes(keyword);
      }
      const requester = usersList.find((candidate) => candidate.id === request.requesterId);
      return `${request.requesterId} ${requester?.name || ''}`.toLowerCase().includes(keyword);
    });
  }, [prTypes, requests, searchType, searchValue, usersList]);
  const loadRequests = async () => {
    try {
      const res = await axiosInstance.get(
        mode === 'management' ? '/procurement/management/requests' : '/procurement/requests',
      );
      setRequests((res.data || []).map((request: PurchaseRequest) => ({
        ...request,
        requestDate: formatDateOnly(request.requestDate),
        orderDate: formatDateOnly(request.orderDate) || null,
        etaDate: formatDateOnly(request.etaDate) || null,
        shipStartDate: formatDateOnly(request.shipStartDate) || null,
      })));
    } catch (e) { console.error(e); }
  };
  useEffect(() => { if (tab === 'requests') loadRequests(); }, [tab, mode]);

  // 신규/수정 모달
  const [formOpen, setFormOpen] = useState(false);
  const [formHeader, setFormHeader] = useState<Partial<PurchaseRequest>>({ requestDate: todayLocal() });
  const [formItems, setFormItems] = useState<ItemLine[]>([{ inventoryId: '', qty: 0, unit: '' }]);
  const [approvalRef, setApprovalRef] = useState<PurchaseRequest | null>(null);

  const openNewForm = () => {
    setFormHeader({
      requestDate: todayLocal(),
      plantId: activePlantId || user?.lastLoginPlantId || '',
    });
    setFormItems([{ inventoryId: '', qty: 0, unit: '' }]);
    setFormOpen(true);
  };

  const openEditForm = async (request: PurchaseRequest) => {
    try {
      const response = await axiosInstance.get(
        mode === 'management'
          ? `/procurement/management/requests/${request.id}`
          : `/procurement/requests/${request.id}`,
      );
      setFormHeader({
        ...response.data.header,
        requestDate: formatDateOnly(response.data.header.requestDate),
      });
      setFormItems((response.data.items || []).map((item: any) => ({
        ...item,
        qty: Number(item.qty),
      })));
      setFormOpen(true);
    } catch (error: any) {
      toast.error(error.response?.data?.message || '구매요청을 불러오지 못했습니다.');
    }
  };

  const submitForm = async (action: 'T' | 'P' | 'S') => {
    if (!formHeader.title?.trim()) { toast.error('제목을 입력하세요.'); return; }
    if (!formHeader.warehouseId) { toast.error('예정 창고를 선택하세요.'); return; }
    if (formItems.length === 0 || !formItems[0].inventoryId) { toast.error('자재 라인을 1개 이상 입력하세요.'); return; }
    if (action === 'S' && !(await requestConfirmation('이 구매요청을 직접확정하시겠습니까?'))) return;
    try {
      const response = await axiosInstance.post('/procurement/requests', {
        header: { ...formHeader, status: 'T' },
        items: formItems,
      });
      const saved = response.data as PurchaseRequest;
      setFormHeader(saved);
      if (action === 'P') {
        setApprovalRef(saved);
        return;
      }
      if (action === 'S') {
        await axiosInstance.post(`/procurement/requests/${saved.id}/confirm`);
        toast.success('구매요청이 직접확정되었습니다.');
      } else {
        toast.success('구매요청이 임시저장되었습니다.');
      }
      setFormOpen(false);
      await loadRequests();
    } catch (e: any) {
      toast.error(e.response?.data?.message || '구매요청 처리에 실패했습니다.');
    }
  };

  // 발주 / 배송 / 입고 / 종료 액션
  // 발주 모달
  const [orderModal, setOrderModal] = useState<{
    id: string;
    vendorId: string;
    purchaseManager: string;
    purchaseManagerContact: string;
    orderDate: string;
    etaDate: string;
  } | null>(null);
  const submitOrder = async () => {
    if (!orderModal) return;
    if (!orderModal.vendorId.trim()) { toast.error('벤더를 입력하세요.'); return; }
    if (!orderModal.purchaseManager.trim()) { toast.error('구매담당자를 입력하세요.'); return; }
    try {
      await axiosInstance.post('/procurement/orders', {
        requestId: orderModal.id,
        vendorId: orderModal.vendorId,
        purchaseManager: orderModal.purchaseManager,
        purchaseManagerContact: orderModal.purchaseManagerContact,
        orderDate: orderModal.orderDate,
        etaDate: orderModal.etaDate,
      });
      setOrderModal(null);
      await loadRequests();
    } catch (e: any) { toast.error(e.response?.data?.message || '발주 실패'); }
  };

  // 배송 시작 모달
  const [shipModal, setShipModal] = useState<{ id: string; shipStartDate: string } | null>(null);
  const submitShip = async () => {
    if (!shipModal) return;
    try {
      await axiosInstance.post('/procurement/shipments', { requestId: shipModal.id, shipStartDate: shipModal.shipStartDate });
      setShipModal(null);
      await loadRequests();
    } catch (e: any) { toast.error(e.response?.data?.message || '배송 실패'); }
  };

  // 입고 모달
  const [receiveModal, setReceiveModal] = useState<{
    pr: PurchaseRequest; lines: any[]; close: boolean; txDate: string; warehouseId: string;
  } | null>(null);
  const openReceiveModal = async (pr: PurchaseRequest) => {
    try {
      const detail = await axiosInstance.get(
        mode === 'management'
          ? `/procurement/management/requests/${pr.id}`
          : `/procurement/requests/${pr.id}`,
      );
      const items: ItemLine[] = detail.data?.items || [];
      // 잔여 계산: detail.items[].qty - 누적 receivedQty (BE에서 항목별로 받아야 하나 여기선 데모용으로 단순화)
      const lines = items.map((it: any) => ({
        lineNo: it.lineNo,
        inventoryId: it.inventoryId,
        qty: it.qty,
        unit: it.unit,
        receivedQty: it.receivedQty ?? 0,
        remaining: Math.max(0, Number(it.qty) - Number(it.receivedQty ?? 0)),
        inputQty: Math.max(0, Number(it.qty) - Number(it.receivedQty ?? 0)),  // 프리필=잔여
        unitPrice: '',
      }));
      setReceiveModal({
        pr, lines, close: false, txDate: todayLocal(), warehouseId: pr.warehouseId,
      });
    } catch (e: any) { toast.error(e.response?.data?.message || '상세 조회 실패'); }
  };
  const submitReceive = async () => {
    if (!receiveModal) return;
    const lines: ReceiveLine[] = receiveModal.lines
      .filter((l: any) => Number(l.inputQty) > 0)
      .map((l: any) => ({ lineNo: l.lineNo, qty: Number(l.inputQty), unitPrice: l.unitPrice ? Number(l.unitPrice) : 0 }));
    if (lines.length === 0) { toast.error('입고 수량을 1개 이상 입력하세요.'); return; }
    if (
      mode === 'management'
      && !(await requestConfirmation(
        `총괄 관리자 권한으로 요청부서·창고담당자를 대신해 입고 처리합니다.${
          receiveModal.close ? '\n입고 후 구매요청도 함께 종료됩니다.' : ''
        }\n입고 수량과 창고를 확인한 후 진행하세요.`,
        '입고 처리',
      ))
    ) return;
    try {
      await axiosInstance.post('/procurement/receipts', {
        requestId: receiveModal.pr.id,
        warehouseId: receiveModal.warehouseId,
        txDate: receiveModal.txDate,
        close: receiveModal.close,
        lines,
      });
      setReceiveModal(null);
      await loadRequests();
    } catch (e: any) { toast.error(e.response?.data?.message || '입고 실패'); }
  };

  const closeRequest = async (id: string) => {
    const message = mode === 'management'
      ? '총괄 관리자 권한으로 요청부서·창고담당자를 대신해 구매요청을 종료합니다.\n미입고 잔여 수량은 더 이상 입고할 수 없습니다.\n정말 종료하시겠습니까?'
      : '이 요청을 종료(E)하시겠습니까? (미입고 잔여는 닫힙니다)';
    if (!(await requestConfirmation(message, '종료 처리'))) return;
    try { await axiosInstance.post(`/procurement/requests/${id}/close`); await loadRequests(); }
    catch (e: any) { toast.error(e.response?.data?.message || '종료 실패'); }
  };

  const deleteRequest = async (id: string) => {
    if (!(await requestConfirmation('이 저장중인 요청을 삭제하시겠습니까?'))) return;
    try { await axiosInstance.delete(`/procurement/requests/${id}`); await loadRequests(); }
    catch (e: any) { toast.error(e.response?.data?.message || '삭제 실패'); }
  };

  // 목록 인쇄
  const handlePrint = () => {
    const list = tab === 'requests' ? filteredRequests : vendors;
    if (list.length === 0) { toast.error('인쇄할 목록이 없습니다.'); return; }
    const user = useAuthStore.getState().user;
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) { toast.error('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.'); return; }

    const tabLabel = tab === 'requests' ? '구매요청' : '벤더';
    const rows = tab === 'requests'
      ? (list as PurchaseRequest[]).map(pr => `
          <tr>
            <td class="mono">${pr.id}</td>
            <td>${pr.requestDate || '-'}</td>
            <td>${pr.plantId || '-'} / ${pr.warehouseId || '-'}</td>
            <td>${prTypes.find((type) => type.id === pr.requestType)?.name || pr.requestType || '-'}</td>
            <td>${pr.status === 'T' ? '저장' : pr.status === 'C' ? '확정' : pr.status === 'O' ? '발주' : pr.status === 'S' ? '배송' : pr.status}</td>
            <td>${pr.approvalId || '-'}</td>
          </tr>
        `).join('')
      : (list as Vendor[]).map(v => `
          <tr>
            <td class="mono">${v.id}</td>
            <td>${v.name}</td>
            <td>${v.bizNo || '-'}</td>
            <td>${v.contact || '-'}</td>
            <td>${v.manager || '-'}</td>
          </tr>
        `).join('');

    const thCells = tab === 'requests'
      ? '<th>요청번호</th><th>요청일</th><th>플랜트/창고</th><th>유형</th><th>구매상태</th><th>결재번호</th>'
      : '<th>코드</th><th>이름</th><th>사업자번호</th><th>연락처</th><th>담당자</th>';

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
<div class="print-info"><span>회사: ${user?.companyName || user?.companyId || 'CMMS'}</span><span>출력자: ${user?.name || '-'} | 출력일시: ${stamp}</span></div>
<h1>${tabLabel} 현황</h1>
<table><thead><tr>${thCells}</tr></thead><tbody>${rows}</tbody></table>
</body></html>`);
    printWindow.document.close();
    printWindow.focus();
  };

  // 인쇄(구매요청: 구매요청서 / 구매관리: 발주서)
  const openPrint = async (id: string) => {
    const printTarget = openPrintWindow({
      title: mode === 'management' ? '발주서 출력' : '구매요청서 출력',
      rootId: mode === 'management' ? 'purchase-order-print-root' : 'procurement-request-print-root',
    });
    if (!printTarget) {
      toast.error('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.');
      return;
    }
    const { printWindow, container } = printTarget;
    try {
      const detail = await axiosInstance.get(
        mode === 'management'
          ? `/procurement/management/requests/${id}`
          : `/procurement/requests/${id}`,
      );
      const header = detail.data.header as PurchaseRequest;
      const requester = usersList.find((candidate) => candidate.id === header.requesterId);
      createRoot(container).render(
        <PrintWindowLayout printWindow={printWindow} contentClassName="max-w-[180mm]">
          {mode === 'management' ? (() => {
            const vendor = vendors.find(
              (candidate) => candidate.id === header.vendorId || candidate.name === header.vendorId,
            );
            const plant = plants.find((candidate) => candidate.id === header.plantId);
            const warehouse = warehouses.find((candidate) => candidate.id === header.warehouseId);
            return (
              <PurchaseOrderPrint
                id={header.id}
                title={header.title}
                orderDate={formatDateOnly(header.orderDate)}
                etaDate={formatDateOnly(header.etaDate)}
                shipStartDate={formatDateOnly(header.shipStartDate)}
                plantName={plant ? `${plant.id} / ${plant.name}` : header.plantId}
                warehouseName={warehouse ? `${warehouse.id} / ${warehouse.name}` : header.warehouseId}
                vendorId={header.vendorId}
                vendorName={vendor?.name}
                vendorBizNo={vendor?.bizNo}
                vendorContact={vendor?.contact}
                vendorManager={vendor?.manager}
                purchaseManager={header.purchaseManager || '-'}
                purchaseManagerContact={header.purchaseManagerContact}
                remarks={header.remarks}
                items={(detail.data.items || []).map((item: ItemLine) => ({
                  ...item,
                  inventoryName: inventories.find((candidate) => candidate.id === item.inventoryId)?.name,
                }))}
              />
            );
          })() : (
            <ProcurementRequestPrint
              id={header.id}
              requestDate={formatDateOnly(header.requestDate)}
              requesterId={header.requesterId}
              requestType={prTypes.find((type) => type.id === header.requestType)?.name || header.requestType}
              plantId={header.plantId}
              warehouseId={header.warehouseId}
              title={header.title}
              remarks={header.remarks}
              departmentName={requester?.departmentName || requester?.departmentId}
              authorName={requester?.name || header.requesterId}
              approvalId={header.approvalId}
              approvalSteps={await loadApprovalSignatureSteps(header.approvalId, usersList)}
              items={detail.data.items || []}
            />
          )}
        </PrintWindowLayout>,
      );
      printWindow.focus();
    } catch (e: any) {
      printWindow.close();
      toast.error(e.response?.data?.message || '인쇄 실패');
    }
  };

  const filteredWarehouses = useMemo(() => {
    if (!formHeader.plantId) return warehouses;
    return warehouses.filter(w => w.plantId === formHeader.plantId);
  }, [warehouses, formHeader.plantId]);
  const currentUserRef = usersList.find((candidate) => candidate.id === user?.id);
  const approvalContent = useMemo(() => {
    if (!approvalRef) return undefined;
    const requester = usersList.find((candidate) => candidate.id === approvalRef.requesterId)
      || currentUserRef;
    const plant = plants.find((candidate) => candidate.id === approvalRef.plantId);
    const warehouse = warehouses.find((candidate) => candidate.id === approvalRef.warehouseId);
    const requestType = prTypes.find((candidate) => candidate.id === approvalRef.requestType);

    return createProcurementApprovalContent({
      requestNo: approvalRef.id,
      createdAt: formatDateOnly(approvalRef.createdAt),
      departmentName: `${requester?.departmentId || '-'} / ${requester?.departmentName || '-'}`,
      authorName: `${approvalRef.requesterId || user?.id || '-'} / ${requester?.name || user?.name || '-'}`,
      requestDate: formatDateOnly(approvalRef.requestDate),
      requestTypeName: requestType
        ? `${requestType.id} / ${requestType.name}`
        : approvalRef.requestType || '-',
      plantName: plant ? `${plant.id} / ${plant.name}` : approvalRef.plantId || '-',
      warehouseName: warehouse
        ? `${warehouse.id} / ${warehouse.name}`
        : approvalRef.warehouseId || '-',
      remarks: approvalRef.remarks,
      items: formItems.map((item) => {
        const inventory = inventories.find((candidate) => candidate.id === item.inventoryId);
        return {
          inventoryId: item.inventoryId,
          inventoryName: inventory?.name || '-',
          qty: item.qty,
          unit: item.unit,
          remarks: item.remarks,
        };
      }),
    });
  }, [
    approvalRef,
    currentUserRef,
    formItems,
    inventories,
    plants,
    prTypes,
    user,
    usersList,
    warehouses,
  ]);
  const canDirectConfirm = user?.permissions?.PUR?.A === 'Y';
  const canReceive = user?.permissions?.STK?.C === 'Y';
  const formEditable = !formHeader.id || ['T', 'R'].includes(formHeader.status || '');

  // ============ 벤더 관리 ============
  const [vendorForm, setVendorForm] = useState<{ id: string; name: string; bizNo: string; contact: string; manager: string; remarks: string; editing?: boolean } | null>(null);
  const submitVendor = async () => {
    if (!vendorForm) return;
    if (!vendorForm.id || !vendorForm.name) { toast.error('아이디·이름은 필수입니다.'); return; }
    try {
      if (vendorForm.editing) {
        await axiosInstance.put(`/procurement/vendors/${vendorForm.id}`, vendorForm);
      } else {
        await axiosInstance.post('/procurement/vendors', vendorForm);
      }
      setVendorForm(null);
      await loadRefs();
    } catch (e: any) { toast.error(e.response?.data?.message || '저장 실패'); }
  };
  const deleteVendor = async (id: string) => {
    if (!(await requestConfirmation('이 벤더를 삭제하시겠습니까?'))) return;
    try { await axiosInstance.delete(`/procurement/vendors/${id}`); await loadRefs(); }
    catch (e: any) { toast.error(e.response?.data?.message || '삭제 실패'); }
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <ShoppingCart size={24} className="text-blue-500" />
            {mode === 'management' ? '구매관리' : '구매요청'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {mode === 'management'
              ? '확정된 구매요청의 발주·배송·종료 상태와 공급업체를 관리합니다.'
              : '필요한 자재를 요청하고 결재상태와 구매 진행현황을 확인합니다.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handlePrint} className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
            <Printer size={14} /> 목록 인쇄
          </button>
          {(mode === 'request' || tab === 'vendors') && (
            <button onClick={tab === 'requests' ? openNewForm : () => setVendorForm({ id: '', name: '', bizNo: '', contact: '', manager: '', remarks: '' })} className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 cursor-pointer border-0">
              <Plus size={14} /> 입력
            </button>
          )}
          {mode === 'management' && <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-lg">
            <button onClick={() => setTab('requests')} className={`px-4 py-1.5 rounded-md text-xs font-semibold cursor-pointer border-0 ${tab === 'requests' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 bg-transparent'}`}>
              구매요청
            </button>
            <button onClick={() => setTab('vendors')} className={`px-4 py-1.5 rounded-md text-xs font-semibold cursor-pointer border-0 ${tab === 'vendors' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 bg-transparent'}`}>
              벤더 관리
            </button>
          </div>}
        </div>
      </div>

      {tab === 'requests' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-sm font-bold text-slate-200 mb-4 print:hidden">
            {mode === 'management' ? '구매관리 목록' : '구매요청 목록'}
          </h2>
          <div className="mb-4 flex gap-2 print:hidden">
            <select value={searchType} onChange={(event) => setSearchType(event.target.value as typeof searchType)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 outline-none">
              <option value="id">문서번호</option>
              <option value="title">제목</option>
              <option value="owner">담당자</option>
            </select>
            <input value={searchValue} onChange={(event) => setSearchValue(event.target.value)} placeholder="검색어를 입력하세요" className="flex-1 min-w-[200px] bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 outline-none" />
          </div>
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 select-none">
                <th className="p-3 font-semibold">요청번호</th>
                <th className="p-3 font-semibold">요청일</th>
                <th className="p-3 font-semibold">제목</th>
                <th className="p-3 font-semibold">플랜트/창고</th>
                <th className="p-3 font-semibold">유형</th>
                <th className="p-3 font-semibold">결재상태</th>
                <th className="p-3 font-semibold">구매상태</th>
                <th className="p-3 font-semibold">발주일 / 배송일</th>
                <th className="p-3 font-semibold text-right">작업</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.length === 0 && (
                <tr><td colSpan={9} className="p-8 text-center text-slate-600">구매요청이 없습니다.</td></tr>
              )}
              {filteredRequests.map(pr => (
                <tr key={pr.id} className="border-b border-slate-900 hover:bg-slate-900/30 text-slate-300">
                  <td className="p-3 font-mono">
                    <button
                      type="button"
                      onClick={() => openPrint(pr.id)}
                      className="bg-transparent border-0 p-0 text-blue-400 hover:text-blue-300 hover:underline font-mono cursor-pointer"
                      title={`${pr.id} 구매요청서 출력`}
                    >
                      {pr.id}
                    </button>
                  </td>
                  <td className="p-3 text-slate-300">{pr.requestDate}</td>
                  <td className="p-3 text-slate-200">{pr.title || '-'}</td>
                  <td className="p-3 text-slate-300">{pr.plantId} / {pr.warehouseId}</td>
                  <td className="p-3 text-slate-300">
                    {prTypes.find((type) => type.id === pr.requestType)?.name || pr.requestType || '-'}
                  </td>
                  <td className="p-3">
                    <ListBadge>
                      {getCommonStatusLabel(pr.status)} ({pr.status})
                    </ListBadge>
                  </td>
                  <td className="p-3">
                    <ListBadge>
                      {pr.procStatus ? `${getProcStatusLabel(pr.procStatus)} (${pr.procStatus})` : '발주대기'}
                    </ListBadge>
                  </td>
                  <td className="p-3 font-mono text-slate-400 whitespace-nowrap">
                    <span className="block">발주 {formatDateOnly(pr.orderDate) || '-'}</span>
                    <span className="block">배송 {formatDateOnly(pr.shipStartDate) || '-'}</span>
                  </td>
                  <td className="p-3 text-right space-x-1">
                    {mode === 'request' && ['T', 'R'].includes(pr.status) && (
                      <ListIconButton onClick={() => openEditForm(pr)} label="수정" icon={Pencil} />
                    )}
                    {mode === 'request' && pr.status === 'T' && (
                        <ListIconButton onClick={() => deleteRequest(pr.id)} label="삭제" icon={Trash2} tone="danger" />
                    )}
                    {mode === 'management' && ['S', 'C'].includes(pr.status) && !pr.procStatus && (
                      <ListIconButton onClick={() => setOrderModal({
                        id: pr.id,
                        vendorId: pr.vendorId || '',
                        purchaseManager: pr.purchaseManager || '',
                        purchaseManagerContact: pr.purchaseManagerContact || '',
                        orderDate: todayLocal(),
                        etaDate: '',
                      })} label="발주" icon={ShoppingCart} tone="warning" />
                    )}
                    {mode === 'management' && ['S', 'C'].includes(pr.status) && pr.procStatus === 'O' && (
                      <ListIconButton onClick={() => setShipModal({ id: pr.id, shipStartDate: todayLocal() })} label="배송 시작" icon={Truck} tone="warning" />
                    )}
                    {mode === 'management' && ['S', 'C'].includes(pr.status) && pr.procStatus !== 'E' && pr.procStatus && (
                      <>
                        {canReceive && <ListIconButton onClick={() => openReceiveModal(pr)} label="입고" icon={PackagePlus} tone="accent" />}
                        <ListIconButton onClick={() => closeRequest(pr.id)} label="종료" icon={CircleStop} />
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* 벤더 관리 탭 */}
      {tab === 'vendors' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-sm font-bold text-slate-200 mb-4">벤더 관리</h2>
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 select-none">
                <th className="p-3 font-semibold">코드</th>
                <th className="p-3 font-semibold">이름</th>
                <th className="p-3 font-semibold">사업자번호</th>
                <th className="p-3 font-semibold">연락처</th>
                <th className="p-3 font-semibold">담당자</th>
                <th className="p-3 font-semibold text-right">작업</th>
              </tr>
            </thead>
            <tbody>
              {vendors.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-600">벤더가 없습니다.</td></tr>}
              {vendors.map(v => (
                <tr key={v.id} className="border-b border-slate-900 hover:bg-slate-900/30 text-slate-300">
                  <td className="p-3 font-mono text-slate-200">{v.id}</td>
                  <td className="p-3 text-slate-300">{v.name}</td>
                  <td className="p-3 text-slate-300">{v.bizNo || '-'}</td>
                  <td className="p-3 text-slate-300">{v.contact || '-'}</td>
                  <td className="p-3 text-slate-300">{v.manager || '-'}</td>
                  <td className="p-3 text-right space-x-1">
                    <ListIconButton
                      onClick={() => setVendorForm({ id: v.id, name: v.name, bizNo: v.bizNo || '', contact: v.contact || '', manager: v.manager || '', remarks: v.remarks || '', editing: true })}
                      label={`${v.name} 수정`}
                      icon={Pencil}
                      tone="accent"
                    />
                    <ListIconButton onClick={() => deleteVendor(v.id)} label={`${v.name} 삭제`} icon={Trash2} tone="danger" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* 신규/수정 요청 모달 */}
      {formOpen && (
        <Modal title={formHeader.id ? `구매요청 상세/수정 [${formHeader.id}]` : '신규 구매요청 입력'} onClose={() => setFormOpen(false)}>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs mb-6">
            <div><span className="text-slate-500 block mb-0.5">문서번호</span><span className="font-mono font-semibold text-slate-300">{formHeader.id || '(저장 시 자동발행)'}</span></div>
            <div><span className="text-slate-500 block mb-0.5">작성일</span><span className="font-mono text-slate-300">{formatDateOnly(formHeader.createdAt) || (formHeader.id ? '-' : '저장 시 기록')}</span></div>
            <div><span className="text-slate-500 block mb-0.5">부서</span><span className="text-slate-300">{user?.departmentId || '-'} / {currentUserRef?.departmentName || '-'}</span></div>
            <div><span className="text-slate-500 block mb-0.5">작성자</span><span className="text-slate-300">{user?.id || '-'} / {user?.name || '-'}</span></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <Field label="제목" className="sm:col-span-2 lg:col-span-4"><input value={formHeader.title || ''} onChange={e => setFormHeader({ ...formHeader, title: e.target.value })} className="input" disabled={!formEditable} /></Field>
            <Field label="요청일"><input type="date" value={formHeader.requestDate || ''} onChange={e => setFormHeader({ ...formHeader, requestDate: e.target.value })} className="input" disabled={!formEditable} /></Field>
            <Field label="요청유형"><select value={formHeader.requestType || ''} onChange={e => setFormHeader({ ...formHeader, requestType: e.target.value })} className="input" disabled={!formEditable}>
              <option value="">선택</option>
              {prTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select></Field>
            <Field label="플랜트"><select value={formHeader.plantId || ''} onChange={e => setFormHeader({ ...formHeader, plantId: e.target.value, warehouseId: '' })} className="input" disabled={!formEditable || user?.multiPlant !== 'Y'}>
              <option value="">선택</option>
              {plants.map(p => <option key={p.id} value={p.id}>{p.id} — {p.name}</option>)}
            </select></Field>
            <Field label="예정 창고"><select value={formHeader.warehouseId || ''} onChange={e => setFormHeader({ ...formHeader, warehouseId: e.target.value })} className="input" disabled={!formEditable}>
              <option value="">선택</option>
              {filteredWarehouses.map(w => <option key={w.id} value={w.id}>{w.id} — {w.name}{!w.plantId ? ' (공통)' : ''}</option>)}
            </select></Field>
            <Field label="비고" className="sm:col-span-2 lg:col-span-4"><input value={formHeader.remarks || ''} onChange={e => setFormHeader({ ...formHeader, remarks: e.target.value })} className="input" disabled={!formEditable} /></Field>
          </div>
          <div className="mt-6">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs text-slate-400 font-bold">자재 라인</span>
              {formEditable && <button onClick={() => setFormItems([...formItems, { inventoryId: '', qty: 0, unit: '' }])} className="text-blue-400 text-xs font-semibold bg-transparent border-0 cursor-pointer flex items-center gap-1">
                <Plus size={12} /> 라인 추가
              </button>}
            </div>
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
            <table className="w-full text-xs border-collapse">
              <thead><tr className="bg-slate-900 text-slate-400 border-b border-slate-800"><th className="text-left p-3 font-semibold">자재</th><th className="text-right p-3 w-28 font-semibold">수량</th><th className="text-left p-3 w-24 font-semibold">단위</th><th className="w-12"></th></tr></thead>
              <tbody>
                {formItems.map((it, i) => (
                  <tr key={i}>
                    <td className="p-1"><select value={it.inventoryId} onChange={e => setFormItems(formItems.map((x, j) => j === i ? { ...x, inventoryId: e.target.value, unit: inventories.find(inv => inv.id === e.target.value)?.unit || x.unit } : x))} className="input" disabled={!formEditable}>
                      <option value="">선택</option>
                      {inventories.map(inv => <option key={inv.id} value={inv.id}>{inv.id} — {inv.name}</option>)}
                    </select></td>
                    <td className="p-1"><input type="number" value={it.qty || ''} onChange={e => setFormItems(formItems.map((x, j) => j === i ? { ...x, qty: Number(e.target.value) } : x))} className="input text-right" disabled={!formEditable} /></td>
                    <td className="p-1"><input value={it.unit || ''} onChange={e => setFormItems(formItems.map((x, j) => j === i ? { ...x, unit: e.target.value } : x))} className="input" disabled={!formEditable} /></td>
                    <td className="p-1 text-center">{formEditable && <button onClick={() => setFormItems(formItems.filter((_, j) => j !== i))} className="text-rose-400 bg-transparent border-0 cursor-pointer"><X size={12} /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6 pt-6 border-t border-slate-800">
            <button onClick={() => setFormOpen(false)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg py-2 px-4 text-xs font-semibold transition-colors border-0 cursor-pointer">닫기</button>
            {formEditable && <button onClick={() => submitForm('T')} className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg py-2 px-4 text-xs font-semibold transition-colors cursor-pointer">임시 저장</button>}
            {formEditable && <button onClick={() => submitForm('P')} className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 px-4 text-xs font-semibold transition-colors border-0 cursor-pointer">결재 상신</button>}
            {formEditable && canDirectConfirm && (
              <button onClick={() => submitForm('S')} className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg py-2 px-5 text-xs font-semibold transition-colors border-0 cursor-pointer">직접 확정</button>
            )}
          </div>
        </Modal>
      )}

      {/* 발주 모달 */}
      {orderModal && (
        <Modal title="발주 등록" onClose={() => setOrderModal(null)}>
          <div className="space-y-3 text-xs">
            <Field label="벤더"><input value={orderModal.vendorId} onChange={e => setOrderModal({ ...orderModal, vendorId: e.target.value })} className="input" list="purchase-vendor-options" placeholder="벤더명 또는 코드를 직접 입력" />
              <datalist id="purchase-vendor-options">
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </datalist>
            </Field>
            <Field label="구매담당자"><input value={orderModal.purchaseManager} onChange={e => setOrderModal({ ...orderModal, purchaseManager: e.target.value })} className="input" placeholder="예: 홍길동, 구매팀 대표, 익명" /></Field>
            <Field label="담당자 연락처"><input value={orderModal.purchaseManagerContact} onChange={e => setOrderModal({ ...orderModal, purchaseManagerContact: e.target.value })} className="input" placeholder="전화번호 또는 이메일" /></Field>
            <Field label="발주일"><input type="date" value={orderModal.orderDate} onChange={e => setOrderModal({ ...orderModal, orderDate: e.target.value })} className="input" /></Field>
            <Field label="예정도착일"><input type="date" value={orderModal.etaDate} onChange={e => setOrderModal({ ...orderModal, etaDate: e.target.value })} className="input" /></Field>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setOrderModal(null)} className="bg-slate-700 text-white rounded px-3 py-1.5 border-0 cursor-pointer">취소</button>
              <button onClick={submitOrder} className="bg-amber-700 hover:bg-amber-600 text-white rounded px-3 py-1.5 font-semibold border-0 cursor-pointer">발주</button>
            </div>
          </div>
        </Modal>
      )}

      {/* 배송 모달 */}
      {shipModal && (
        <Modal title="배송 시작" onClose={() => setShipModal(null)}>
          <div className="space-y-3 text-xs">
            <Field label="배송시작일"><input type="date" value={shipModal.shipStartDate} onChange={e => setShipModal({ ...shipModal, shipStartDate: e.target.value })} className="input" /></Field>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShipModal(null)} className="bg-slate-700 text-white rounded px-3 py-1.5 border-0 cursor-pointer">취소</button>
              <button onClick={submitShip} className="bg-amber-700 hover:bg-amber-600 text-white rounded px-3 py-1.5 font-semibold border-0 cursor-pointer">배송시작</button>
            </div>
          </div>
        </Modal>
      )}

      {/* 입고 모달 */}
      {receiveModal && (
        <Modal title={`입고 — ${receiveModal.pr.id}`} onClose={() => setReceiveModal(null)}>
          <div className="space-y-3 text-xs">
            <Field label="입고일"><input type="date" value={receiveModal.txDate} onChange={e => setReceiveModal({ ...receiveModal, txDate: e.target.value })} className="input" /></Field>
            <Field label="입고 창고"><select value={receiveModal.warehouseId} onChange={e => setReceiveModal({ ...receiveModal, warehouseId: e.target.value })} className="input">
              <option value="">선택</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.id} — {w.name}{!w.plantId ? ' (공통)' : ''}</option>)}
            </select></Field>
            <table className="w-full text-xs">
              <thead><tr className="text-slate-500"><th className="text-left p-1">자재</th><th className="text-right p-1">요청</th><th className="text-right p-1">기입고</th><th className="text-right p-1">잔여</th><th className="text-right p-1 w-24">입고수량</th><th className="text-right p-1 w-24">단가</th></tr></thead>
              <tbody>
                {receiveModal.lines.map((l: any, i: number) => (
                  <tr key={i} className="border-t border-slate-800">
                    <td className="p-1 text-slate-200">{l.inventoryId}</td>
                    <td className="p-1 text-right text-slate-300">{l.qty}</td>
                    <td className="p-1 text-right text-slate-300">{l.receivedQty}</td>
                    <td className="p-1 text-right text-slate-300">{l.remaining}</td>
                    <td className="p-1"><input type="number" value={l.inputQty} onChange={e => {
                      const v = Number(e.target.value);
                      setReceiveModal({ ...receiveModal, lines: receiveModal.lines.map((x: any, j: number) => j === i ? { ...x, inputQty: v } : x) });
                      if (v > l.remaining) console.warn('초과 입고 — 경고만');
                    }} className={`input text-right ${l.inputQty > l.remaining ? 'border-amber-500' : ''}`} /></td>
                    <td className="p-1"><input type="number" value={l.unitPrice || ''} onChange={e => setReceiveModal({ ...receiveModal, lines: receiveModal.lines.map((x: any, j: number) => j === i ? { ...x, unitPrice: e.target.value } : x) })} className="input text-right" placeholder="미입력 허용" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <label className="flex items-center gap-1 text-xs text-slate-300 cursor-pointer">
              <input type="checkbox" checked={receiveModal.close} onChange={e => setReceiveModal({ ...receiveModal, close: e.target.checked })} /> 이 요청 종료 (입고 후 곧바로 E)
            </label>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setReceiveModal(null)} className="bg-slate-700 text-white rounded px-3 py-1.5 border-0 cursor-pointer">취소</button>
              <button onClick={submitReceive} className="bg-blue-600 hover:bg-blue-500 text-white rounded px-3 py-1.5 font-semibold border-0 cursor-pointer flex items-center gap-1">
                <PackageCheck size={13} /> 입고
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 벤더 폼 */}
      {vendorForm && (
        <Modal title={vendorForm.editing ? '벤더 수정' : '신규 벤더'} onClose={() => setVendorForm(null)}>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <Field label="코드"><input value={vendorForm.id} onChange={e => setVendorForm({ ...vendorForm, id: e.target.value })} className="input" disabled={vendorForm.editing} /></Field>
            <Field label="이름"><input value={vendorForm.name} onChange={e => setVendorForm({ ...vendorForm, name: e.target.value })} className="input" /></Field>
            <Field label="사업자번호"><input value={vendorForm.bizNo} onChange={e => setVendorForm({ ...vendorForm, bizNo: e.target.value })} className="input" /></Field>
            <Field label="연락처"><input value={vendorForm.contact} onChange={e => setVendorForm({ ...vendorForm, contact: e.target.value })} className="input" /></Field>
            <Field label="담당자"><input value={vendorForm.manager} onChange={e => setVendorForm({ ...vendorForm, manager: e.target.value })} className="input" /></Field>
            <Field label="비고" className="col-span-2"><input value={vendorForm.remarks} onChange={e => setVendorForm({ ...vendorForm, remarks: e.target.value })} className="input" /></Field>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setVendorForm(null)} className="bg-slate-700 text-white rounded px-3 py-1.5 text-xs border-0 cursor-pointer">취소</button>
            <button onClick={submitVendor} className="bg-blue-600 hover:bg-blue-500 text-white rounded px-3 py-1.5 text-xs font-semibold border-0 cursor-pointer">저장</button>
          </div>
        </Modal>
      )}

      <ApprovalDraftModal
        open={!!approvalRef}
        mode="linked"
        refModule="PUR"
        refNo={approvalRef?.id || ''}
        defaultTitle={approvalRef ? `[구매요청] ${approvalRef.title || approvalRef.id}` : ''}
        defaultContent={approvalContent}
        users={usersList}
        currentUserId={user?.id}
        approvalId={approvalRef?.approvalId}
        onClose={() => setApprovalRef(null)}
        onSubmitted={() => {
          setApprovalRef(null);
          setFormOpen(false);
          toast.success('구매요청 결재 문서가 상신되었습니다.');
          loadRequests();
        }}
      />

      {/* 입력 공통 클래스 — Tailwind CSS 변수 사용으로 라이트/다크 모드 자동 반전 */}
      <style>{`
        .input {
          width: 100%;
          background-color: var(--color-slate-950);
          border: 1px solid var(--color-slate-800);
          color: var(--color-slate-200);
          font-size: 0.75rem;
          line-height: 1rem;
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          outline: none;
          transition: border-color 0.15s ease;
        }
        .input:focus { border-color: var(--color-blue-500); }
        .input:disabled { opacity: 0.5; }
      `}</style>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto print:hidden">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center shrink-0">
          <h2 className="text-lg font-bold text-slate-200">{title}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1 hover:bg-slate-800 rounded transition-colors border-0 cursor-pointer bg-transparent">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col ${className || ''}`}>
      <span className="block text-slate-400 text-xs mb-1.5">{label}</span>
      {children}
    </label>
  );
}
