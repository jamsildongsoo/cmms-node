import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { requestConfirmation } from '../utils/userActionDialog';
import axiosInstance from '../api/axios';
import ProcurementRequestPrint from '../components/ProcurementRequestPrint';
import { useAuthStore } from '../store/useAuthStore';
import { ShoppingCart, Plus, PackageCheck, X, Trash2, Printer } from 'lucide-react';
import {
  getCommonStatusLabel,
  getCommonStatusClass,
  getProcStatusLabel,
  getProcStatusClass,
} from '../constants/status';
import { formatDateOnly, todayLocal } from '../utils/datetime';

interface Vendor { id: string; name: string; bizNo?: string; contact?: string; manager?: string; remarks?: string; deleteYn?: string }
interface Warehouse { id: string; name: string; plantId?: string | null }
interface Plant { id: string; name: string }
interface CodeItem { id: string; name: string; sortOrder?: number }
interface InventoryRef { id: string; name: string; unit?: string }
interface PurchaseRequest {
  id: string; plantId: string; warehouseId: string; requesterId: string; requestDate: string;
  requestType?: string; vendorId?: string | null; orderDate?: string | null; etaDate?: string | null;
  shipStartDate?: string | null; status: string; procStatus?: string | null; remarks?: string;
  type?: string; approvalId?: string | null;
}
interface ItemLine { lineNo?: number; inventoryId: string; qty: number; unit?: string; remarks?: string }
interface ReceiveLine { lineNo: number; qty: number; unitPrice?: number | null }


export default function Procurement() {
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<'requests' | 'vendors'>('requests');

  // ============ 공통 데이터 ============
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [prTypes, setPrTypes] = useState<CodeItem[]>([]);
  const [inventories, setInventories] = useState<InventoryRef[]>([]);

  const loadRefs = async () => {
    try {
      const [v, w, p, codes, inv] = await Promise.all([
        axiosInstance.get('/vendors'),
        axiosInstance.get('/mdm/warehouses'),
        axiosInstance.get('/mdm/plants'),
        axiosInstance.get('/mdm/codes/items/PR_TYPE').catch(() => ({ data: [] })),
        axiosInstance.get('/master/inventories'),
      ]);
      setVendors(v.data || []);
      setWarehouses(w.data || []);
      setPlants(p.data || []);
      setPrTypes(codes.data || []);
      setInventories(inv.data || []);
    } catch (e) {
      console.error('참조 데이터 로드 실패', e);
    }
  };
  useEffect(() => { loadRefs(); }, []);

  // ============ 구매요청 ============
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const loadRequests = async () => {
    try {
      const res = await axiosInstance.get('/procurement/requests');
      setRequests((res.data || []).map((request: PurchaseRequest) => ({
        ...request,
        requestDate: formatDateOnly(request.requestDate),
        orderDate: formatDateOnly(request.orderDate) || null,
        etaDate: formatDateOnly(request.etaDate) || null,
        shipStartDate: formatDateOnly(request.shipStartDate) || null,
      })));
    } catch (e) { console.error(e); }
  };
  useEffect(() => { if (tab === 'requests') loadRequests(); }, [tab]);

  // 신규/수정 모달
  const [formOpen, setFormOpen] = useState(false);
  const [formHeader, setFormHeader] = useState<Partial<PurchaseRequest>>({ requestDate: todayLocal() });
  const [formItems, setFormItems] = useState<ItemLine[]>([{ inventoryId: '', qty: 0, unit: '' }]);
  const [confirmOnSave, setConfirmOnSave] = useState(false);

  const openNewForm = () => {
    setFormHeader({
      requestDate: todayLocal(),
      plantId: user?.lastLoginPlantId || '',
    });
    setFormItems([{ inventoryId: '', qty: 0, unit: '' }]);
    setConfirmOnSave(false);
    setFormOpen(true);
  };

  const submitForm = async () => {
    if (!formHeader.warehouseId) { toast.error('입고 저장소를 선택하세요.'); return; }
    if (formItems.length === 0 || !formItems[0].inventoryId) { toast.error('자재 라인을 1개 이상 입력하세요.'); return; }
    try {
      await axiosInstance.post('/procurement/requests', {
        header: { ...formHeader, status: confirmOnSave ? 'S' : 'T' },
        items: formItems,
        confirm: confirmOnSave,
      });
      setFormOpen(false);
      await loadRequests();
    } catch (e: any) {
      toast.error(e.response?.data?.message || '저장 실패');
    }
  };

  // 발주 / 배송 / 입고 / 종료 액션
  const confirmRequest = async (id: string) => {
    if (!(await requestConfirmation('이 요청을 확정(S)하시겠습니까?'))) return;
    try { await axiosInstance.post(`/procurement/requests/${id}/confirm`); await loadRequests(); }
    catch (e: any) { toast.error(e.response?.data?.message || '실패'); }
  };

  // 발주 모달
  const [orderModal, setOrderModal] = useState<{ id: string; vendorId: string; orderDate: string; etaDate: string } | null>(null);
  const submitOrder = async () => {
    if (!orderModal) return;
    try {
      await axiosInstance.post('/procurement/orders', { requestId: orderModal.id, vendorId: orderModal.vendorId, orderDate: orderModal.orderDate, etaDate: orderModal.etaDate });
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
  const [receiveModal, setReceiveModal] = useState<{ pr: PurchaseRequest; lines: any[]; close: boolean; txDate: string } | null>(null);
  const openReceiveModal = async (pr: PurchaseRequest) => {
    try {
      const detail = await axiosInstance.get(`/procurement/requests/${pr.id}`);
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
      setReceiveModal({ pr, lines, close: false, txDate: todayLocal() });
    } catch (e: any) { toast.error(e.response?.data?.message || '상세 조회 실패'); }
  };
  const submitReceive = async () => {
    if (!receiveModal) return;
    const lines: ReceiveLine[] = receiveModal.lines
      .filter((l: any) => Number(l.inputQty) > 0)
      .map((l: any) => ({ lineNo: l.lineNo, qty: Number(l.inputQty), unitPrice: l.unitPrice ? Number(l.unitPrice) : 0 }));
    if (lines.length === 0) { toast.error('입고 수량을 1개 이상 입력하세요.'); return; }
    try {
      await axiosInstance.post('/procurement/receipts', { requestId: receiveModal.pr.id, txDate: receiveModal.txDate, close: receiveModal.close, lines });
      setReceiveModal(null);
      await loadRequests();
    } catch (e: any) { toast.error(e.response?.data?.message || '입고 실패'); }
  };

  const closeRequest = async (id: string) => {
    if (!(await requestConfirmation('이 요청을 종료(E)하시겠습니까? (미입고 잔여는 닫힙니다)'))) return;
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
    const list = tab === 'requests' ? requests : vendors;
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
            <td>${pr.type === 'ITEM' ? '자재' : pr.type === 'SERVICE' ? '용역' : pr.type}</td>
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
      ? '<th>요청번호</th><th>요청일</th><th>플랜트/저장소</th><th>유형</th><th>절차</th><th>결재번호</th>'
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
<h1>${tabLabel} 현황</h1>
<div class="print-info"><span>회사: ${user?.companyName || user?.companyId || 'CMMS'}</span><span>출력자: ${user?.name || '-'} | 출력일시: ${stamp}</span></div>
<table><thead><tr>${thCells}</tr></thead><tbody>${rows}</tbody></table>
<div class="no-print"><button onclick="window.print()">인쇄</button></div>
</body></html>`);
    printWindow.document.close();
    printWindow.focus();
  };

  // 인쇄(구매요청서)
  const [printPr, setPrintPr] = useState<{ header: PurchaseRequest; items: ItemLine[] } | null>(null);
  const openPrint = async (id: string) => {
    try {
      const detail = await axiosInstance.get(`/procurement/requests/${id}`);
      const header = detail.data.header as PurchaseRequest;
      setPrintPr({
        header: {
          ...header,
          requestDate: formatDateOnly(header.requestDate),
          orderDate: formatDateOnly(header.orderDate) || null,
          etaDate: formatDateOnly(header.etaDate) || null,
          shipStartDate: formatDateOnly(header.shipStartDate) || null,
        },
        items: detail.data.items || [],
      });
    } catch (e: any) { toast.error(e.response?.data?.message || '인쇄 실패'); }
  };

  // printPr가 실제 렌더된 직후 인쇄 (setTimeout 타이밍 추정 대신 렌더 동기 — 레이스 제거)
  useEffect(() => {
    if (printPr) window.print();
  }, [printPr]);

  const filteredWarehouses = useMemo(() => {
    if (!formHeader.plantId) return warehouses;
    return warehouses.filter(w => !w.plantId || w.plantId === formHeader.plantId);
  }, [warehouses, formHeader.plantId]);

  // ============ 벤더 관리 ============
  const [vendorForm, setVendorForm] = useState<{ id: string; name: string; bizNo: string; contact: string; manager: string; remarks: string; editing?: boolean } | null>(null);
  const submitVendor = async () => {
    if (!vendorForm) return;
    if (!vendorForm.id || !vendorForm.name) { toast.error('아이디·이름은 필수입니다.'); return; }
    try {
      if (vendorForm.editing) {
        await axiosInstance.put(`/vendors/${vendorForm.id}`, vendorForm);
      } else {
        await axiosInstance.post('/vendors', vendorForm);
      }
      setVendorForm(null);
      await loadRefs();
    } catch (e: any) { toast.error(e.response?.data?.message || '저장 실패'); }
  };
  const deleteVendor = async (id: string) => {
    if (!(await requestConfirmation('이 벤더를 삭제하시겠습니까?'))) return;
    try { await axiosInstance.delete(`/vendors/${id}`); await loadRefs(); }
    catch (e: any) { toast.error(e.response?.data?.message || '삭제 실패'); }
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center print:hidden">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <ShoppingCart size={24} className="text-blue-500" />
          구매
        </h1>
        <div className="flex items-center gap-3">
          <button onClick={handlePrint} className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
            <Printer size={14} /> 목록 인쇄
          </button>
          <button onClick={tab === 'requests' ? openNewForm : () => setVendorForm({ id: '', name: '', bizNo: '', contact: '', manager: '', remarks: '' })} className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 cursor-pointer border-0">
            <Plus size={14} /> 입력
          </button>
          <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-lg">
            <button onClick={() => setTab('requests')} className={`px-4 py-1.5 rounded-md text-xs font-semibold cursor-pointer border-0 ${tab === 'requests' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 bg-transparent'}`}>
              구매요청
            </button>
            <button onClick={() => setTab('vendors')} className={`px-4 py-1.5 rounded-md text-xs font-semibold cursor-pointer border-0 ${tab === 'vendors' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 bg-transparent'}`}>
              벤더 관리
            </button>
          </div>
        </div>
      </div>

      {tab === 'requests' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-lg font-bold text-slate-200 mb-4 print:hidden">구매요청 목록</h2>
          <table className="w-full text-xs">
            <thead className="bg-slate-950 text-slate-400 text-left">
              <tr>
                <th className="p-3">요청번호</th>
                <th className="p-3">요청일</th>
                <th className="p-3">플랜트/저장소</th>
                <th className="p-3">유형</th>
                <th className="p-3">문서</th>
                <th className="p-3">절차</th>
                <th className="p-3 text-right">작업</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-slate-500">구매요청이 없습니다.</td></tr>
              )}
              {requests.map(pr => (
                <tr key={pr.id} className="border-t border-slate-800">
                  <td className="p-3 font-mono text-slate-200">{pr.id}</td>
                  <td className="p-3 text-slate-300">{pr.requestDate}</td>
                  <td className="p-3 text-slate-300">{pr.plantId} / {pr.warehouseId}</td>
                  <td className="p-3 text-slate-300">{pr.requestType || '-'}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getCommonStatusClass(pr.status)}`}>
                      {getCommonStatusLabel(pr.status)} ({pr.status})
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getProcStatusClass(pr.procStatus)}`}>
                      {pr.procStatus ? `${getProcStatusLabel(pr.procStatus)} (${pr.procStatus})` : '발주대기'}
                    </span>
                  </td>
                  <td className="p-3 text-right space-x-1">
                    <button onClick={() => openPrint(pr.id)} title="구매요청서 출력" className="text-slate-400 hover:text-slate-200 p-1 bg-transparent border-0 cursor-pointer">
                      <Printer size={14} />
                    </button>
                    {pr.status === 'T' && (
                      <>
                        <button onClick={() => confirmRequest(pr.id)} className="bg-emerald-700 hover:bg-emerald-600 text-white rounded px-2 py-1 text-[10px] font-semibold border-0 cursor-pointer">확정</button>
                        <button onClick={() => deleteRequest(pr.id)} title="삭제" className="text-rose-400 hover:text-rose-300 p-1 bg-transparent border-0 cursor-pointer">
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                    {pr.status === 'S' && !pr.procStatus && (
                      <button onClick={() => setOrderModal({ id: pr.id, vendorId: pr.vendorId || '', orderDate: todayLocal(), etaDate: '' })} className="bg-amber-700 hover:bg-amber-600 text-white rounded px-2 py-1 text-[10px] font-semibold border-0 cursor-pointer">발주</button>
                    )}
                    {pr.status === 'S' && pr.procStatus === 'O' && (
                      <button onClick={() => setShipModal({ id: pr.id, shipStartDate: todayLocal() })} className="bg-amber-700 hover:bg-amber-600 text-white rounded px-2 py-1 text-[10px] font-semibold border-0 cursor-pointer">배송시작</button>
                    )}
                    {pr.status === 'S' && pr.procStatus !== 'E' && pr.procStatus && (
                      <>
                        <button onClick={() => openReceiveModal(pr)} className="bg-blue-700 hover:bg-blue-600 text-white rounded px-2 py-1 text-[10px] font-semibold border-0 cursor-pointer">입고</button>
                        <button onClick={() => closeRequest(pr.id)} className="bg-slate-700 hover:bg-slate-600 text-white rounded px-2 py-1 text-[10px] font-semibold border-0 cursor-pointer">종료</button>
                      </>
                    )}
                    {pr.status === 'S' && pr.procStatus === 'D' && (
                      <button onClick={() => openReceiveModal(pr)} className="bg-blue-700 hover:bg-blue-600 text-white rounded px-2 py-1 text-[10px] font-semibold border-0 cursor-pointer">입고</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 벤더 관리 탭 */}
      {tab === 'vendors' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-lg font-bold text-slate-200 mb-4">벤더 관리</h2>
          <table className="w-full text-xs">
            <thead className="bg-slate-950 text-slate-400 text-left">
              <tr>
                <th className="p-3">코드</th>
                <th className="p-3">이름</th>
                <th className="p-3">사업자번호</th>
                <th className="p-3">연락처</th>
                <th className="p-3">담당자</th>
                <th className="p-3 text-right">액션</th>
              </tr>
            </thead>
            <tbody>
              {vendors.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-slate-500">벤더가 없습니다.</td></tr>}
              {vendors.map(v => (
                <tr key={v.id} className="border-t border-slate-800">
                  <td className="p-3 font-mono text-slate-200">{v.id}</td>
                  <td className="p-3 text-slate-300">{v.name}</td>
                  <td className="p-3 text-slate-300">{v.bizNo || '-'}</td>
                  <td className="p-3 text-slate-300">{v.contact || '-'}</td>
                  <td className="p-3 text-slate-300">{v.manager || '-'}</td>
                  <td className="p-3 text-right space-x-1">
                    <button onClick={() => setVendorForm({ id: v.id, name: v.name, bizNo: v.bizNo || '', contact: v.contact || '', manager: v.manager || '', remarks: v.remarks || '', editing: true })} className="text-blue-400 hover:text-blue-300 p-1 bg-transparent border-0 cursor-pointer">수정</button>
                    <button onClick={() => deleteVendor(v.id)} className="text-rose-400 hover:text-rose-300 p-1 bg-transparent border-0 cursor-pointer">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 신규/수정 요청 모달 */}
      {formOpen && (
        <Modal title="구매요청 작성" onClose={() => setFormOpen(false)}>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <Field label="요청일"><input type="date" value={formHeader.requestDate || ''} onChange={e => setFormHeader({ ...formHeader, requestDate: e.target.value })} className="input" /></Field>
            <Field label="플랜트"><select value={formHeader.plantId || ''} onChange={e => setFormHeader({ ...formHeader, plantId: e.target.value, warehouseId: '' })} className="input" disabled={user?.multiPlant !== 'Y'}>
              <option value="">선택</option>
              {plants.map(p => <option key={p.id} value={p.id}>{p.id} — {p.name}</option>)}
            </select></Field>
            <Field label="입고 저장소"><select value={formHeader.warehouseId || ''} onChange={e => setFormHeader({ ...formHeader, warehouseId: e.target.value })} className="input">
              <option value="">선택</option>
              {filteredWarehouses.map(w => <option key={w.id} value={w.id}>{w.id} — {w.name}{!w.plantId ? ' (공통)' : ''}</option>)}
            </select></Field>
            <Field label="요청유형"><select value={formHeader.requestType || ''} onChange={e => setFormHeader({ ...formHeader, requestType: e.target.value })} className="input">
              <option value="">선택</option>
              {prTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select></Field>
            <Field label="비고" className="col-span-2"><input value={formHeader.remarks || ''} onChange={e => setFormHeader({ ...formHeader, remarks: e.target.value })} className="input" /></Field>
          </div>
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-slate-400 font-bold">자재 라인</span>
              <button onClick={() => setFormItems([...formItems, { inventoryId: '', qty: 0, unit: '' }])} className="text-blue-400 text-xs font-semibold bg-transparent border-0 cursor-pointer flex items-center gap-1">
                <Plus size={12} /> 라인 추가
              </button>
            </div>
            <table className="w-full text-xs">
              <thead><tr className="text-slate-500"><th className="text-left p-1">자재</th><th className="text-right p-1 w-24">수량</th><th className="text-left p-1 w-20">단위</th><th className="w-8"></th></tr></thead>
              <tbody>
                {formItems.map((it, i) => (
                  <tr key={i}>
                    <td className="p-1"><select value={it.inventoryId} onChange={e => setFormItems(formItems.map((x, j) => j === i ? { ...x, inventoryId: e.target.value, unit: inventories.find(inv => inv.id === e.target.value)?.unit || x.unit } : x))} className="input">
                      <option value="">선택</option>
                      {inventories.map(inv => <option key={inv.id} value={inv.id}>{inv.id} — {inv.name}</option>)}
                    </select></td>
                    <td className="p-1"><input type="number" value={it.qty || ''} onChange={e => setFormItems(formItems.map((x, j) => j === i ? { ...x, qty: Number(e.target.value) } : x))} className="input text-right" /></td>
                    <td className="p-1"><input value={it.unit || ''} onChange={e => setFormItems(formItems.map((x, j) => j === i ? { ...x, unit: e.target.value } : x))} className="input" /></td>
                    <td className="p-1 text-center"><button onClick={() => setFormItems(formItems.filter((_, j) => j !== i))} className="text-rose-400 bg-transparent border-0 cursor-pointer"><X size={12} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between items-center mt-4">
            <label className="flex items-center gap-1 text-xs text-slate-300 cursor-pointer">
              <input type="checkbox" checked={confirmOnSave} onChange={e => setConfirmOnSave(e.target.checked)} /> 저장 후 곧바로 확정(S)
            </label>
            <div className="space-x-2">
              <button onClick={() => setFormOpen(false)} className="bg-slate-700 text-white rounded px-3 py-1.5 text-xs border-0 cursor-pointer">취소</button>
              <button onClick={submitForm} className="bg-blue-600 hover:bg-blue-500 text-white rounded px-3 py-1.5 text-xs font-semibold border-0 cursor-pointer">저장</button>
            </div>
          </div>
        </Modal>
      )}

      {/* 발주 모달 */}
      {orderModal && (
        <Modal title="발주 등록" onClose={() => setOrderModal(null)}>
          <div className="space-y-3 text-xs">
            <Field label="벤더"><select value={orderModal.vendorId} onChange={e => setOrderModal({ ...orderModal, vendorId: e.target.value })} className="input">
              <option value="">선택</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.id} — {v.name}</option>)}
            </select></Field>
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

      {/* 구매요청서 전용 인쇄뷰 (흑백) */}
      {printPr && (
        <ProcurementRequestPrint
          id={printPr.header.id}
          requestDate={printPr.header.requestDate}
          requesterId={printPr.header.requesterId}
          requestType={printPr.header.requestType}
          plantId={printPr.header.plantId}
          warehouseId={printPr.header.warehouseId}
          items={printPr.items}
        />
      )}

      {/* 입력 공통 클래스 — Tailwind CSS 변수 사용으로 라이트/다크 모드 자동 반전 */}
      <style>{`
        .input {
          width: 100%;
          background-color: var(--color-slate-900);
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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 print:hidden">
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold text-slate-200">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 bg-transparent border-0 cursor-pointer">
            <X size={18} />
          </button>
        </div>
        {children}
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
