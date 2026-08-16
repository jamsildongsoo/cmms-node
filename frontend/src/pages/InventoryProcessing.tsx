import { useEffect, useMemo, useState } from 'react';
import { Layers, PackageCheck, Plus, Settings, Trash } from 'lucide-react';
import { toast } from 'sonner';
import { stockApi } from '../features/stock/stock.api';
import type { StockProcessingItem as TxGridItem } from '../features/stock/stock.types';
import { referenceApi } from '../features/mdm/reference.api';
import { masterReferenceApi } from '../features/master/master-reference.api';
import { procurementApi } from '../features/procurement/procurement.api';
import type { InventoryReference } from '../features/master/master-reference.types';
import type { ReferenceUser, Warehouse } from '../features/mdm/mdm.types';
import type {
  PurchaseReceiptItem,
  PurchaseReceiptRequest,
  PurchaseReceiptRequestSummary,
} from '../features/procurement/procurement.types';
import { useAuthStore } from '../store/useAuthStore';
import { hasModuleManage } from '../utils/moduleAccess';
import { APP_MODULE } from '../constants/module';
import {
  getCommonStatusLabel,
  getProcStatusLabel,
  TX_REASON,
  TX_REASON_BY_TYPE,
  TX_REASON_OPTIONS,
  type TxReason,
} from '../constants/status';
import { todayLocal, thisMonthLocal } from '../utils/datetime';
import { getApiErrorMessage, toastApiError } from '../utils/apiError';
import { formatQuantity } from '../utils/number';
import ListBadge from '../components/ListBadge';
import ListIconButton from '../components/ListIconButton';

type ProcessingTab = 'IN' | 'OUT' | 'MOVE' | 'ADJ';

interface InventoryProcessingProps {
  initialTab?: ProcessingTab;
  initialReason?: TxReason;
  initialRequestId?: string | null;
  initialOrderId?: string | null;
}

function createEmptyGrid(
  warehouses: Warehouse[],
  inventories: InventoryReference[],
): TxGridItem[] {
  return [
    {
      warehouseId: warehouses[0]?.id || '',
      inventoryId: inventories[0]?.id || '',
      qty: 1,
      unitPrice: 0,
      targetWarehouseId: warehouses[1]?.id || '',
    },
  ];
}

export default function InventoryProcessing({
  initialTab = 'IN',
  initialReason,
  initialRequestId,
  initialOrderId,
}: InventoryProcessingProps) {
  const user = useAuthStore((state) => state.user);
  const canCreate = hasModuleManage(user?.moduleAccess, APP_MODULE.STK);
  const [activeTab, setActiveTab] = useState<ProcessingTab>(initialTab);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [inventories, setInventories] = useState<InventoryReference[]>([]);
  const [usersList, setUsersList] = useState<ReferenceUser[]>([]);
  const [txGrid, setTxGrid] = useState<TxGridItem[]>([]);
  const [txDate, setTxDate] = useState(todayLocal());
  const [txReasonCode, setTxReasonCode] = useState<TxReason>(initialReason ?? defaultReason(initialTab));
  const [closingYm, setClosingYm] = useState(thisMonthLocal());
  const [isLoading, setIsLoading] = useState(false);
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  const [header, setHeader] = useState<PurchaseReceiptRequest | null>(null);
  const [lines, setLines] = useState<PurchaseReceiptItem[]>([]);
  const [receiptRequests, setReceiptRequests] = useState<PurchaseReceiptRequestSummary[]>([]);
  const [searchType, setSearchType] = useState<'id' | 'title' | 'owner'>('id');
  const [searchValue, setSearchValue] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [receiptOrderId, setReceiptOrderId] = useState<string | null>(initialOrderId ?? null);
  const [prTransferMode, setPrTransferMode] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const [loadedWarehouses, loadedInventories, loadedUsers] = await Promise.all([
            referenceApi.getWarehouseOptions(),
            masterReferenceApi.getInventories(),
            referenceApi.getUserOptions(),
          ]);
          setWarehouses(loadedWarehouses);
          setInventories(loadedInventories);
          setUsersList(loadedUsers);
          setTxGrid(createEmptyGrid(loadedWarehouses, loadedInventories));
        } catch (error: unknown) {
          toastApiError(error, '재고처리 기준정보를 불러오지 못했습니다.');
        }
      })();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (activeTab === 'IN' && txReasonCode === TX_REASON.PURCHASE) {
      void loadReceiptRequests();
    }
  }, [activeTab, txReasonCode]);

  useEffect(() => {
    if (activeTab !== 'IN' || txReasonCode !== TX_REASON.PURCHASE || !initialRequestId) return;
    const timer = window.setTimeout(() => {
      void verifyRequest(initialRequestId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeTab, txReasonCode, initialRequestId]);

  useEffect(() => {
    if (!initialOrderId) return;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await procurementApi.getOrder(initialOrderId);
          setReceiptOrderId(initialOrderId);
          setHeader({
            id: response.header.id,
            title: response.header.title || response.header.id,
            plantId: response.header.plantId,
            warehouseId: response.header.warehouseId,
            requesterId: response.header.requesterId,
            departmentId: response.header.departmentId,
            status: response.header.status,
            procStatus: response.header.procStatus,
          });
          setWarehouseId(response.header.warehouseId || '');
          setLines(response.items.map((item) => {
            const qty = Number(item.qty);
            const receivedQty = Number(item.receivedQty || 0);
            return { itemNo: item.itemNo!, inventoryId: item.inventoryId, unit: item.unit, remarks: item.remarks, qty, receivedQty, remaining: Math.max(0, qty - receivedQty), inputQty: Math.max(0, qty - receivedQty), unitPrice: 0 };
          }));
        } catch (error: unknown) {
          toastApiError(error, '구매오더를 불러오지 못했습니다.');
        }
      })();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [initialOrderId]);

  const filteredRequests = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase();
    if (!keyword) return receiptRequests;
    return receiptRequests.filter((request) => {
      if (searchType === 'id') return request.id.toLowerCase().includes(keyword);
      if (searchType === 'title') return (request.title || '').toLowerCase().includes(keyword);
      return request.requesterId.toLowerCase().includes(keyword);
    });
  }, [receiptRequests, searchType, searchValue]);

  async function loadReceiptRequests() {
    try {
      setReceiptRequests(await procurementApi.getReceiptRequests());
    } catch (error: unknown) {
      toastApiError(error, '입고 대상 구매요청을 불러오지 못했습니다.');
    }
  }

  function resetTxGrid() {
    setTxGrid(createEmptyGrid(warehouses, inventories));
    setTxDate(todayLocal());
  }

  function allowedReasons(tab: ProcessingTab): readonly TxReason[] {
    return TX_REASON_OPTIONS
      .filter((reason) => (TX_REASON_BY_TYPE[tab] || []).includes(reason.id))
      .map((reason) => reason.id);
  }

  function handleAddGridRow() {
    setTxGrid((current) => [
      ...current,
      {
        warehouseId: warehouses[0]?.id || '',
        inventoryId: inventories[0]?.id || '',
        qty: 1,
        unitPrice: 0,
        targetWarehouseId: warehouses[1]?.id || '',
      },
    ]);
  }

  function handleGridChange<K extends keyof TxGridItem>(index: number, field: K, value: TxGridItem[K]) {
    setTxGrid((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  }

  function handleRemoveGridRow(index: number) {
    setTxGrid((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  function handleTabChange(tab: ProcessingTab) {
    setActiveTab(tab);
    setHeader(null);
    setLines([]);
    setReceiptOrderId(null);
    setSearchValue('');
    setTxReasonCode((current) => {
      if (tab === 'IN' && current === TX_REASON.PURCHASE) return current;
      const allowed = allowedReasons(tab);
      return allowed.includes(current) ? current : defaultReason(tab);
    });
    setTxGrid(createEmptyGrid(warehouses, inventories));
    setTxDate(todayLocal());
    setPrTransferMode(false);
  }

  async function handlePrTransferModeChange(enabled: boolean) {
    setPrTransferMode(enabled);
    setHeader(null);
    setLines([]);
    if (enabled) await loadReceiptRequests();
  }

  async function handlePrTransferSubmit() {
    if (!header || !txGrid[0]?.warehouseId || !header.warehouseId) {
      toast.error('PR과 출발·도착 창고를 확인하세요.');
      return;
    }
    const transferLines = lines
      .filter((line) => line.inputQty > 0)
      .map((line) => ({ prId: header.id, prItemNo: line.itemNo, qty: line.inputQty }));
    if (!transferLines.length) {
      toast.error('이송수량을 입력하세요.');
      return;
    }
    if (lines.some((line) => line.inputQty > line.remaining)) {
      toast.error('PR 잔여수량을 초과하여 이송할 수 없습니다.');
      return;
    }
    setIsLoading(true);
    try {
      await procurementApi.transferPurchaseRequests({
        sourceWarehouseId: txGrid[0].warehouseId,
        targetWarehouseId: header.warehouseId,
        txDate,
        lines: transferLines,
      });
      toast.success('PR 연계 이송전표가 생성되었습니다.');
      setHeader(null);
      setLines([]);
      await loadReceiptRequests();
    } catch (error: unknown) {
      toastApiError(error, 'PR 연계 이송에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveTransactions() {
    if (txGrid.length === 0) return;
    if (!txDate) {
      toast.error('처리일을 입력하세요.');
      return;
    }
    setIsLoading(true);
    try {
      await stockApi.process({
        items: txGrid.map((item) => ({
          ...item,
          txTypeCode: activeTab,
          txReasonCode,
          txDate,
        })),
      });
      toast.success('재고 처리가 완료되었습니다.');
      resetTxGrid();
    } catch (error: unknown) {
      toastApiError(error, '재고 처리에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }

  async function verifyRequest(selectedId: string) {
    const id = selectedId.trim();
    try {
      const response = await procurementApi.getReceiptRequest(id);
      const request = response.header;
      setHeader(request);
      setWarehouseId(request.warehouseId);
      setLines(response.items.map((item) => {
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
    } catch (error: unknown) {
      setHeader(null);
      setLines([]);
      toast.error(error instanceof Error
        ? error.message
        : getApiErrorMessage(error, '구매요청 번호를 확인할 수 없습니다.'));
    }
  }

  async function handleReceiptSubmit() {
    if (!header || !warehouseId) {
      toast.error('구매요청과 입고 창고를 확인하세요.');
      return;
    }
    const receiptLines = lines
      .filter((line) => line.inputQty > 0)
      .map((line) => ({
        itemNo: line.itemNo,
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
    setIsLoading(true);
    try {
      if (receiptOrderId) {
        await procurementApi.receiveOrder({ orderId: receiptOrderId, warehouseId, txDate, lines: receiptLines });
      } else {
        await procurementApi.receive({ requestId: header.id, warehouseId, txDate, lines: receiptLines });
      }
      toast.success('구매입고가 처리되었습니다.');
      setHeader(null);
      setLines([]);
      await loadReceiptRequests();
    } catch (error: unknown) {
      toastApiError(error, '구매입고 처리에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRunClosing() {
    if (!closingYm || closingYm.length !== 6) {
      toast.error('마감 년월 6자리(YYYYMM)를 확인해주세요.');
      return;
    }
    setIsLoading(true);
    try {
      await stockApi.closeMonth(closingYm);
      toast.success(`${closingYm.substring(0, 4)}년 ${closingYm.substring(4, 6)}월 재고 마감이 처리되었습니다.`);
      setIsClosingModalOpen(false);
    } catch (error: unknown) {
      toastApiError(error, '마감 처리 오류');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Layers size={24} className="text-blue-500" />
            재고처리
          </h1>
          <p className="text-xs text-slate-500 mt-1">입고, 출고, 이동, 조정과 구매연계 입고를 처리합니다.</p>
        </div>
        <div className="flex items-center gap-3">
          {canCreate && (
            <button onClick={() => setIsClosingModalOpen(true)} className="bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800 rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
              <Settings size={14} className="text-slate-500" />
              월 재고 마감
            </button>
          )}
          <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-lg">
            {(['IN', 'OUT', 'MOVE', 'ADJ'] as ProcessingTab[]).map((tab) => (
              <button key={tab} onClick={() => handleTabChange(tab)} className={`px-4 py-1.5 rounded-md text-xs font-semibold cursor-pointer border-0 ${activeTab === tab ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 bg-transparent'}`}>
                {tab === 'IN' ? '입고' : tab === 'OUT' ? '출고' : tab === 'MOVE' ? '이동' : '조정'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div><span className="text-slate-500 block mb-0.5">처리구분</span><span className="font-semibold text-slate-200">{activeTab === 'IN' ? '입고' : activeTab === 'OUT' ? '출고' : activeTab === 'MOVE' ? '이동' : '조정'}</span></div>
          <div><span className="text-slate-500 block mb-0.5">작성자</span><span className="text-slate-300">{user?.id || '-'} / {user?.name || '-'}</span></div>
          <label>
            <span className="text-slate-500 block mb-1">처리일</span>
            <input type="date" value={txDate} onChange={(event) => setTxDate(event.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 outline-none focus:border-blue-500" />
          </label>
          <label>
            <span className="text-slate-500 block mb-1">상세사유</span>
            <select value={txReasonCode} onChange={(event) => setTxReasonCode(event.target.value as TxReason)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 outline-none focus:border-blue-500">
              {TX_REASON_OPTIONS.filter((reason) => (TX_REASON_BY_TYPE[activeTab] || []).includes(reason.id)).map((reason) => (
                <option key={reason.id} value={reason.id}>{reason.name}</option>
              ))}
            </select>
          </label>
        </div>

        {activeTab === 'IN' && txReasonCode === TX_REASON.PURCHASE ? (
          <div className="space-y-5">
            {header && (
              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-6">
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
                <div className="border border-slate-800 rounded-xl overflow-hidden mt-5">
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
                        <tr key={line.itemNo} className="border-t border-slate-800 text-slate-300">
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
                <div className="flex justify-end mt-4">
                  {canCreate && <button disabled={isLoading} onClick={() => void handleReceiptSubmit()} className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-5 py-2 text-xs font-semibold flex items-center gap-1.5 border-0 cursor-pointer disabled:opacity-50">
                    <PackageCheck size={14} /> 입고 처리
                  </button>}
                </div>
              </div>
            )}

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h2 className="text-sm font-bold text-slate-200 mb-4">입고 대상 구매요청 목록</h2>
              <div className="mb-4 flex gap-2">
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
                        <td className="p-3">{usersList.find((candidate) => candidate.id === request.requesterId)?.name || request.requesterId}</td>
                        <td className="p-3 text-right font-mono">{formatQty(request.requestedQty)}</td>
                        <td className="p-3 text-right font-mono text-amber-400">{formatQty(request.remainingQty)}</td>
                        <td className="p-3"><ListBadge>{getCommonStatusLabel(request.status)}</ListBadge></td>
                        <td className="p-3 text-right">
                          <ListIconButton onClick={() => void verifyRequest(request.id)} label={`${request.id} 입고`} icon={PackageCheck} tone="accent" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {activeTab === 'MOVE' && (
              <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-3">
                <div>
                  <p className="text-xs font-semibold text-slate-300">PR 연계 이동</p>
                  <p className="mt-1 text-[11px] text-slate-500">PR을 선택하면 이동수량이 PR 수령수량과 MOVE allocation에 반영됩니다.</p>
                </div>
                <button type="button" onClick={() => void handlePrTransferModeChange(!prTransferMode)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${prTransferMode ? 'bg-blue-600 text-white' : 'border border-slate-700 bg-slate-900 text-slate-400'}`}>
                  {prTransferMode ? 'PR 연계 사용 중' : '일반 이동'}
                </button>
              </div>
            )}
            {activeTab === 'MOVE' && prTransferMode && (
              <div className="rounded-xl border border-blue-900/60 bg-slate-950/40 p-4 space-y-4">
                <label className="block text-xs text-slate-400">
                  <span className="mb-1 block">구매요청</span>
                  <select value={header?.id || ''} onChange={(event) => void verifyRequest(event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200">
                    <option value="">선택</option>
                    {receiptRequests.map((request) => <option key={request.id} value={request.id}>{request.id} — {request.title}</option>)}
                  </select>
                </label>
                {header && (
                  <>
                    <div className="grid grid-cols-2 gap-3 text-xs"><Info label="요청창고" value={header.warehouseId} /><Info label="출발창고" value={txGrid[0]?.warehouseId || '-'} /></div>
                    <div className="overflow-hidden rounded-xl border border-slate-800">
                      <table className="w-full text-xs"><thead className="bg-slate-950 text-slate-400"><tr><th className="p-3 text-left">자재</th><th className="p-3 text-right">요청</th><th className="p-3 text-right">기수령</th><th className="p-3 text-right">잔여</th><th className="p-3 text-right">이송</th></tr></thead><tbody>
                        {lines.map((line, index) => <tr key={line.itemNo} className="border-t border-slate-800 text-slate-300"><td className="p-3">{line.inventoryId}</td><td className="p-3 text-right">{line.qty}</td><td className="p-3 text-right">{line.receivedQty}</td><td className="p-3 text-right text-amber-400">{line.remaining}</td><td className="p-2"><input type="number" min="0" max={line.remaining} value={line.inputQty} onChange={(event) => setLines(lines.map((item, lineIndex) => lineIndex === index ? { ...item, inputQty: Number(event.target.value) } : item))} className="w-full rounded border border-slate-800 bg-slate-950 px-2 py-1.5 text-right" /></td></tr>)}
                      </tbody></table>
                    </div>
                    <div className="flex justify-end"><button disabled={isLoading} onClick={() => void handlePrTransferSubmit()} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">PR 연계 이송전표 생성</button></div>
                  </>
                )}
              </div>
            )}
            {txReasonCode === TX_REASON.PLANT_TRANSFER && (
              <p className="text-xs text-amber-400">플랜트 간 이동은 출고와 입고를 별도 전표로 처리합니다. 상세사유와 참조전표 번호를 함께 기록하세요.</p>
            )}
            {!prTransferMode && <div className="flex justify-end items-center">
              <button type="button" onClick={handleAddGridRow} className="text-blue-400 text-xs font-semibold bg-transparent border-0 cursor-pointer flex items-center gap-1">
                <Plus size={12} />
                <span>행 추가</span>
              </button>
            </div>}
            {!prTransferMode && <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/20">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 select-none">
                    <th className="p-3 font-semibold w-40">창고</th>
                    <th className="p-3 font-semibold w-48">자재</th>
                    <th className="p-3 font-semibold w-24 text-right">수량</th>
                    <th className="p-3 font-semibold w-32 text-right">단가</th>
                    <th className="p-3 font-semibold w-40">대상 창고</th>
                    <th className="p-3 font-semibold w-12 text-center">삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {txGrid.map((row, index) => (
                    <tr key={index} className="border-b border-slate-900 hover:bg-slate-900/30 text-slate-300">
                      <td className="p-2">
                        <select value={row.warehouseId} onChange={(event) => handleGridChange(index, 'warehouseId', event.target.value)} className="w-full bg-slate-950 border border-slate-850 focus:border-blue-500 rounded py-1.5 px-2 text-xs text-slate-300 outline-none">
                          {warehouses.map((warehouse) => (
                            <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <select value={row.inventoryId} onChange={(event) => handleGridChange(index, 'inventoryId', event.target.value)} className="w-full bg-slate-950 border border-slate-850 focus:border-blue-500 rounded py-1.5 px-2 text-xs text-slate-300 outline-none">
                          {inventories.map((inventory) => (
                            <option key={inventory.id} value={inventory.id}>{inventory.name} [{inventory.id}]</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <input type="number" min="0.0001" step="any" value={row.qty} onChange={(event) => handleGridChange(index, 'qty', parseFloat(event.target.value) || 0)} className="w-full bg-slate-950 border border-slate-850 focus:border-blue-500 rounded py-1.5 px-2 text-right text-xs text-slate-200 outline-none" />
                      </td>
                      <td className="p-2">
                        <input type="number" min="0" disabled={activeTab === 'OUT' || activeTab === 'MOVE'} value={row.unitPrice} onChange={(event) => handleGridChange(index, 'unitPrice', parseInt(event.target.value, 10) || 0)} className="w-full bg-slate-950 border border-slate-850 focus:border-blue-500 rounded py-1.5 px-2 text-right text-xs text-slate-200 outline-none disabled:opacity-30" />
                      </td>
                      <td className="p-2">
                        <select disabled={activeTab !== 'MOVE'} value={row.targetWarehouseId} onChange={(event) => handleGridChange(index, 'targetWarehouseId', event.target.value)} className="w-full bg-slate-950 border border-slate-850 focus:border-blue-500 rounded py-1.5 px-2 text-xs text-slate-300 outline-none disabled:opacity-30">
                          {warehouses.filter((warehouse) => {
                            const source = warehouses.find((candidate) => candidate.id === row.warehouseId);
                            return warehouse.id !== row.warehouseId && warehouse.plantId === source?.plantId;
                          }).map((warehouse) => (
                            <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2 text-center">
                        <button type="button" onClick={() => handleRemoveGridRow(index)} className="p-1 hover:bg-slate-850 rounded text-slate-500 hover:text-rose-400 transition-colors border-0 cursor-pointer bg-transparent">
                          <Trash size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
            {!prTransferMode && <div className="flex justify-end">
              {canCreate && (
                <button onClick={() => void handleSaveTransactions()} disabled={isLoading || txGrid.length === 0} className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 px-4 text-xs font-semibold transition-colors cursor-pointer border-0 disabled:opacity-50">
                  저장
                </button>
              )}
            </div>}
          </div>
        )}
      </div>

      {isClosingModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-200 flex items-center gap-1.5">
                <Settings size={18} className="text-blue-500" />
                월 재고 마감 작업 실행
              </h2>
              <button onClick={() => setIsClosingModalOpen(false)} className="text-slate-500 hover:text-slate-300 border-0 cursor-pointer bg-transparent">닫기</button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-400">선택한 마감 대상 년월의 재고 수불을 최종 확정합니다.</p>
              <div>
                <label className="block text-slate-500 mb-1.5">마감 대상 년월 (6자리)</label>
                <input type="text" maxLength={6} placeholder="예: 202605" value={closingYm} onChange={(event) => setClosingYm(event.target.value)} className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2.5 px-3 text-slate-200 outline-none text-center font-mono font-bold text-sm tracking-widest" />
              </div>
            </div>
            <div className="p-6 border-t border-slate-800 flex justify-end gap-2">
              <button onClick={() => setIsClosingModalOpen(false)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg py-2 px-4 border-0 cursor-pointer">취소</button>
              <button onClick={() => void handleRunClosing()} disabled={isLoading} className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 px-4 border-0 cursor-pointer disabled:opacity-50">마감 실행</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function defaultReason(tab: ProcessingTab): TxReason {
  if (tab === 'MOVE') return TX_REASON.TRANSFER;
  if (tab === 'ADJ') return TX_REASON.STOCKTAKING;
  return TX_REASON.GENERAL;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><span className="block text-slate-500 mb-1">{label}</span><strong className="text-slate-200">{value}</strong></div>;
}

function formatQty(value: string | number): string {
  return formatQuantity(value);
}
