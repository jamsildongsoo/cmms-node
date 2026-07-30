import { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { toast } from 'sonner';
import { useAuthStore } from '../store/useAuthStore';
import PrintHeader from '../components/PrintHeader';
import SlipPrint from '../components/SlipPrint';
import { formatDateOnly, todayLocal, thisMonthLocal } from '../utils/datetime';
import { toastApiError } from '../utils/apiError';
import { APP_MODULE } from '../constants/module';
import { getTxTypeLabel } from '../constants/status';
import PrintWindowLayout from '../components/PrintWindowLayout';
import { openPrintWindow } from '../utils/printWindow';
import { openListPrint } from '../utils/listPrint';
import {
  Plus, Trash, Download, Printer, X, Layers, Settings
} from 'lucide-react';
import type {
  InventoryHistory as InventoryHistoryModel,
  InventoryStatus as InventoryStatusModel,
  InventoryTransactionItem as TxGridItem,
} from '../features/inventory-transaction/inventory-transaction.types';
import { inventoryTransactionApi } from '../features/inventory-transaction/inventory-transaction.api';
import { referenceApi } from '../features/mdm/reference.api';
import { masterReferenceApi } from '../features/master/master-reference.api';
import type { InventoryReference } from '../features/master/master-reference.types';
import type { CodeItem, Department, ReferenceUser, Warehouse } from '../features/mdm/mdm.types';

export default function InventoryTransaction() {
  const user = useAuthStore((s) => s.user);
  const [activeSubTab, setActiveSubTab] = useState<'status' | 'history'>('status');

  // Master lists
  const [statusList, setStatusList] = useState<InventoryStatusModel[]>([]);
  const [historyList, setHistoryList] = useState<InventoryHistoryModel[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [depts, setDepts] = useState<Department[]>([]);
  const [inventories, setInventories] = useState<InventoryReference[]>([]);
  const [usersList, setUsersList] = useState<ReferenceUser[]>([]);
  const [txReasons, setTxReasons] = useState<CodeItem[]>([]);

  // Modals & UI states
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  const [isSlipOpen, setIsSlipOpen] = useState(false);
  const [selectedSlip, setSelectedSlip] = useState<InventoryHistoryModel | null>(null);

  // Closing year-month input
  const [closingYm, setClosingYm] = useState(thisMonthLocal());

  // Transaction Entry Grid
  const [txGrid, setTxGrid] = useState<TxGridItem[]>([]);
  const [txDate, setTxDate] = useState(todayLocal());
  const [txTypeCode, setTxTypeCode] = useState('IN');
  const [txReasonCode, setTxReasonCode] = useState('GENERAL');

  const [isLoading, setIsLoading] = useState(false);
  const canCreate = user?.permissions?.[APP_MODULE.STK]?.C === 'Y';
  const [searchType, setSearchType] = useState<'id' | 'title' | 'owner'>('id');
  const [searchValue, setSearchValue] = useState('');
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

  const fetchData = async () => {
    try {
      // 선택 UI 구성을 위한 시스템 참조값 조회다. 재고현황/이력 R 권한을 대체하지 않는다.
      const [loadedStatus, loadedHistory, loadedWarehouses, loadedDepts, loadedInventories, loadedUsers, loadedReasons] = await Promise.all([
        inventoryTransactionApi.getStatus(),
        inventoryTransactionApi.getHistory(),
        referenceApi.getWarehouseOptions(),
        referenceApi.getDepartmentOptions(),
        masterReferenceApi.getInventories(),
        referenceApi.getUserOptions(),
        referenceApi.getInventoryTransactionReasonOptions(),
      ]);
      setStatusList(loadedStatus);
      setHistoryList((loadedHistory || []).map((history: InventoryHistoryModel) => ({
        ...history,
        txDate: formatDateOnly(history.txDate),
      })));
      setWarehouses(loadedWarehouses);
      setDepts(loadedDepts);
      setInventories(loadedInventories);
      setUsersList(loadedUsers);
      setTxReasons(loadedReasons);
    } catch (err) {
      console.error(err);
      toastApiError(err, '재고 데이터를 불러오지 못했습니다.');
    }
  };

  // 초기 조회는 이벤트 루프 다음 틱에 실행해 effect의 동기 상태 변경을 피한다.
  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchData(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleOpenTxModal = () => {
    setTxGrid([
      {
        warehouseId: warehouses.length > 0 ? warehouses[0].id : '',
        inventoryId: inventories.length > 0 ? inventories[0].id : '',
        qty: 1,
        unitPrice: 0,
        targetWarehouseId: warehouses.length > 1 ? warehouses[1].id : '',
      }
    ]);
    setTxDate(todayLocal());
    setTxTypeCode('IN');
    setTxReasonCode('GENERAL');
    setIsTxModalOpen(true);
  };

  const handleAddGridRow = () => {
    setTxGrid([
      ...txGrid,
      {
        warehouseId: warehouses.length > 0 ? warehouses[0].id : '',
        inventoryId: inventories.length > 0 ? inventories[0].id : '',
        qty: 1,
        unitPrice: 0,
        targetWarehouseId: warehouses.length > 1 ? warehouses[1].id : '',
      }
    ]);
  };

  const handleRemoveGridRow = (idx: number) => {
    setTxGrid(txGrid.filter((_, i) => i !== idx));
  };

  const handleGridChange = <K extends keyof TxGridItem>(
    idx: number,
    field: K,
    val: TxGridItem[K],
  ) => {
    setTxGrid(txGrid.map((row, i) => {
      if (i === idx) {
        return { ...row, [field]: val };
      }
      return row;
    }));
  };

  const handleSaveTransactions = async () => {
    if (txGrid.length === 0) return;
    if (!txDate) {
      toast.error('처리일을 입력하세요.');
      return;
    }
    setIsLoading(true);
    try {
      await inventoryTransactionApi.process({
        items: txGrid.map((item) => ({ ...item, txTypeCode, txReasonCode, txDate })),
      });
      toast.success('재고 처리가 완료되었습니다.');
      setIsTxModalOpen(false);
      fetchData();
    } catch (err) {
      toastApiError(err, '처리 오류 발생');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunClosing = async () => {
    if (!closingYm || closingYm.length !== 6) {
      toast.error('마감 년월 6자리(YYYYMM)를 확인해주세요.');
      return;
    }
    setIsLoading(true);
    try {
      await inventoryTransactionApi.closeMonth(closingYm);
      toast.success(`${closingYm.substring(0, 4)}년 ${closingYm.substring(4, 6)}월 재고 마감이 처리되었습니다.`);
      setIsClosingModalOpen(false);
      fetchData();
    } catch (err) {
      toastApiError(err, '마감 처리 오류');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenSlip = (hist: InventoryHistoryModel) => {
    setSelectedSlip(hist);
    openSlipPrint(hist);
  };

  const openSlipPrint = (slip: InventoryHistoryModel) => {
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
  };

  const getSlipTitle = (txTypeCode: string) =>
    txTypeCode === 'IN' ? '입고증'
      : txTypeCode === 'OUT' ? '출고증'
        : txTypeCode === 'ADJ' ? '재고전표 (조정)'
          : '재고전표 (이동)';

  const getSlipCategory = (txTypeCode: string) =>
    txTypeCode === 'IN' ? 'IN'
      : txTypeCode === 'OUT' ? 'OUT'
        : txTypeCode === 'ADJ' ? 'ADJ'
          : 'MOVE';

  const getTxReasonLabel = (code?: string) =>
    txReasons.find((reason) => reason.id === code)?.name || code || '-';

  const getTxDisplayLabel = (type: string, reason?: string) =>
    `${getTxTypeLabel(type)}-${getTxReasonLabel(reason)}`;

  const allowedReasons = (type: string) => {
    const ids = type === 'IN' ? ['GENERAL', 'RETURN', 'PLANT_TRANSFER']
      : type === 'OUT' ? ['GENERAL', 'WORK_ORDER', 'DISPOSAL', 'PLANT_TRANSFER']
      : type === 'MOVE' ? ['TRANSFER'] : ['STOCKTAKING'];
    return txReasons.filter((reason) => ids.includes(reason.id));
  };

  const getTxTypeClass = (code: string) => {
    switch (code) {
      case 'IN':
      case 'MOVE_IN': return 'text-emerald-400 font-semibold';
      case 'OUT':
      case 'MOVE_OUT': return 'text-rose-400 font-semibold';
      default: return 'text-slate-400';
    }
  };

  const exportStatusCsv = () => {
    if (filteredStatusList.length === 0) return;
    const headers = ['창고', '자재코드', '자재명', '단위', '수량', '금액', '평균단가'];
    const rows = filteredStatusList.map(s => {
      const inv = inventories.find(i => i.id === s.inventoryId);
      const wh = warehouses.find(w => w.id === s.warehouseId);
      const avg = s.qty > 0 ? (s.amount / s.qty) : 0;
      return [
        wh?.name || s.warehouseId,
        s.inventoryId,
        inv?.name || '-',
        inv?.unit || '-',
        s.qty,
        s.amount,
        avg.toFixed(2)
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(e => e.map(val => `"${val.toString().replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'inventory_status.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportHistoryCsv = () => {
    if (filteredHistoryList.length === 0) return;
    const headers = ['이력번호', '창고', '자재코드', '자재명', '유형', '수량', '단가', '금액', '처리일자', '담당자', '참조번호', '라인'];
    const rows = filteredHistoryList.map(h => {
      const inv = inventories.find(i => i.id === h.inventoryId);
      const wh = warehouses.find(w => w.id === h.warehouseId);
      return [
        h.historyNo,
        wh?.name || h.warehouseId,
        h.inventoryId,
        inv?.name || '-',
        getTxDisplayLabel(h.txTypeCode, h.txReasonCode),
        h.qty,
        h.unitPrice,
        h.amount,
        h.txDate,
        usersList.find((candidate) => candidate.id === h.userId)?.name || h.userId,
        h.refNo || '-',
        h.refLineNo || '-',
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(e => e.map(val => `"${val.toString().replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'inventory_history.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleListPrint = () => {
    const now = new Date();
    const common = {
      companyName: user?.companyName || user?.companyId || 'CMMS',
      printerName: user?.name || '-',
      printedAt: now.toLocaleString('sv-SE'),
    };
    const opened = activeSubTab === 'status'
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
            { header: '수량', render: (status) => Number(status.qty).toLocaleString(), className: 'text-right font-mono' },
            { header: '평균단가', render: (status) => Math.round(status.qty > 0 ? status.amount / status.qty : 0).toLocaleString(), className: 'text-right font-mono' },
            { header: '평가금액', render: (status) => Math.round(Number(status.amount)).toLocaleString(), className: 'text-right font-mono' },
          ],
        })
      : openListPrint({
          ...common,
          title: '재고수불대장',
          rows: filteredHistoryList,
          getRowKey: (history) => `${history.warehouseId}:${history.historyNo}`,
          columns: [
            { header: '전표번호', render: (history) => history.docNo || history.historyNo, className: 'font-mono' },
            { header: '창고', render: (history) => warehouses.find((item) => item.id === history.warehouseId)?.name || history.warehouseId },
            { header: '자재코드', render: (history) => history.inventoryId, className: 'font-mono' },
            { header: '자재명', render: (history) => inventories.find((item) => item.id === history.inventoryId)?.name || '-' },
            { header: '유형/사유', render: (history) => getTxDisplayLabel(history.txTypeCode, history.txReasonCode) },
            { header: '수량', render: (history) => Number(history.qty).toLocaleString(), className: 'text-right font-mono' },
            { header: '단가', render: (history) => Math.round(Number(history.unitPrice)).toLocaleString(), className: 'text-right font-mono' },
            { header: '금액', render: (history) => Math.round(Number(history.amount)).toLocaleString(), className: 'text-right font-mono' },
            { header: '처리일자', render: (history) => history.txDate || '-' },
            { header: '담당자', render: (history) => usersList.find((item) => item.id === history.userId)?.name || history.userId },
            { header: '참조번호', render: (history) => history.refNo || '-', className: 'font-mono' },
          ],
        });
    if (!opened) toast.error('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Layers size={24} className="text-blue-500" />
            재고 입출고 및 이동 처리
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={activeSubTab === 'status' ? exportStatusCsv : exportHistoryCsv}
            className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download size={14} />
            CSV 내보내기
          </button>

          <button
            onClick={handleListPrint}
            className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Printer size={14} />
            목록 인쇄
          </button>

          {canCreate && <button
            onClick={() => setIsClosingModalOpen(true)}
            className="bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800 rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Settings size={14} className="text-slate-500" />
            월 재고 마감
          </button>}

          {canCreate && <button
            onClick={handleOpenTxModal}
            className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 transition-colors border-0 cursor-pointer shadow-lg shadow-blue-900/20"
          >
            <Plus size={14} />
            입력
          </button>}

          {/* Subtab control */}
          <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setActiveSubTab('status')}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer border-0 outline-none ${
                activeSubTab === 'status' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              재고현황
            </button>
            <button
              onClick={() => setActiveSubTab('history')}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer border-0 outline-none ${
                activeSubTab === 'history' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              재고이력
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid View */}
      <div className={`bg-slate-900 border border-slate-800 rounded-xl p-6 print:border-0 print:bg-transparent print:p-0 print-landscape ${isSlipOpen ? 'print:hidden' : ''}`}>
        <div className="mb-4 flex gap-2 print:hidden">
          <select value={searchType} onChange={(event) => setSearchType(event.target.value as typeof searchType)} className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 outline-none">
            <option value="id">{activeSubTab === 'history' ? '문서번호' : '자재/창고코드'}</option>
            <option value="title">자재명</option>
            <option value="owner">{activeSubTab === 'history' ? '담당자' : '창고명'}</option>
          </select>
          <input value={searchValue} onChange={(event) => setSearchValue(event.target.value)} placeholder="검색어를 입력하세요" className="flex-1 min-w-[200px] bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-300 outline-none" />
        </div>

        {/* Print Only Header */}
        <PrintHeader />
        <h1 className="hidden print:block text-center text-xl font-bold tracking-widest text-black border-b-2 border-black pb-2 mb-4">
          {activeSubTab === 'status' ? '재 고 현 황' : '재 고 수 불 대 장'}
        </h1>

        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40 print:border-slate-300 print:bg-white print:rounded-none">

          {/* TAB 1: STATUS */}
          {activeSubTab === 'status' && (
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
                  filteredStatusList.map((s, idx) => {
                    const inv = inventories.find(i => i.id === s.inventoryId);
                    const wh = warehouses.find(w => w.id === s.warehouseId);
                    const avg = s.qty > 0 ? (s.amount / s.qty) : 0;
                    return (
                      <tr key={idx} className="border-b border-slate-900 hover:bg-slate-900/30 text-slate-300 print:border-slate-200 print:text-slate-800 print:hover:bg-transparent">
                        <td className="p-3 font-semibold text-slate-200 print:text-slate-900">{wh?.name || s.warehouseId}</td>
                        <td className="p-3 font-mono text-slate-400">{s.inventoryId}</td>
                        <td className="p-3">{inv?.name || '-'}</td>
                        <td className="p-3">{inv?.unit || '-'}</td>
                        <td className="p-3 text-right font-mono font-semibold text-emerald-400 print:text-emerald-700">{s.qty.toLocaleString()}</td>
                        <td className="p-3 text-right font-mono">{Math.round(avg).toLocaleString()} 원</td>
                        <td className="p-3 text-right font-mono font-semibold text-slate-100 print:text-slate-900">{Math.round(s.amount).toLocaleString()} 원</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {/* TAB 2: HISTORY */}
          {activeSubTab === 'history' && (
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
                  filteredHistoryList.map((h) => {
                    const inv = inventories.find(i => i.id === h.inventoryId);
                    const wh = warehouses.find(w => w.id === h.warehouseId);
                    return (
                      <tr key={h.historyNo} className="border-b border-slate-900 hover:bg-slate-900/30 text-slate-300 print:border-slate-200 print:text-slate-800 print:hover:bg-transparent">
                        <td className="p-3 font-mono" title={`이력번호 ${h.historyNo}`}>
                          <button
                            type="button"
                            onClick={() => handleOpenSlip(h)}
                            className="bg-transparent border-0 p-0 text-blue-400 hover:text-blue-300 hover:underline font-mono cursor-pointer"
                            title={`${h.docNo || `NO.${h.historyNo}`} 전표 출력`}
                          >
                            {h.docNo || `(NO.${h.historyNo})`}
                          </button>
                        </td>
                        <td className="p-3">{wh?.name || h.warehouseId}</td>
                        <td className="p-3 font-mono text-slate-400">{h.inventoryId}</td>
                        <td className="p-3">{inv?.name || '-'}</td>
                        <td className={`p-3 ${getTxTypeClass(h.txTypeCode)}`}>
                          {getTxDisplayLabel(h.txTypeCode, h.txReasonCode)}
                        </td>
                        <td className="p-3 text-right font-mono">{h.qty.toLocaleString()}</td>
                        <td className="p-3 text-right font-mono">{Math.round(h.unitPrice).toLocaleString()} 원</td>
                        <td className="p-3 text-right font-mono">{Math.round(h.amount).toLocaleString()} 원</td>
                        <td className="p-3 font-mono text-slate-400">{h.txDate}</td>
                        <td className="p-3">{usersList.find((candidate) => candidate.id === h.userId)?.name || h.userId}</td>
                        <td className="p-3 font-mono text-slate-500">{h.refNo || '-'}</td>
                        <td className="p-3 text-center font-mono text-xs text-slate-500">{h.refLineNo || '-'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

        </div>
      </div>

      {/* TX REGISTER MODAL (Multiple entries) */}
      {isTxModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[85vh] flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex justify-between items-start shrink-0">
              <div>
                <h2 className="text-lg font-bold text-slate-200">재고 입출고 및 이동 일괄 등록</h2>
                <p className="text-xs text-slate-500 mt-1">
                  다른 플랜트 간 이동은 보내는 담당자가 출고 / 플랜트이동, 받는 담당자가 입고 / 플랜트이동으로 각각 처리하세요.
                </p>
              </div>
              <button
                onClick={() => setIsTxModalOpen(false)}
                className="text-slate-500 hover:text-slate-300 p-1 hover:bg-slate-800 rounded transition-colors border-0 cursor-pointer bg-transparent"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div><span className="text-slate-500 block mb-0.5">전표번호</span><span className="font-mono font-semibold text-slate-300">(처리 시 자동발행)</span></div>
                <div><span className="text-slate-500 block mb-0.5">작성일</span><span className="font-mono text-slate-300">{todayLocal()}</span></div>
                <div><span className="text-slate-500 block mb-0.5">부서</span><span className="text-slate-300">{user?.departmentId || '-'} / {usersList.find((candidate) => candidate.id === user?.id)?.departmentName || '-'}</span></div>
                <div><span className="text-slate-500 block mb-0.5">작성자</span><span className="text-slate-300">{user?.id || '-'} / {user?.name || '-'}</span></div>
                <label>
                  <span className="text-slate-500 block mb-1">처리일</span>
                  <input type="date" value={txDate} onChange={(event) => setTxDate(event.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 outline-none focus:border-blue-500" />
                </label>
                <label>
                  <span className="text-slate-500 block mb-1">구분</span>
                  <select
                    value={txTypeCode}
                    onChange={(event) => {
                      const type = event.target.value;
                      setTxTypeCode(type);
                      setTxReasonCode(type === 'MOVE' ? 'TRANSFER' : type === 'ADJ' ? 'STOCKTAKING' : 'GENERAL');
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 outline-none focus:border-blue-500"
                  >
                    <option value="IN">입고 (IN)</option>
                    <option value="OUT">출고 (OUT)</option>
                    <option value="MOVE">이동 (MOVE)</option>
                    <option value="ADJ">조정 (ADJ)</option>
                  </select>
                </label>
                <label className="lg:col-span-2">
                  <span className="text-slate-500 block mb-1">거래 사유</span>
                  <select value={txReasonCode} onChange={(event) => setTxReasonCode(event.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 outline-none focus:border-blue-500">
                    {allowedReasons(txTypeCode).map((reason) => (
                      <option key={reason.id} value={reason.id}>{reason.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex justify-end items-center">
                <button
                  type="button"
                  onClick={handleAddGridRow}
                  className="text-blue-400 text-xs font-semibold bg-transparent border-0 cursor-pointer flex items-center gap-1"
                >
                  <Plus size={12} />
                  <span>행 추가</span>
                </button>
              </div>

              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/20">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 select-none">
                      <th className="p-3 font-semibold w-40">창고</th>
                      <th className="p-3 font-semibold w-48">자재 (재고품목)</th>
                      <th className="p-3 font-semibold w-24 text-right">수량</th>
                      <th className="p-3 font-semibold w-32 text-right">단가 (입고 시)</th>
                      <th className="p-3 font-semibold w-40">받는 창고 (이동 시)</th>
                      <th className="p-3 font-semibold w-12 text-center">삭제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txGrid.length === 0 ? (
                      <tr><td colSpan={6} className="p-8 text-center text-slate-600">추가된 트랜잭션 행이 없습니다.</td></tr>
                    ) : (
                      txGrid.map((row, idx) => (
                        <tr key={idx} className="border-b border-slate-900 hover:bg-slate-900/30 text-slate-300">
                          <td className="p-2">
                            <select
                              value={row.warehouseId}
                              onChange={(e) => handleGridChange(idx, 'warehouseId', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-850 focus:border-blue-500 rounded py-1.5 px-2 text-xs text-slate-300 outline-none"
                            >
                              {warehouses.map(w => (
                                <option key={w.id} value={w.id}>{w.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <select
                              value={row.inventoryId}
                              onChange={(e) => handleGridChange(idx, 'inventoryId', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-850 focus:border-blue-500 rounded py-1.5 px-2 text-xs text-slate-300 outline-none"
                            >
                              {inventories.map(i => (
                                <option key={i.id} value={i.id}>{i.name} [{i.id}]</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="0.0001"
                              step="any"
                              value={row.qty}
                              onChange={(e) => handleGridChange(idx, 'qty', parseFloat(e.target.value) || 0)}
                              className="w-full bg-slate-950 border border-slate-850 focus:border-blue-500 rounded py-1.5 px-2 text-right text-xs text-slate-200 outline-none"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="0"
                              disabled={txTypeCode === 'OUT' || txTypeCode === 'MOVE'}
                              value={row.unitPrice}
                              onChange={(e) => handleGridChange(idx, 'unitPrice', parseInt(e.target.value) || 0)}
                              className="w-full bg-slate-950 border border-slate-850 focus:border-blue-500 rounded py-1.5 px-2 text-right text-xs text-slate-200 outline-none disabled:opacity-30"
                            />
                          </td>
                          <td className="p-2">
                            <select
                              disabled={txTypeCode !== 'MOVE'}
                              value={row.targetWarehouseId}
                              onChange={(e) => handleGridChange(idx, 'targetWarehouseId', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-850 focus:border-blue-500 rounded py-1.5 px-2 text-xs text-slate-300 outline-none disabled:opacity-30"
                            >
                              {warehouses
                                .filter((warehouse) => {
                                  const source = warehouses.find((candidate) => candidate.id === row.warehouseId);
                                  return warehouse.id !== row.warehouseId
                                    && warehouse.plantId === source?.plantId;
                                })
                                .map(w => (
                                <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                            </select>
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveGridRow(idx)}
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

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-800 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsTxModalOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg py-2 px-4 text-xs font-semibold transition-colors cursor-pointer border-0"
              >
                취소
              </button>
              <button
                onClick={handleSaveTransactions}
                disabled={isLoading || txGrid.length === 0}
                className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 px-4 text-xs font-semibold transition-colors cursor-pointer border-0 disabled:opacity-50"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MONTHLY CLOSING MODAL */}
      {isClosingModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-200 flex items-center gap-1.5">
                <Settings size={18} className="text-blue-500 animate-spin" />
                월 재고 마감 작업 실행
              </h2>
              <button onClick={() => setIsClosingModalOpen(false)} className="text-slate-500 hover:text-slate-300 border-0 cursor-pointer bg-transparent"><X size={20} /></button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-400">
                선택한 마감 대상 년월의 입고/출고/이동/조정 이력을 최종 마감 집계하여 월 재고 수불 마감 테이블에 고정 기록합니다.
              </p>
              <div>
                <label className="block text-slate-500 mb-1.5">마감 대상 년월 (6자리)</label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="예: 202605"
                  value={closingYm}
                  onChange={(e) => setClosingYm(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2.5 px-3 text-slate-200 outline-none text-center font-mono font-bold text-sm tracking-widest"
                />
              </div>
            </div>

            <div className="p-6 border-t border-slate-800 flex justify-end gap-2">
              <button onClick={() => setIsClosingModalOpen(false)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg py-2 px-4 border-0 cursor-pointer">취소</button>
              <button onClick={handleRunClosing} disabled={isLoading} className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 px-4 border-0 cursor-pointer disabled:opacity-50">마감 실행</button>
            </div>
          </div>
        </div>
      )}

      {/* SLIP (입/출고 전표) PRINT MODAL */}
      {isSlipOpen && selectedSlip && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto print:absolute print:inset-0 print:bg-white print:p-0">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl print:border-0 print:shadow-none print:w-full print:h-full">
            {/* Header */}
            <div className="p-6 border-b border-slate-800 flex justify-between items-center print:hidden">
              <h2 className="text-lg font-bold text-slate-200">
                {selectedSlip.txTypeCode === 'IN' ? '입고증'
                  : selectedSlip.txTypeCode === 'OUT' ? '출고증'
                  : selectedSlip.txTypeCode === 'ADJ' ? '재고전표 (조정)'
                  : '재고전표 (이동)'}
              </h2>
              <button onClick={() => setIsSlipOpen(false)} className="text-slate-500 hover:text-slate-300 border-0 cursor-pointer bg-transparent"><X size={20} /></button>
            </div>

            {/* 화면 상세 (인쇄 제외 — 인쇄는 전용 SlipPrint) */}
            <div className="p-8 space-y-6 text-xs text-slate-300 print:hidden">
              {/* 전표 양식 디자인 */}
              <div className="text-center mb-8 border-b-2 border-slate-800 pb-4">
                <h1 className="text-2xl font-extrabold tracking-widest text-slate-200 uppercase">
                  {selectedSlip.txTypeCode === 'IN' ? '입 고 증'
                    : selectedSlip.txTypeCode === 'OUT' ? '출 고 증'
                    : selectedSlip.txTypeCode === 'ADJ' ? '재 고 전 표 (조 정)'
                    : '재 고 전 표 (이 동)'}
                </h1>
                <span className="text-[11px] text-slate-700 font-mono block mt-1 font-bold">전표번호: {selectedSlip.docNo || '-'}</span>
                <span className="text-[9px] text-slate-500 font-mono block">이력 NO.{selectedSlip.historyNo}</span>
              </div>

              <div className="border border-slate-700 p-4 rounded-xl space-y-4 print:border-slate-400 print:rounded-none">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-500 block">발행 테넌트</span>
                    <strong className="text-slate-200 print:text-black text-sm">{user?.companyId}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">처리 일자</span>
                    <strong className="text-slate-200 print:text-black font-mono">{selectedSlip.txDate}</strong>
                  </div>
                </div>

                <hr className="border-slate-800 print:border-slate-300" />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-500 block">보관/지출 창고</span>
                    <strong className="text-slate-200 print:text-black">
                      {warehouses.find(w => w.id === selectedSlip.warehouseId)?.name || selectedSlip.warehouseId}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">자재 정보 (코드/자재명)</span>
                    <strong className="text-slate-200 print:text-black block font-mono">{selectedSlip.inventoryId}</strong>
                    <strong className="text-slate-200 print:text-black font-semibold text-sm">
                      {inventories.find(i => i.id === selectedSlip.inventoryId)?.name || '-'}
                    </strong>
                  </div>
                </div>

                <hr className="border-slate-800 print:border-slate-300" />

                <div className="grid grid-cols-3 gap-2 text-right">
                  <div>
                    <span className="text-slate-500 block text-left">수량</span>
                    <strong className="text-slate-100 print:text-black font-mono text-sm">{Math.abs(selectedSlip.qty).toLocaleString()}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-left">단가 (평균법)</span>
                    <strong className="text-slate-100 print:text-black font-mono text-sm">{Math.round(selectedSlip.unitPrice).toLocaleString()} 원</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-left">총 거래금액</span>
                    <strong className="text-emerald-400 print:text-black font-mono text-sm font-bold">{Math.round(Math.abs(selectedSlip.amount)).toLocaleString()} 원</strong>
                  </div>
                </div>

                <hr className="border-slate-800 print:border-slate-300" />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-slate-500 block">거래 유형</span>
                    <span className="bg-slate-850 px-2 py-0.5 rounded text-[10px] font-semibold text-slate-300 print:border print:border-slate-300">
                      {getTxDisplayLabel(selectedSlip.txTypeCode, selectedSlip.txReasonCode)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">승인 담당자 서명</span>
                    <span className="text-slate-400 font-semibold">{selectedSlip.userId} (인)</span>
                  </div>
                </div>

                {selectedSlip.refNo && (
                  <div className="bg-slate-950 p-2.5 rounded font-mono text-[10px] text-slate-500 border border-slate-900 print:bg-slate-50 print:border-slate-200">
                    {selectedSlip.refModule === APP_MODULE.PUR
                      ? <>* 구매요청 출처: <strong className="text-slate-300 print:text-slate-800">{selectedSlip.refNo}</strong></>
                      : <>* 연계 이동 참조: {selectedSlip.refNo} ({selectedSlip.refModule})</>}
                  </div>
                )}
              </div>

              {/* Signature layout placeholder for formal slips */}
              <div className="grid grid-cols-2 border border-slate-700 text-center text-[10px] rounded-xl print:border-slate-400 print:rounded-none">
                <div className="p-3 border-r border-slate-700 print:border-slate-400">
                  <span className="text-slate-500 block mb-3">
                    {selectedSlip.txTypeCode === 'IN' ? '공급자' : '인도자'}
                  </span>
                  <div className="h-6 border-b border-dashed border-slate-800 mx-8 print:border-slate-300"></div>
                </div>
                <div className="p-3">
                  <span className="text-slate-500 block mb-3">인수자</span>
                  <div className="h-6 border-b border-dashed border-slate-800 mx-8 print:border-slate-300"></div>
                </div>
              </div>

              {/* Print Footer Details */}
              <div className="flex justify-between text-[8px] text-slate-600 font-mono border-t border-slate-850 pt-2 print:border-slate-200">
                <span>Tenant: {selectedSlip.companyId}</span>
                <span>System generated transaction slip.</span>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="p-6 border-t border-slate-800 flex justify-end gap-2 shrink-0 print:hidden">
              <button
                type="button"
                onClick={() => setIsSlipOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg py-2 px-4 text-xs font-semibold cursor-pointer border-0"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={() => openSlipPrint(selectedSlip)}
                className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 px-5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer border-0 shadow-lg shadow-blue-900/20"
              >
                <Printer size={14} />
                전표 인쇄
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
