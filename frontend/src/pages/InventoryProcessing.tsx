import { useCallback, useEffect, useState } from 'react';
import { Layers, Plus, Settings, Trash } from 'lucide-react';
import { toast } from 'sonner';
import { stockApi } from '../features/stock/stock.api';
import type { StockProcessingItem as TxGridItem, ReceivablePurchaseOrder } from '../features/stock/stock.types';
import { mdmLookupApi } from '../features/mdm/reference.api';
import { masterLookupApi } from '../features/master/master-reference.api';
import type { InventoryReference } from '../features/master/master-reference.types';
import type { Warehouse } from '../features/mdm/mdm.types';
import { useAuthStore } from '../store/useAuthStore';
import { hasModuleCreate } from '../utils/moduleAccess';
import { APP_MODULE } from '../constants/module';
import {
  TX_REASON,
  TX_REASON_BY_TYPE,
  TX_REASON_OPTIONS,
  type TxReason,
} from '../constants/status';
import { todayLocal, thisMonthLocal } from '../utils/datetime';
import { toastApiError } from '../utils/apiError';
import InventorySelector from '../features/master/components/InventorySelector';
import BoundedSelect from '../components/BoundedSelect';
import Modal from '../components/Modal';

type ProcessingTab = 'IN' | 'OUT' | 'MOVE' | 'ADJ' | 'CANCEL';

interface InventoryProcessingProps {
  initialTab?: ProcessingTab;
  initialReason?: TxReason;
}

function createEmptyGrid(warehouses: Warehouse[], inventories: InventoryReference[]): TxGridItem[] {
  return [{
    warehouseId: warehouses[0]?.id || '',
    inventoryId: inventories[0]?.id || '',
    qty: 1,
    unitPrice: 0,
    targetWarehouseId: warehouses[1]?.id || '',
  }];
}

export default function InventoryProcessing({
  initialTab = 'IN',
  initialReason,
}: InventoryProcessingProps) {
  const user = useAuthStore((state) => state.user);
  const activePlantId = useAuthStore((state) => state.activePlantId);
  const canCreate = hasModuleCreate(user?.moduleAccess, APP_MODULE.STK);
  const [activeTab, setActiveTab] = useState<ProcessingTab>(initialTab);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [inventories, setInventories] = useState<InventoryReference[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<ReceivablePurchaseOrder[]>([]);
  const [selectedPurchaseOrderId, setSelectedPurchaseOrderId] = useState('');
  const [txGrid, setTxGrid] = useState<TxGridItem[]>([]);
  const [txDate, setTxDate] = useState(todayLocal());
  const [txReasonCode, setTxReasonCode] = useState<TxReason>(initialReason ?? defaultReason(initialTab));
  const [closingYm, setClosingYm] = useState(thisMonthLocal());
  const [isLoading, setIsLoading] = useState(false);
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  const [originalDocumentId, setOriginalDocumentId] = useState('');

  const loadReferences = useCallback(async () => {
    try {
      const [loadedWarehouses, loadedInventories] = await Promise.all([
        mdmLookupApi.getWarehouseOptions(activePlantId),
        masterLookupApi.getInventories(),
      ]);
      const loadedPurchaseOrders = await stockApi.getReceivableOrders(activePlantId);
      setWarehouses(loadedWarehouses);
      setInventories(loadedInventories);
      setPurchaseOrders(loadedPurchaseOrders);
      setTxGrid(createEmptyGrid(loadedWarehouses, loadedInventories));
    } catch (error: unknown) {
      toastApiError(error, '재고처리 기준정보를 불러오지 못했습니다.');
    }
  }, [activePlantId]);

  useEffect(() => {
    const run = async () => {
      await loadReferences();
    };
    void run();
  }, [loadReferences]);

  function allowedReasons(tab: ProcessingTab): readonly TxReason[] {
    return TX_REASON_OPTIONS
      .filter((reason) => (TX_REASON_BY_TYPE[tab] || []).includes(reason.id))
      .map((reason) => reason.id);
  }

  function resetTxGrid() {
    setTxGrid(createEmptyGrid(warehouses, inventories));
    setTxDate(todayLocal());
  }

  function handleTabChange(tab: ProcessingTab) {
    setActiveTab(tab);
    const allowed = allowedReasons(tab);
    setTxReasonCode(allowed.includes(txReasonCode) ? txReasonCode : defaultReason(tab));
    setTxGrid(createEmptyGrid(warehouses, inventories));
    setTxDate(todayLocal());
    setOriginalDocumentId('');
    if (tab !== 'IN') setSelectedPurchaseOrderId('');
  }

  async function handlePurchaseOrderChange(orderId: string) {
    setSelectedPurchaseOrderId(orderId);
    if (!orderId) {
      setTxReasonCode(defaultReason('IN'));
      setTxGrid(createEmptyGrid(warehouses, inventories));
      return;
    }
    setIsLoading(true);
    try {
      const detail = await stockApi.getReceivableOrderDetail(orderId, activePlantId);
      setTxReasonCode(TX_REASON.PURCHASE);
      setTxGrid(detail.items.map((item) => ({
        warehouseId: detail.header.warehouseId || warehouses[0]?.id || '',
        inventoryId: item.inventoryId,
        qty: Number(item.qty),
        unitPrice: 0,
        targetWarehouseId: '',
        refNo: detail.header.id,
        refModule: 'POR',
        refLineNo: item.itemNo?.toString(),
      })));
    } catch (error: unknown) {
      toastApiError(error, '구매오더 상세를 불러오지 못했습니다.');
      setSelectedPurchaseOrderId('');
    } finally {
      setIsLoading(false);
    }
  }

  function handleGridChange<K extends keyof TxGridItem>(index: number, field: K, value: TxGridItem[K]) {
    setTxGrid((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row));
  }

  function handleAddGridRow() {
    setTxGrid((current) => [...current, ...createEmptyGrid(warehouses, inventories)]);
  }

  function handleRemoveGridRow(index: number) {
    setTxGrid((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  async function handleSaveTransactions() {
    if (!txGrid.length) return;
    if (!txDate) {
      toast.error('처리일을 입력하세요.');
      return;
    }
    if (txGrid.some((item) => item.qty <= 0)) {
      toast.error('수량은 0보다 커야 합니다.');
      return;
    }
    if (activeTab === 'MOVE' && txGrid.some((item) => !item.targetWarehouseId || item.targetWarehouseId === item.warehouseId)) {
      toast.error('이동 출발·도착 창고를 확인하세요.');
      return;
    }
    setIsLoading(true);
    try {
      await stockApi.process({
        items: txGrid.map((item) => ({ ...item, txTypeCode: activeTab, txReasonCode, txDate })),
      });
      toast.success('재고 처리가 완료되었습니다.');
      resetTxGrid();
    } catch (error: unknown) {
      toastApiError(error, '재고 처리에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCancelDocument() {
    const documentId = originalDocumentId.trim();
    if (!documentId) {
      toast.error('원본 재고전표번호를 입력하세요.');
      return;
    }
    setIsLoading(true);
    try {
      const reverseId = await stockApi.cancelDocument(documentId);
      toast.success(`취소전표 ${reverseId}가 생성되었습니다.`);
      setOriginalDocumentId('');
    } catch (error: unknown) {
      toastApiError(error, '재고전표 취소에 실패했습니다.');
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

  const typeLabel = activeTab === 'IN' ? '입고' : activeTab === 'OUT' ? '출고' : activeTab === 'MOVE' ? '이동' : activeTab === 'ADJ' ? '조정' : '취소';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2"><Layers size={24} className="text-blue-500" />자재 수불관리</h1>
          <p className="text-xs text-slate-500 mt-1">입고·출고·이동·조정 전표를 처리합니다.</p>
        </div>
        <div className="flex items-center gap-3">
          {canCreate && <button onClick={() => setIsClosingModalOpen(true)} className="bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800 rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"><Settings size={14} />월 재고 마감</button>}
          <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-lg">
            {(['IN', 'OUT', 'MOVE', 'ADJ', 'CANCEL'] as ProcessingTab[]).map((tab) => (
              <button key={tab} onClick={() => handleTabChange(tab)} className={`px-4 py-1.5 rounded-md text-xs font-semibold cursor-pointer border-0 ${activeTab === tab ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 bg-transparent'}`}>
                {tab === 'IN' ? '입고' : tab === 'OUT' ? '출고' : tab === 'MOVE' ? '이동' : tab === 'ADJ' ? '조정' : '취소'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div><span className="text-slate-500 block mb-0.5">처리구분</span><span className="font-semibold text-slate-200">{typeLabel}</span></div>
          <div><span className="text-slate-500 block mb-0.5">작성자</span><span className="text-slate-300">{user?.id || '-'} / {user?.name || '-'}</span></div>
          <label><span className="text-slate-500 block mb-1">처리일</span><input type="date" value={txDate} onChange={(event) => setTxDate(event.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200" /></label>
          <label><span className="text-slate-500 block mb-1">상세사유</span><select value={txReasonCode} onChange={(event) => setTxReasonCode(event.target.value as TxReason)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200">{TX_REASON_OPTIONS.filter((reason) => (TX_REASON_BY_TYPE[activeTab] || []).includes(reason.id)).map((reason) => <option key={reason.id} value={reason.id}>{reason.name}</option>)}</select></label>
        </div>

        {activeTab === 'CANCEL' ? <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-6 space-y-4"><label className="block text-xs text-slate-400">원본 재고전표번호<input value={originalDocumentId} onChange={(event) => setOriginalDocumentId(event.target.value)} placeholder="STK 전표번호를 입력하세요" className="mt-2 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200" /></label><p className="text-xs text-slate-500">원본 전표 이후 후속 거래가 없는 경우에만 원본 전표의 처리일로 반전됩니다.</p><div className="flex justify-end"><button onClick={() => void handleCancelDocument()} disabled={isLoading} className="bg-blue-600 text-white rounded-lg py-2 px-4 text-xs font-semibold border-0 cursor-pointer disabled:opacity-50">취소전표 생성</button></div></div> : <>
        {activeTab === 'IN' && <div className="mb-4 flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs"><span className="shrink-0 text-slate-400">구매오더 입고</span><BoundedSelect value={selectedPurchaseOrderId} onChange={(value) => void handlePurchaseOrderChange(value)} options={purchaseOrders.map((order) => ({ value: order.id, label: `${order.id} / ${order.title || '-'} / ${order.status}` }))} placeholder="일반 입고 또는 구매오더 선택" className="min-w-[320px]" /></div>}
        <div className="flex justify-end"><button type="button" onClick={handleAddGridRow} className="text-blue-400 text-xs font-semibold bg-transparent border-0 cursor-pointer flex items-center gap-1"><Plus size={12} />행 추가</button></div>
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/20">
          <table className="w-full text-left text-xs border-collapse">
            <thead><tr className="bg-slate-900 text-slate-400 border-b border-slate-800"><th className="p-3">창고</th><th className="p-3">자재</th><th className="p-3 text-right">수량</th><th className="p-3 text-right">단가</th><th className="p-3">대상 창고</th><th className="p-3">삭제</th></tr></thead>
            <tbody>{txGrid.map((row, index) => <tr key={index} className="border-b border-slate-900 text-slate-300">
              <td className="p-2"><select value={row.warehouseId} onChange={(event) => handleGridChange(index, 'warehouseId', event.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded py-1.5 px-2 text-xs">{warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></td>
              <td className="p-2"><InventorySelector value={row.inventoryId} placeholder="자재번호 또는 자재명 검색" onChange={(id) => handleGridChange(index, 'inventoryId', id)} /></td>
              <td className="p-2"><input type="number" min="0.0001" step="any" value={row.qty} onChange={(event) => handleGridChange(index, 'qty', parseFloat(event.target.value) || 0)} className="w-full bg-slate-950 border border-slate-800 rounded py-1.5 px-2 text-right text-xs" /></td>
              <td className="p-2"><input type="number" min="0" disabled={activeTab === 'OUT' || activeTab === 'MOVE'} value={row.unitPrice} onChange={(event) => handleGridChange(index, 'unitPrice', parseFloat(event.target.value) || 0)} className="w-full bg-slate-950 border border-slate-800 rounded py-1.5 px-2 text-right text-xs disabled:opacity-30" /></td>
              <td className="p-2"><select disabled={activeTab !== 'MOVE'} value={row.targetWarehouseId} onChange={(event) => handleGridChange(index, 'targetWarehouseId', event.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded py-1.5 px-2 text-xs disabled:opacity-30"><option value="">선택</option>{warehouses.filter((warehouse) => warehouse.id !== row.warehouseId).map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></td>
              <td className="p-2 text-center"><button type="button" onClick={() => handleRemoveGridRow(index)} className="p-1 text-slate-500 hover:text-rose-400 border-0 cursor-pointer bg-transparent"><Trash size={14} /></button></td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="flex justify-end">{canCreate && <button onClick={() => void handleSaveTransactions()} disabled={isLoading || !txGrid.length} className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 px-4 text-xs font-semibold cursor-pointer border-0 disabled:opacity-50">저장</button>}</div></>}
      </div>

      {isClosingModalOpen && (
        <Modal
          title="월 재고 마감 작업 실행"
          onClose={() => setIsClosingModalOpen(false)}
          className="max-w-md"
          footer={(
            <>
              <button type="button" onClick={() => setIsClosingModalOpen(false)} className="cursor-pointer rounded-lg border-0 bg-slate-800 px-4 py-2 text-slate-300">취소</button>
              <button type="button" onClick={() => void handleRunClosing()} disabled={isLoading} className="cursor-pointer rounded-lg border-0 bg-blue-600 px-4 py-2 text-white disabled:opacity-50">마감 실행</button>
            </>
          )}
        >
          <input type="text" maxLength={6} placeholder="예: 202605" value={closingYm} onChange={(event) => setClosingYm(event.target.value)} className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5 text-center text-slate-200" />
        </Modal>
      )}
    </div>
  );
}

function defaultReason(tab: ProcessingTab): TxReason {
  if (tab === 'MOVE') return TX_REASON.TRANSFER;
  if (tab === 'ADJ') return TX_REASON.STOCKTAKING;
  return TX_REASON.GENERAL;
}
