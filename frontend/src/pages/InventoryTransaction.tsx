import { useState, useEffect } from 'react';
import axiosInstance from '../api/axios';
import { useAuthStore } from '../store/useAuthStore';
import PrintHeader from '../components/PrintHeader';
import SlipPrint from '../components/SlipPrint';
import { formatDateOnly, todayLocal, thisMonthLocal } from '../utils/datetime';
import { getApiErrorMessage } from '../utils/apiError';
import {
  Plus, Trash, Download, Printer, X, Layers, Settings
} from 'lucide-react';

interface InventoryStatusModel {
  warehouseId: string;
  inventoryId: string;
  qty: number;
  amount: number;
}

interface InventoryHistoryModel {
  companyId: string;
  warehouseId: string;
  inventoryId: string;
  historyNo: number;
  txTypeCode: string;
  qty: number;
  unitPrice: number;
  amount: number;
  txDate: string;
  userId: string;
  refNo: string | null;
  refModule: string | null;
  docNo: string | null;  // STK 전표번호
  refLineNo: string | null;  // 연계 문서 라인 번호 (PUR 등)
}

interface TxGridItem {
  warehouseId: string;
  inventoryId: string;
  txTypeCode: string;
  qty: number;
  unitPrice: number;
  targetWarehouseId: string;
  txDate: string;
}

export default function InventoryTransaction() {
  const user = useAuthStore((s) => s.user);
  const [activeSubTab, setActiveSubTab] = useState<'status' | 'history'>('status');

  // Master lists
  const [statusList, setStatusList] = useState<InventoryStatusModel[]>([]);
  const [historyList, setHistoryList] = useState<InventoryHistoryModel[]>([]);
  const [warehouses, setWarehouses] = useState<{ id: string; name: string }[]>([]);
  const [inventories, setInventories] = useState<{ id: string; name: string; unit: string }[]>([]);

  // Modals & UI states
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  const [isSlipOpen, setIsSlipOpen] = useState(false);
  const [selectedSlip, setSelectedSlip] = useState<InventoryHistoryModel | null>(null);

  // Closing year-month input
  const [closingYm, setClosingYm] = useState(thisMonthLocal());

  // Transaction Entry Grid
  const [txGrid, setTxGrid] = useState<TxGridItem[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = async () => {
    try {
      const [statusRes, historyRes, whRes, invRes] = await Promise.all([
        axiosInstance.get('/inventory-tx/status'),
        axiosInstance.get('/inventory-tx/history'),
        axiosInstance.get('/mdm/warehouses'),
        axiosInstance.get('/master/inventories')
      ]);
      setStatusList(statusRes.data);
      setHistoryList((historyRes.data || []).map((history: InventoryHistoryModel) => ({
        ...history,
        txDate: formatDateOnly(history.txDate),
      })));
      setWarehouses(whRes.data);
      setInventories(invRes.data);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: getApiErrorMessage(err, '재고 데이터를 불러오지 못했습니다.') });
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleOpenTxModal = () => {
    setTxGrid([
      {
        warehouseId: warehouses.length > 0 ? warehouses[0].id : '',
        inventoryId: inventories.length > 0 ? inventories[0].id : '',
        txTypeCode: 'IN',
        qty: 1,
        unitPrice: 0,
        targetWarehouseId: warehouses.length > 1 ? warehouses[1].id : '',
        txDate: todayLocal()
      }
    ]);
    setIsTxModalOpen(true);
  };

  const handleAddGridRow = () => {
    setTxGrid([
      ...txGrid,
      {
        warehouseId: warehouses.length > 0 ? warehouses[0].id : '',
        inventoryId: inventories.length > 0 ? inventories[0].id : '',
        txTypeCode: 'IN',
        qty: 1,
        unitPrice: 0,
        targetWarehouseId: warehouses.length > 1 ? warehouses[1].id : '',
        txDate: todayLocal()
      }
    ]);
  };

  const handleRemoveGridRow = (idx: number) => {
    setTxGrid(txGrid.filter((_, i) => i !== idx));
  };

  const handleGridChange = (idx: number, field: keyof TxGridItem, val: any) => {
    setTxGrid(txGrid.map((row, i) => {
      if (i === idx) {
        return { ...row, [field]: val };
      }
      return row;
    }));
  };

  const handleSaveTransactions = async () => {
    if (txGrid.length === 0) return;
    setIsLoading(true);
    setMessage(null);
    try {
      await axiosInstance.post('/inventory-tx', { items: txGrid });
      setMessage({ type: 'success', text: '재고 처리가 완료되었습니다.' });
      setIsTxModalOpen(false);
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: getApiErrorMessage(err, '처리 오류 발생') });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunClosing = async () => {
    if (!closingYm || closingYm.length !== 6) {
      alert('마감 년월 6자리(YYYYMM)를 확인해주세요.');
      return;
    }
    setIsLoading(true);
    setMessage(null);
    try {
      await axiosInstance.post(`/inventory-tx/close?closingYm=${closingYm}`);
      setMessage({ type: 'success', text: `${closingYm.substring(0, 4)}년 ${closingYm.substring(4, 6)}월 재고 마감이 처리되었습니다.` });
      setIsClosingModalOpen(false);
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: getApiErrorMessage(err, '마감 처리 오류') });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenSlip = (hist: InventoryHistoryModel) => {
    setSelectedSlip(hist);
    setIsSlipOpen(true);
  };

  const getTxTypeLabel = (code: string) => {
    return {
      IN: '입고',
      OUT: '출고',
      MOVE_IN: '이동입고',
      MOVE_OUT: '이동출고',
      ADJ: '조정'
    }[code] || code;
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
    if (statusList.length === 0) return;
    const headers = ['창고', '자재코드', '자재명', '단위', '수량', '금액', '평균단가'];
    const rows = statusList.map(s => {
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
    if (historyList.length === 0) return;
    const headers = ['이력번호', '창고', '자재코드', '자재명', '구분', '수량', '단가', '금액', '처리일자', '담당자', '참조번호', '라인'];
    const rows = historyList.map(h => {
      const inv = inventories.find(i => i.id === h.inventoryId);
      const wh = warehouses.find(w => w.id === h.warehouseId);
      return [
        h.historyNo,
        wh?.name || h.warehouseId,
        h.inventoryId,
        inv?.name || '-',
        getTxTypeLabel(h.txTypeCode),
        h.qty,
        h.unitPrice,
        h.amount,
        h.txDate,
        h.userId,
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Layers size={24} className="text-blue-500" />
            재고 입출고 및 이동 처리
          </h1>
          <p className="text-slate-400 text-sm mt-1">창고간 재고 입출고, 이동 처리를 수행하고 비관적 정렬락 기반 평균단가 변동을 관리합니다.</p>
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
            onClick={() => window.print()}
            className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Printer size={14} />
            가로 목록 인쇄
          </button>

          <button
            onClick={() => setIsClosingModalOpen(true)}
            className="bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800 rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Settings size={14} className="text-slate-500" />
            월 재고 마감
          </button>

          <button
            onClick={handleOpenTxModal}
            className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 transition-colors border-0 cursor-pointer shadow-lg shadow-blue-900/20"
          >
            <Plus size={14} />
            입력
          </button>

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

      {message && (
        <div className={`p-3 rounded-lg border text-xs text-center print:hidden ${
          message.type === 'success' 
            ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-400' 
            : 'bg-red-950/40 border-red-800/80 text-red-400'
        }`}>
          {message.text}
        </div>
      )}

      {/* Main Grid View */}
      <div className={`bg-slate-900 border border-slate-800 rounded-xl p-6 print:border-0 print:bg-transparent print:p-0 print-landscape ${isSlipOpen ? 'print:hidden' : ''}`}>
        
        {/* Print Only Header */}
        <PrintHeader />
        <h1 className="hidden print:block text-center text-xl font-bold tracking-widest text-black border-b-2 border-black pb-2 mb-4">
          {activeSubTab === 'status' ? '창 고 별 재 고 현 황' : '재 고 수 불 이 력'}
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
                {statusList.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-slate-600 print:text-slate-400">등록된 재고 현황이 없습니다.</td></tr>
                ) : (
                  statusList.map((s, idx) => {
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
                  <th className="p-3 font-semibold">구분</th>
                  <th className="p-3 font-semibold text-right">처리 수량</th>
                  <th className="p-3 font-semibold text-right">단가</th>
                  <th className="p-3 font-semibold text-right">처리 금액</th>
                  <th className="p-3 font-semibold">처리일자</th>
                  <th className="p-3 font-semibold">담당자</th>
                  <th className="p-3 font-semibold">연계참조번호</th>
                  <th className="p-3 font-semibold w-16 text-center">라인</th>
                  <th className="p-3 font-semibold text-right print:hidden">전표</th>
                </tr>
              </thead>
              <tbody>
                {historyList.length === 0 ? (
                  <tr><td colSpan={13} className="p-8 text-center text-slate-600 print:text-slate-400">재고 거래 이력이 없습니다.</td></tr>
                ) : (
                  historyList.map((h) => {
                    const inv = inventories.find(i => i.id === h.inventoryId);
                    const wh = warehouses.find(w => w.id === h.warehouseId);
                    return (
                      <tr key={h.historyNo} className="border-b border-slate-900 hover:bg-slate-900/30 text-slate-300 print:border-slate-200 print:text-slate-800 print:hover:bg-transparent">
                        <td className="p-3 font-mono text-slate-300 print:text-slate-800" title={`이력번호 ${h.historyNo}`}>{h.docNo || `(NO.${h.historyNo})`}</td>
                        <td className="p-3">{wh?.name || h.warehouseId}</td>
                        <td className="p-3 font-mono text-slate-400">{h.inventoryId}</td>
                        <td className="p-3">{inv?.name || '-'}</td>
                        <td className={`p-3 ${getTxTypeClass(h.txTypeCode)}`}>{getTxTypeLabel(h.txTypeCode)}</td>
                        <td className="p-3 text-right font-mono">{h.qty.toLocaleString()}</td>
                        <td className="p-3 text-right font-mono">{Math.round(h.unitPrice).toLocaleString()} 원</td>
                        <td className="p-3 text-right font-mono">{Math.round(h.amount).toLocaleString()} 원</td>
                        <td className="p-3 font-mono text-slate-400">{h.txDate}</td>
                        <td className="p-3">{h.userId}</td>
                        <td className="p-3 font-mono text-slate-500">{h.refNo || '-'}</td>
                        <td className="p-3 text-center font-mono text-xs text-slate-500">{h.refLineNo || '-'}</td>
                        <td className="p-3 text-right print:hidden">
                          <button
                            onClick={() => handleOpenSlip(h)}
                            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-blue-400 transition-colors border-0 cursor-pointer bg-transparent"
                            title="전표 보기 및 인쇄"
                          >
                            <Printer size={13} />
                          </button>
                        </td>
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
            <div className="p-6 border-b border-slate-800 flex justify-between items-center shrink-0">
              <h2 className="text-lg font-bold text-slate-200">재고 입출고 및 이동 일괄 등록</h2>
              <button
                onClick={() => setIsTxModalOpen(false)}
                className="text-slate-500 hover:text-slate-300 p-1 hover:bg-slate-800 rounded transition-colors border-0 cursor-pointer bg-transparent"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">그리드 상에서 여러 품목의 재고 트랜잭션을 일괄 작성 후 반영합니다.</span>
                <button
                  type="button"
                  onClick={handleAddGridRow}
                  className="bg-slate-850 hover:bg-slate-800 border border-slate-800 text-blue-400 rounded-lg px-2.5 py-1.5 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Plus size={12} />
                  <span>행 추가</span>
                </button>
              </div>

              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/20">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 select-none">
                      <th className="p-3 font-semibold w-24">구분</th>
                      <th className="p-3 font-semibold w-40">출발 창고</th>
                      <th className="p-3 font-semibold w-48">자재 (재고품목)</th>
                      <th className="p-3 font-semibold w-24 text-right">수량</th>
                      <th className="p-3 font-semibold w-32 text-right">단가 (입고 시)</th>
                      <th className="p-3 font-semibold w-40">도착 창고 (이동 시)</th>
                      <th className="p-3 font-semibold w-32">처리일자</th>
                      <th className="p-3 font-semibold w-12 text-center">삭제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txGrid.length === 0 ? (
                      <tr><td colSpan={8} className="p-8 text-center text-slate-600">추가된 트랜잭션 행이 없습니다.</td></tr>
                    ) : (
                      txGrid.map((row, idx) => (
                        <tr key={idx} className="border-b border-slate-900 hover:bg-slate-900/30 text-slate-300">
                          <td className="p-2">
                            <select
                              value={row.txTypeCode}
                              onChange={(e) => handleGridChange(idx, 'txTypeCode', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-850 focus:border-blue-500 rounded py-1.5 px-2 text-xs text-slate-200 outline-none"
                            >
                              <option value="IN">입고 (IN)</option>
                              <option value="OUT">출고 (OUT)</option>
                              <option value="MOVE">이동 (MOVE)</option>
                              <option value="ADJ">조정 (ADJ)</option>
                            </select>
                          </td>
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
                              disabled={row.txTypeCode === 'OUT' || row.txTypeCode === 'MOVE'}
                              value={row.unitPrice}
                              onChange={(e) => handleGridChange(idx, 'unitPrice', parseInt(e.target.value) || 0)}
                              className="w-full bg-slate-950 border border-slate-850 focus:border-blue-500 rounded py-1.5 px-2 text-right text-xs text-slate-200 outline-none disabled:opacity-30"
                            />
                          </td>
                          <td className="p-2">
                            <select
                              disabled={row.txTypeCode !== 'MOVE'}
                              value={row.targetWarehouseId}
                              onChange={(e) => handleGridChange(idx, 'targetWarehouseId', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-850 focus:border-blue-500 rounded py-1.5 px-2 text-xs text-slate-300 outline-none disabled:opacity-30"
                            >
                              {warehouses.map(w => (
                                <option key={w.id} value={w.id}>{w.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              type="date"
                              value={row.txDate}
                              onChange={(e) => handleGridChange(idx, 'txDate', e.target.value)}
                              className="w-full bg-slate-950 border border-slate-850 focus:border-blue-500 rounded py-1.5 px-2 text-xs text-slate-200 outline-none"
                            />
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
                className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 px-5 text-xs font-semibold transition-all cursor-pointer border-0 disabled:opacity-50"
              >
                저장 및 재고 반영 (평균단가 계산)
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
              <h2 className="text-lg font-bold text-slate-200">재고 거래 전표 (Slip)</h2>
              <button onClick={() => setIsSlipOpen(false)} className="text-slate-500 hover:text-slate-300 border-0 cursor-pointer bg-transparent"><X size={20} /></button>
            </div>

            {/* 화면 상세 (인쇄 제외 — 인쇄는 전용 SlipPrint) */}
            <div className="p-8 space-y-6 text-xs text-slate-300 print:hidden">
              {/* 전표 양식 디자인 */}
              <div className="text-center mb-8 border-b-2 border-slate-800 pb-4">
                <h1 className="text-2xl font-extrabold tracking-widest text-slate-900 uppercase">
                  {selectedSlip.txTypeCode === 'IN' ? '입 고 증'
                    : selectedSlip.txTypeCode === 'OUT' ? '출 고 증'
                    : selectedSlip.txTypeCode === 'ADJ' ? '재 고 조 정 전 표'
                    : '재 고 이 동 전 표'}
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
                    <span className="text-slate-500 block">거래 구분</span>
                    <span className="bg-slate-850 px-2 py-0.5 rounded text-[10px] font-semibold text-slate-300 print:border print:border-slate-300">
                      {getTxTypeLabel(selectedSlip.txTypeCode)} ({selectedSlip.txTypeCode})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">승인 담당자 서명</span>
                    <span className="text-slate-400 font-semibold">{selectedSlip.userId} (인)</span>
                  </div>
                </div>

                {selectedSlip.refNo && (
                  <div className="bg-slate-950 p-2.5 rounded font-mono text-[10px] text-slate-500 border border-slate-900 print:bg-slate-50 print:border-slate-200">
                    {selectedSlip.refModule === 'PUR'
                      ? <>* 구매요청 출처: <strong className="text-slate-300 print:text-slate-800">{selectedSlip.refNo}</strong></>
                      : <>* 연계 이동 참조: {selectedSlip.refNo} ({selectedSlip.refModule})</>}
                  </div>
                )}
              </div>

              {/* Signature layout placeholder for formal slips */}
              <div className="grid grid-cols-2 border border-slate-700 text-center text-[10px] rounded-xl print:border-slate-400 print:rounded-none">
                <div className="p-3 border-r border-slate-700 print:border-slate-400">
                  <span className="text-slate-500 block mb-3">인도인 (지출자)</span>
                  <div className="h-6 border-b border-dashed border-slate-800 mx-8 print:border-slate-300"></div>
                </div>
                <div className="p-3">
                  <span className="text-slate-500 block mb-3">인수인 (수령자)</span>
                  <div className="h-6 border-b border-dashed border-slate-800 mx-8 print:border-slate-300"></div>
                </div>
              </div>

              {/* Print Footer Details */}
              <div className="flex justify-between text-[8px] text-slate-600 font-mono border-t border-slate-850 pt-2 print:border-slate-200">
                <span>Tenant: {selectedSlip.companyId}</span>
                <span>System generated transaction slip.</span>
              </div>
            </div>

            {/* 전용 인쇄뷰 (흑백) */}
            <SlipPrint
              txTypeCode={selectedSlip.txTypeCode}
              txTypeLabel={getTxTypeLabel(selectedSlip.txTypeCode)}
              docNo={selectedSlip.docNo}
              historyNo={selectedSlip.historyNo}
              txDate={selectedSlip.txDate}
              companyId={selectedSlip.companyId}
              warehouseName={warehouses.find((w) => w.id === selectedSlip.warehouseId)?.name || selectedSlip.warehouseId}
              inventoryId={selectedSlip.inventoryId}
              inventoryName={inventories.find((i) => i.id === selectedSlip.inventoryId)?.name || '-'}
              qty={selectedSlip.qty}
              unitPrice={selectedSlip.unitPrice}
              amount={selectedSlip.amount}
              userId={selectedSlip.userId}
              refNo={selectedSlip.refNo}
              refModule={selectedSlip.refModule}
            />

            {/* Footer buttons */}
            <div className="p-6 border-t border-slate-800 flex justify-end gap-2 shrink-0 print:hidden">
              <button
                type="button"
                onClick={() => setIsSlipOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg py-2 px-4 text-xs font-semibold cursor-pointer border-0"
              >
                닫기
              </button>
              {/* IN/OUT 전표는 역분개 취소 가능 — 후속 거래 없을 때만(서버 검증) */}
              {(selectedSlip.txTypeCode === 'IN' || selectedSlip.txTypeCode === 'OUT') && selectedSlip.docNo && (
                <button
                  type="button"
                  onClick={async () => {
                    const label = selectedSlip.txTypeCode === 'IN' ? '입고' : '출고';
                    if (!confirm(`전표 ${selectedSlip.docNo}을(를) 역분개로 취소합니다.\n이 ${label} 이후 동일 품목·창고에 거래가 없을 때만 가능합니다. 진행할까요?`)) return;
                    try {
                      await axiosInstance.post(`/procurement/slips/cancel/${encodeURIComponent(selectedSlip.docNo!)}`);
                      alert(`${label} 전표가 역분개로 취소되었습니다.`);
                      setIsSlipOpen(false);
                      const res = await axiosInstance.get('/inventory-tx/history');
                      setHistoryList(res.data || []);
                    } catch (e: any) {
                      alert(e.response?.data?.message || '취소 실패');
                    }
                  }}
                  className="bg-rose-700 hover:bg-rose-600 text-white rounded-lg py-2 px-4 text-xs font-semibold cursor-pointer border-0"
                >
                  {selectedSlip.txTypeCode === 'IN' ? '입고' : '출고'} 취소(역분개)
                </button>
              )}
              <button
                type="button"
                onClick={() => window.print()}
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
