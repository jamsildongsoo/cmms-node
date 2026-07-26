import { useEffect, useMemo, useState } from 'react';
import { PackageCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import axiosInstance from '../api/axios';
import { todayLocal } from '../utils/datetime';
import ListBadge from '../components/ListBadge';
import ListIconButton from '../components/ListIconButton';
import { getCommonStatusLabel, getProcStatusLabel } from '../constants/status';

interface Warehouse {
  id: string;
  name: string;
  plantId?: string | null;
}

interface ReceiptLine {
  lineNo: number;
  inventoryId: string;
  qty: number;
  receivedQty: number;
  remaining: number;
  inputQty: number;
  unitPrice: number;
  unit?: string | null;
}

interface RequestHeader {
  id: string;
  title: string;
  plantId: string;
  warehouseId: string;
  requesterId: string;
  status: string;
  procStatus?: string | null;
}

interface ReceiptRequestSummary extends RequestHeader {
  requestedQty: string;
  remainingQty: string;
}

export default function PurchaseReceipt() {
  const [header, setHeader] = useState<RequestHeader | null>(null);
  const [lines, setLines] = useState<ReceiptLine[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [txDate, setTxDate] = useState(todayLocal());
  const [saving, setSaving] = useState(false);
  const [requests, setRequests] = useState<ReceiptRequestSummary[]>([]);
  const [searchType, setSearchType] = useState<'id' | 'title' | 'owner'>('id');
  const [searchValue, setSearchValue] = useState('');
  const filteredRequests = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase();
    if (!keyword) return requests;
    return requests.filter((request) => {
      if (searchType === 'id') return request.id.toLowerCase().includes(keyword);
      if (searchType === 'title') return (request.title || '').toLowerCase().includes(keyword);
      return request.requesterId.toLowerCase().includes(keyword);
    });
  }, [requests, searchType, searchValue]);

  useEffect(() => {
    axiosInstance.get('/mdm/refs/warehouses')
      .then((response) => setWarehouses(response.data || []))
      .catch(() => toast.error('창고 정보를 불러오지 못했습니다.'));
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const response = await axiosInstance.get('/procurement/receipts/requests');
      setRequests(response.data || []);
    } catch (error: any) {
      toast.error(error.response?.data?.message || '입고 대상 구매요청을 불러오지 못했습니다.');
    }
  };

  const verifyRequest = async (selectedId: string) => {
    const id = selectedId.trim();
    try {
      const response = await axiosInstance.get(`/procurement/receipts/request/${encodeURIComponent(id)}`);
      const request = response.data.header as RequestHeader;
      if (!['C', 'S'].includes(request.status)) {
        throw new Error('결재완료 또는 직접확정된 구매요청만 입고할 수 있습니다.');
      }
      if (!['O', 'D', 'P'].includes(request.procStatus || '')) {
        throw new Error('발주·배송중·부분입고 상태의 구매요청만 입고할 수 있습니다.');
      }
      setHeader(request);
      setWarehouseId(request.warehouseId);
      setLines((response.data.items || []).map((item: any) => {
        const qty = Number(item.qty);
        const receivedQty = Number(item.receivedQty || 0);
        const remaining = Math.max(0, qty - receivedQty);
        return {
          ...item,
          qty,
          receivedQty,
          remaining,
          inputQty: remaining,
          unitPrice: 0,
        };
      }));
    } catch (error: any) {
      setHeader(null);
      setLines([]);
      toast.error(error.response?.data?.message || error.message || '구매요청 번호를 확인할 수 없습니다.');
    }
  };

  const submit = async () => {
    if (!header || !warehouseId) {
      toast.error('구매요청과 입고 창고를 확인하세요.');
      return;
    }
    const receiptLines = lines
      .filter((line) => line.inputQty > 0)
      .map((line) => ({
        lineNo: line.lineNo,
        qty: line.inputQty,
        unitPrice: line.unitPrice,
      }));
    if (!receiptLines.length) {
      toast.error('입고수량을 입력하세요.');
      return;
    }
    if (lines.some((line) => line.inputQty > line.remaining)) {
      toast.error('잔여수량을 초과하여 입고할 수 없습니다.');
      return;
    }
    setSaving(true);
    try {
      await axiosInstance.post('/procurement/receipts', {
        requestId: header.id,
        warehouseId,
        txDate,
        lines: receiptLines,
      });
      toast.success('구매입고가 처리되었습니다.');
      setHeader(null);
      setLines([]);
      await loadRequests();
    } catch (error: any) {
      toast.error(error.response?.data?.message || '구매입고 처리에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <PackageCheck size={24} className="text-blue-500" />
          구매입고
        </h1>
        <p className="text-xs text-slate-500 mt-1">구매요청별 요청수량과 잔여수량을 확인하고 입고 처리합니다.</p>
      </div>

      {header && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h2 className="text-lg font-bold text-slate-200">구매입고 — {header.id}</h2>
              <button type="button" onClick={() => setHeader(null)} className="border-0 bg-transparent text-slate-500 hover:text-slate-300 cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <Info label="요청번호" value={header.id} />
              <Info label="제목" value={header.title || '-'} />
              <Info label="요청자" value={header.requesterId} />
              <div>
                <span className="block text-slate-500 mb-1">상태</span>
                <ListBadge>{getCommonStatusLabel(header.status)} / {getProcStatusLabel(header.procStatus)}</ListBadge>
              </div>
              <label>
                <span className="block text-slate-500 mb-1">입고일</span>
                <input type="date" value={txDate} onChange={(event) => setTxDate(event.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200" />
              </label>
              <label className="lg:col-span-2">
                <span className="block text-slate-500 mb-1">입고 창고</span>
                <select value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200">
                  <option value="">선택</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.id} — {warehouse.name}{warehouse.plantId ? '' : ' (공통)'}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-950 text-slate-400">
                  <tr>
                    <th className="p-3 text-left">자재</th>
                    <th className="p-3 text-right">요청</th>
                    <th className="p-3 text-right">기입고</th>
                    <th className="p-3 text-right">잔여</th>
                    <th className="p-3 text-right">입고수량</th>
                    <th className="p-3 text-right">단가</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, index) => (
                    <tr key={line.lineNo} className="border-t border-slate-800 text-slate-300">
                      <td className="p-3">{line.inventoryId}</td>
                      <td className="p-3 text-right">{line.qty}</td>
                      <td className="p-3 text-right">{line.receivedQty}</td>
                      <td className="p-3 text-right">{line.remaining}</td>
                      <td className="p-2"><input type="number" min="0" max={line.remaining} value={line.inputQty} onChange={(event) => setLines(lines.map((item, lineIndex) => lineIndex === index ? { ...item, inputQty: Number(event.target.value) } : item))} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-right" /></td>
                      <td className="p-2"><input type="number" min="0" step="any" value={line.unitPrice || ''} onChange={(event) => setLines(lines.map((item, lineIndex) => lineIndex === index ? { ...item, unitPrice: Number(event.target.value) } : item))} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-right" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={() => setHeader(null)} className="mr-2 bg-slate-700 text-white rounded-lg px-5 py-2 text-xs font-semibold border-0 cursor-pointer">
                취소
              </button>
              <button disabled={saving} onClick={submit} className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-5 py-2 text-xs font-semibold flex items-center gap-1.5 border-0 cursor-pointer disabled:opacity-50">
                <PackageCheck size={14} /> 입고 처리
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-sm font-bold text-slate-200 mb-4">입고 대상 구매요청 목록</h2>
        <div className="mb-4 flex gap-2">
          <select
            value={searchType}
            onChange={(event) => setSearchType(event.target.value as typeof searchType)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 outline-none"
          >
            <option value="id">문서번호</option>
            <option value="title">제목</option>
            <option value="owner">담당자</option>
          </select>
          <input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="검색어를 입력하세요"
            className="flex-1 min-w-[200px] bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 outline-none"
          />
        </div>
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 select-none">
                <th className="p-3 font-semibold">구매요청번호</th>
                <th className="p-3 font-semibold">제목</th>
                <th className="p-3 font-semibold">플랜트/예정 창고</th>
                <th className="p-3 font-semibold">요청자</th>
                <th className="p-3 font-semibold text-right">요청수량</th>
                <th className="p-3 font-semibold text-right">잔여수량</th>
                <th className="p-3 font-semibold">결재상태</th>
                <th className="p-3 font-semibold text-right">작업</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-slate-600">입고 가능한 구매요청이 없습니다.</td></tr>
              )}
              {filteredRequests.map((request) => (
                <tr key={request.id} className="border-b border-slate-900 hover:bg-slate-900/30 text-slate-300">
                  <td className="p-3 font-mono text-slate-200">{request.id}</td>
                  <td className="p-3">{request.title || '-'}</td>
                  <td className="p-3">{request.plantId} / {request.warehouseId}</td>
                  <td className="p-3">{request.requesterId}</td>
                  <td className="p-3 text-right font-mono">{formatQty(request.requestedQty)}</td>
                  <td className="p-3 text-right font-mono text-amber-400">{formatQty(request.remainingQty)}</td>
                  <td className="p-3"><ListBadge>{request.status}</ListBadge></td>
                  <td className="p-3 text-right">
                    <ListIconButton
                      onClick={() => verifyRequest(request.id)}
                      label={`${request.id} 입고`}
                      icon={PackageCheck}
                      tone="accent"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><span className="block text-slate-500 mb-1">{label}</span><strong className="text-slate-200">{value}</strong></div>;
}

function formatQty(value: string | number): string {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 4 });
}
