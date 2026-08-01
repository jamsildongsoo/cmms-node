import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Download, Layers, Printer } from 'lucide-react';
import { toast } from 'sonner';
import PrintHeader from '../components/PrintHeader';
import PrintWindowLayout from '../components/PrintWindowLayout';
import SlipPrint from '../components/SlipPrint';
import { openListPrint } from '../utils/listPrint';
import { openPrintWindow } from '../utils/printWindow';
import { formatDateOnly, formatDateTimeSeconds } from '../utils/datetime';
import { formatAmount, formatMoney, formatQuantity } from '../utils/number';
import { toastApiError } from '../utils/apiError';
import { useAuthStore } from '../store/useAuthStore';
import {
  getTxReasonLabel,
  getTxTypeLabel,
} from '../constants/status';
import type {
  StockHistory,
  StockStatus,
} from '../features/stock/stock.types';
import { stockApi } from '../features/stock/stock.api';
import { referenceApi } from '../features/mdm/reference.api';
import { masterReferenceApi } from '../features/master/master-reference.api';
import type { InventoryReference } from '../features/master/master-reference.types';
import type { Department, ReferenceUser, Warehouse } from '../features/mdm/mdm.types';

export default function InventoryOverview() {
  const user = useAuthStore((state) => state.user);
  const [activeTab, setActiveTab] = useState<'status' | 'history'>('status');
  const [statusList, setStatusList] = useState<StockStatus[]>([]);
  const [historyList, setHistoryList] = useState<StockHistory[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [depts, setDepts] = useState<Department[]>([]);
  const [inventories, setInventories] = useState<InventoryReference[]>([]);
  const [usersList, setUsersList] = useState<ReferenceUser[]>([]);
  const [searchType, setSearchType] = useState<'id' | 'title' | 'owner'>('id');
  const [searchValue, setSearchValue] = useState('');

  async function loadData() {
    try {
      const [loadedStatus, loadedHistory, loadedWarehouses, loadedDepts, loadedInventories, loadedUsers] = await Promise.all([
        stockApi.getStatus(),
        stockApi.getHistory(),
        referenceApi.getWarehouseOptions(),
        referenceApi.getDepartmentOptions(),
        masterReferenceApi.getInventories(),
        referenceApi.getUserOptions(),
      ]);
      setStatusList(loadedStatus);
      setHistoryList(loadedHistory.map((history) => ({
        ...history,
        txDate: formatDateOnly(history.txDate),
      })));
      setWarehouses(loadedWarehouses);
      setDepts(loadedDepts);
      setInventories(loadedInventories);
      setUsersList(loadedUsers);
    } catch (error: unknown) {
      toastApiError(error, '재고 조회 데이터를 불러오지 못했습니다.');
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadData(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const filteredStatusList = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase();
    if (!keyword) return statusList;
    return statusList.filter((status) => {
      const warehouse = warehouses.find((candidate) => candidate.id === status.warehouseId);
      const inventory = inventories.find((candidate) => candidate.id === status.inventoryId);
      if (searchType === 'id') return `${status.inventoryId} ${warehouse?.name || status.warehouseId}`.toLowerCase().includes(keyword);
      if (searchType === 'title') return `${inventory?.name || ''} ${status.inventoryId}`.toLowerCase().includes(keyword);
      return `${warehouse?.name || ''} ${status.warehouseId}`.toLowerCase().includes(keyword);
    });
  }, [inventories, searchType, searchValue, statusList, warehouses]);

  const filteredHistoryList = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase();
    if (!keyword) return historyList;
    return historyList.filter((history) => {
      if (searchType === 'id') return `${history.docNo || ''} ${history.historyNo}`.toLowerCase().includes(keyword);
      if (searchType === 'title') {
        const inventory = inventories.find((candidate) => candidate.id === history.inventoryId);
        return `${inventory?.name || ''} ${history.inventoryId}`.toLowerCase().includes(keyword);
      }
      const owner = usersList.find((candidate) => candidate.id === history.userId);
      return `${history.userId} ${owner?.name || ''}`.toLowerCase().includes(keyword);
    });
  }, [historyList, inventories, searchType, searchValue, usersList]);

  function getSlipTitle(txTypeCode: string) {
    if (txTypeCode === 'IN') return '입고증';
    if (txTypeCode === 'OUT') return '출고증';
    if (txTypeCode === 'ADJ') return '재고조정전표';
    return '이동전표';
  }

  function getSlipCategory(txTypeCode: string) {
    if (txTypeCode === 'IN') return 'IN';
    if (txTypeCode === 'OUT') return 'OUT';
    if (txTypeCode === 'ADJ') return 'ADJ';
    return 'MOVE';
  }

  function getTxDisplayLabel(type: string, reason?: string) {
    return `${getTxTypeLabel(type)}-${getTxReasonLabel(reason)}`;
  }

  function openSlipPrint(slip: StockHistory) {
    const printTarget = openPrintWindow({
      title: `${getSlipTitle(slip.txTypeCode)} 출력`,
      rootId: 'inventory-slip-print-root',
    });
    if (!printTarget) {
      toast.error('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.');
      return;
    }
    const { printWindow, container } = printTarget;
    const manager = usersList.find((candidate) => candidate.id === slip.userId);
    const departmentName = depts.find((dept) => dept.id === manager?.departmentId)?.name
      || manager?.departmentId
      || '-';
    const slipCategory = getSlipCategory(slip.txTypeCode);
    const slipItems = historyList.filter((history) => {
      const sameDocument = slip.docNo
        ? history.docNo === slip.docNo
        : history.historyNo === slip.historyNo;
      return sameDocument && getSlipCategory(history.txTypeCode) === slipCategory;
    });
    createRoot(container).render(
      <PrintWindowLayout printWindow={printWindow} contentClassName="max-w-[180mm]">
        <SlipPrint
          txTypeCode={slip.txTypeCode}
          docNo={slip.docNo}
          txDate={slip.txDate}
          departmentName={departmentName}
          managerName={manager ? `${manager.id} / ${manager.name}` : slip.userId}
          items={slipItems.map((item) => {
            const inventory = inventories.find((candidate) => candidate.id === item.inventoryId);
            return {
              warehouseName: warehouses.find((candidate) => candidate.id === item.warehouseId)?.name || item.warehouseId,
              inventoryId: item.inventoryId,
              inventoryName: inventory?.name || '-',
              unit: inventory?.unit,
              qty: item.qty,
            };
          })}
        />
      </PrintWindowLayout>,
    );
    printWindow.focus();
  }

  function exportStatusCsv() {
    if (filteredStatusList.length === 0) return;
    const headers = ['창고', '자재코드', '자재명', '단위', '수량', '금액', '평균단가'];
    const rows = filteredStatusList.map((status) => {
      const inventory = inventories.find((item) => item.id === status.inventoryId);
      const warehouse = warehouses.find((item) => item.id === status.warehouseId);
      const average = status.qty > 0 ? status.amount / status.qty : 0;
      return [
        warehouse?.name || status.warehouseId,
        status.inventoryId,
        inventory?.name || '-',
        inventory?.unit || '-',
        status.qty,
        status.amount,
        average.toFixed(2),
      ];
    });
    downloadCsv('inventory_status.csv', headers, rows);
  }

  function exportHistoryCsv() {
    if (filteredHistoryList.length === 0) return;
    const headers = ['이력번호', '창고', '자재코드', '자재명', '유형', '수량', '단가', '금액', '처리일자', '담당자', '참조번호', '라인'];
    const rows = filteredHistoryList.map((history) => {
      const inventory = inventories.find((item) => item.id === history.inventoryId);
      const warehouse = warehouses.find((item) => item.id === history.warehouseId);
      return [
        history.historyNo,
        warehouse?.name || history.warehouseId,
        history.inventoryId,
        inventory?.name || '-',
        getTxDisplayLabel(history.txTypeCode, history.txReasonCode),
        history.qty,
        history.unitPrice,
        history.amount,
        history.txDate,
        usersList.find((candidate) => candidate.id === history.userId)?.name || history.userId,
        history.refNo || '-',
        history.refLineNo || '-',
      ];
    });
    downloadCsv('inventory_history.csv', headers, rows);
  }

  function handleListPrint() {
    const now = new Date();
    const common = {
      companyName: user?.companyName || user?.companyId || 'CMMS',
      printerName: user?.name || '-',
      printedAt: formatDateTimeSeconds(now),
    };
    const opened = activeTab === 'status'
      ? openListPrint({
          ...common,
          title: '재고현황',
          rows: filteredStatusList,
          getRowKey: (status) => `${status.warehouseId}:${status.inventoryId}`,
          columns: [
            { header: '보관 창고', render: (status) => warehouses.find((item) => item.id === status.warehouseId)?.name || status.warehouseId },
            { header: '자재코드', render: (status) => status.inventoryId, className: 'font-mono' },
            { header: '자재명', render: (status) => inventories.find((item) => item.id === status.inventoryId)?.name || '-' },
            { header: '단위', render: (status) => inventories.find((item) => item.id === status.inventoryId)?.unit || '-' },
            { header: '수량', render: (status) => formatQuantity(status.qty), className: 'text-right font-mono' },
            { header: '평균단가', render: (status) => formatAmount(status.qty > 0 ? status.amount / status.qty : 0), className: 'text-right font-mono' },
            { header: '평가금액', render: (status) => formatAmount(status.amount), className: 'text-right font-mono' },
          ],
        })
      : openListPrint({
          ...common,
          title: '재고이력',
          rows: filteredHistoryList,
          getRowKey: (history) => `${history.warehouseId}:${history.historyNo}`,
          columns: [
            { header: '전표번호', render: (history) => history.docNo || history.historyNo, className: 'font-mono' },
            { header: '창고', render: (history) => warehouses.find((item) => item.id === history.warehouseId)?.name || history.warehouseId },
            { header: '자재코드', render: (history) => history.inventoryId, className: 'font-mono' },
            { header: '자재명', render: (history) => inventories.find((item) => item.id === history.inventoryId)?.name || '-' },
            { header: '유형/사유', render: (history) => getTxDisplayLabel(history.txTypeCode, history.txReasonCode) },
            { header: '수량', render: (history) => formatQuantity(history.qty), className: 'text-right font-mono' },
            { header: '단가', render: (history) => formatAmount(history.unitPrice), className: 'text-right font-mono' },
            { header: '금액', render: (history) => formatAmount(history.amount), className: 'text-right font-mono' },
            { header: '처리일자', render: (history) => history.txDate || '-' },
            { header: '담당자', render: (history) => usersList.find((item) => item.id === history.userId)?.name || history.userId },
            { header: '참조번호', render: (history) => history.refNo || '-', className: 'font-mono' },
          ],
        });
    if (!opened) toast.error('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Layers size={24} className="text-blue-500" />
            재고조회
          </h1>
          <p className="text-xs text-slate-500 mt-1">현재고와 재고 이력을 조회하고 전표를 출력합니다.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={activeTab === 'status' ? exportStatusCsv : exportHistoryCsv} className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
            <Download size={14} />
            CSV 내보내기
          </button>
          <button onClick={handleListPrint} className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
            <Printer size={14} />
            목록 인쇄
          </button>
          <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-lg">
            <button onClick={() => setActiveTab('status')} className={`px-4 py-1.5 rounded-md text-xs font-semibold cursor-pointer border-0 ${activeTab === 'status' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 bg-transparent'}`}>
              재고현황
            </button>
            <button onClick={() => setActiveTab('history')} className={`px-4 py-1.5 rounded-md text-xs font-semibold cursor-pointer border-0 ${activeTab === 'history' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 bg-transparent'}`}>
              재고이력
            </button>
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="mb-4 flex gap-2">
          <select value={searchType} onChange={(event) => setSearchType(event.target.value as typeof searchType)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 outline-none">
            <option value="id">{activeTab === 'history' ? '문서번호' : '자재/창고코드'}</option>
            <option value="title">자재명</option>
            <option value="owner">{activeTab === 'history' ? '담당자' : '창고명'}</option>
          </select>
          <input value={searchValue} onChange={(event) => setSearchValue(event.target.value)} placeholder="검색어를 입력하세요" className="flex-1 min-w-[200px] bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 outline-none" />
        </div>

        <PrintHeader />
        <h1 className="hidden print:block text-center text-xl font-bold tracking-widest text-black border-b-2 border-black pb-2 mb-4">
          {activeTab === 'status' ? '재 고 현 황' : '재 고 이 력'}
        </h1>

        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40 print:border-slate-300 print:bg-white print:rounded-none">
          {activeTab === 'status' && (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 select-none print:bg-slate-100 print:text-slate-800 print:border-slate-300">
                  <th className="p-3 font-semibold">보관 창고</th>
                  <th className="p-3 font-semibold">자재 ID</th>
                  <th className="p-3 font-semibold">자재명</th>
                  <th className="p-3 font-semibold">규격/단위</th>
                  <th className="p-3 font-semibold text-right">보유 재고 수량</th>
                  <th className="p-3 font-semibold text-right">평가 단가 (평균법)</th>
                  <th className="p-3 font-semibold text-right">평가 금액</th>
                </tr>
              </thead>
              <tbody>
                {filteredStatusList.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-slate-600 print:text-slate-400">등록된 재고 현황이 없습니다.</td></tr>
                ) : (
                  filteredStatusList.map((status) => {
                    const inventory = inventories.find((item) => item.id === status.inventoryId);
                    const warehouse = warehouses.find((item) => item.id === status.warehouseId);
                    const average = status.qty > 0 ? status.amount / status.qty : 0;
                    return (
                      <tr key={`${status.warehouseId}:${status.inventoryId}`} className="border-b border-slate-900 hover:bg-slate-900/30 text-slate-300 print:border-slate-200 print:text-slate-800 print:hover:bg-transparent">
                        <td className="p-3 font-semibold text-slate-200 print:text-slate-900">{warehouse?.name || status.warehouseId}</td>
                        <td className="p-3 font-mono text-slate-400">{status.inventoryId}</td>
                        <td className="p-3">{inventory?.name || '-'}</td>
                        <td className="p-3">{inventory?.unit || '-'}</td>
                        <td className="p-3 text-right font-mono font-semibold text-emerald-400 print:text-emerald-700">{formatQuantity(status.qty)}</td>
                        <td className="p-3 text-right font-mono">{formatMoney(average)}</td>
                        <td className="p-3 text-right font-mono font-semibold text-slate-100 print:text-slate-900">{formatMoney(status.amount)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {activeTab === 'history' && (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 select-none print:bg-slate-100 print:text-slate-800 print:border-slate-300">
                  <th className="p-3 font-semibold">전표번호</th>
                  <th className="p-3 font-semibold">창고명</th>
                  <th className="p-3 font-semibold">자재코드</th>
                  <th className="p-3 font-semibold">자재명</th>
                  <th className="p-3 font-semibold">유형</th>
                  <th className="p-3 font-semibold text-right">처리 수량</th>
                  <th className="p-3 font-semibold text-right">단가</th>
                  <th className="p-3 font-semibold text-right">처리 금액</th>
                  <th className="p-3 font-semibold">처리일자</th>
                  <th className="p-3 font-semibold">담당자</th>
                  <th className="p-3 font-semibold">연계참조번호</th>
                  <th className="p-3 font-semibold w-16 text-center">라인</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistoryList.length === 0 ? (
                  <tr><td colSpan={12} className="p-8 text-center text-slate-600 print:text-slate-400">재고 거래 이력이 없습니다.</td></tr>
                ) : (
                  filteredHistoryList.map((history) => {
                    const inventory = inventories.find((item) => item.id === history.inventoryId);
                    const warehouse = warehouses.find((item) => item.id === history.warehouseId);
                    return (
                      <tr key={history.historyNo} className="border-b border-slate-900 hover:bg-slate-900/30 text-slate-300 print:border-slate-200 print:text-slate-800 print:hover:bg-transparent">
                        <td className="p-3 font-mono">
                          <button type="button" onClick={() => openSlipPrint(history)} className="bg-transparent border-0 p-0 text-blue-400 hover:text-blue-300 hover:underline font-mono cursor-pointer">
                            {history.docNo || `(NO.${history.historyNo})`}
                          </button>
                        </td>
                        <td className="p-3">{warehouse?.name || history.warehouseId}</td>
                        <td className="p-3 font-mono text-slate-400">{history.inventoryId}</td>
                        <td className="p-3">{inventory?.name || '-'}</td>
                        <td className="p-3">{getTxDisplayLabel(history.txTypeCode, history.txReasonCode)}</td>
                        <td className="p-3 text-right font-mono">{formatQuantity(history.qty)}</td>
                        <td className="p-3 text-right font-mono">{formatMoney(history.unitPrice)}</td>
                        <td className="p-3 text-right font-mono">{formatMoney(history.amount)}</td>
                        <td className="p-3 font-mono text-slate-400">{history.txDate}</td>
                        <td className="p-3">{usersList.find((candidate) => candidate.id === history.userId)?.name || history.userId}</td>
                        <td className="p-3 font-mono text-slate-500">{history.refNo || '-'}</td>
                        <td className="p-3 text-center font-mono text-xs text-slate-500">{history.refLineNo || '-'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
