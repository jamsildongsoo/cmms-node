import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { requestConfirmation } from '../utils/userActionDialog';
import { useAuthStore } from '../store/useAuthStore';
import axiosInstance from '../api/axios';
import { getApiErrorMessage } from '../utils/apiError';
import {
  Package, Plus, Edit2, Trash2, Printer, Save, X, FileSpreadsheet
} from 'lucide-react';

interface InventoryType {
  id: string;
  name: string;
  invTypeCode: string | null;
  departmentId: string | null;
  unit: string | null;
  makerName: string | null;
  spec: string | null;
  model: string | null;
  serialNumber: string | null;
  safetyQty: number;
  reorderQty: number;
  leadTimeDays: number;
  remarks: string | null;
}

export default function Inventory() {
  const [inventories, setInventories] = useState<InventoryType[]>([]);
  const [depts, setDepts] = useState<{ id: string; name: string }[]>([]);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Inventory fields state
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [invTypeCode, setInvTypeCode] = useState('INV_TYPE_01');
  const [departmentId, setDepartmentId] = useState('');
  const [unit, setUnit] = useState('');
  const [makerName, setMakerName] = useState('');
  const [spec, setSpec] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [safetyQty, setSafetyQty] = useState(0);
  const [reorderQty, setReorderQty] = useState(0);
  const [leadTimeDays, setLeadTimeDays] = useState(0);
  const [remarks, setRemarks] = useState('');

  const [isLoading, setIsLoading] = useState(false);

  const fetchData = async () => {
    try {
      const [invRes, deptRes] = await Promise.all([
        axiosInstance.get('/master/inventories'),
        axiosInstance.get('/mdm/departments')
      ]);
      setInventories(invRes.data);
      setDepts(deptRes.data);
    } catch (err) {
      console.error(err);
      toast.error(getApiErrorMessage(err, '목록을 불러오지 못했습니다.'));
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleOpenCreate = () => {
    setEditingId(null);
    setId('');
    setName('');
    setInvTypeCode('INV_TYPE_01');
    setDepartmentId(depts.length > 0 ? depts[0].id : '');
    setUnit('');
    setMakerName('');
    setSpec('');
    setModel('');
    setSerialNumber('');
    setSafetyQty(0);
    setReorderQty(0);
    setLeadTimeDays(0);
    setRemarks('');
    setIsFormOpen(true);
  };

  const handleOpenEdit = (inv: InventoryType) => {
    setEditingId(inv.id);
    setId(inv.id);
    setName(inv.name);
    setInvTypeCode(inv.invTypeCode || '');
    setDepartmentId(inv.departmentId || '');
    setUnit(inv.unit || '');
    setMakerName(inv.makerName || '');
    setSpec(inv.spec || '');
    setModel(inv.model || '');
    setSerialNumber(inv.serialNumber || '');
    setSafetyQty(inv.safetyQty);
    setReorderQty(inv.reorderQty);
    setLeadTimeDays(inv.leadTimeDays);
    setRemarks(inv.remarks || '');
    setIsFormOpen(true);
  };

  const handleDelete = async (invId: string) => {
    if (!(await requestConfirmation('정말 이 자재 품목을 삭제하시겠습니까?'))) return;
    try {
      await axiosInstance.delete(`/master/inventories/${invId}`);
      toast.success('자재 품목이 삭제되었습니다.');
      fetchData();
    } catch (err) {
      toast.error(getApiErrorMessage(err, '삭제에 실패했습니다.'));
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !name) return;

    setIsLoading(true);
    try {
      const payload = {
        id, name, invTypeCode, departmentId: departmentId || null,
        unit: unit || null, makerName: makerName || null, spec: spec || null,
        model: model || null, serialNumber: serialNumber || null,
        safetyQty, reorderQty, leadTimeDays, remarks: remarks || null
      };

      await axiosInstance.post('/master/inventories', payload);
      toast.success('자재 마스터가 저장되었습니다.');
      setIsFormOpen(false);
      fetchData();
    } catch (err) {
      toast.error(getApiErrorMessage(err, '저장 실패.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCsvDownload = async () => {
    try {
      const res = await axiosInstance.get('/master/inventories/csv', { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'inventory_export.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'CSV 다운로드 실패'));
    }
  };

  const handlePrint = () => {
    const user = useAuthStore.getState().user;
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

    const printData = {
      inventories,
      depts,
      companyName: user?.companyName || user?.companyId || 'CMMS',
      printerName: user?.name || '-',
      printDate: stamp,
    };

    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) {
      toast.error('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.');
      return;
    }

    // 새 창 제목 설정 (브라우저 탭 표시용)
    printWindow.document.title = '자재 마스터 목록 - 인쇄';

    // 새 창에 React 없이 직접 HTML 렌더링
    const rows = printData.inventories.map(inv => `
      <tr>
        <td class="mono">${inv.id}</td>
        <td class="name">${inv.name}</td>
        <td>${inv.unit || '-'}</td>
        <td>${printData.depts.find(d => d.id === inv.departmentId)?.name || inv.departmentId || '-'}</td>
        <td>${inv.makerName || '-'}</td>
        <td>${inv.model || '-'}</td>
        <td>${inv.safetyQty}</td>
        <td>${inv.reorderQty}</td>
        <td>${inv.leadTimeDays}일</td>
      </tr>
    `).join('');

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>자재 마스터 목록 - 인쇄</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 10mm 10mm 14mm 10mm;
      @bottom-right {
        content: counter(page) " / " counter(pages);
        font-size: 8pt;
        color: #666;
      }
    }
    @page :first { margin-top: 10mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #000; padding: 10mm; }
    .print-log { display: flex; justify-content: space-between; font-size: 8pt; color: #666; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 8px; }
    .header { text-align: center; font-size: 16pt; font-weight: bold; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 9pt; }
    th, td { padding: 6px 8px; border: 1px solid #ccc; text-align: left; }
    th { background: #f0f0f0; font-weight: bold; }
    td.mono { font-family: monospace; }
    td.name { font-weight: 600; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="no-print" style="text-align:right; margin-bottom:12px;">
    <button onclick="window.print()" style="padding:8px 20px; background:#2563eb; color:#fff; border:none; border-radius:6px; cursor:pointer; font-size:10pt;">인쇄</button>
  </div>
  <div class="print-log">
    <span>회사: ${printData.companyName}</span>
    <span>출력자: ${printData.printerName} &nbsp;|&nbsp; 출력일시: ${printData.printDate}</span>
  </div>
  <div class="header">자재 마스터 목록</div>
  <table>
    <thead>
      <tr>
        <th>자재코드</th><th>자재명</th><th>단위</th><th>부서</th><th>제조사</th><th>모델</th><th>안전재고</th><th>재주문점</th><th>리드타임</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="9" style="text-align:center;padding:24px;color:#999;">등록된 자재가 없습니다.</td></tr>'}
    </tbody>
  </table>
</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
  };

  return (
    <div className="space-y-6">
      {/* Header and top actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Package size={24} className="text-blue-500" />
            자재/재고 마스터 관리
          </h1>
          <p className="text-slate-400 text-sm mt-1">부품 및 자재 품목을 마스터에 등록하고 안전재고 기준을 설정합니다.</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleCsvDownload}
            className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileSpreadsheet size={14} />
            CSV
          </button>
          <button
            onClick={handlePrint}
            className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Printer size={14} />
            목록 인쇄
          </button>
          <button
            onClick={handleOpenCreate}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border-0"
          >
            <Plus size={15} />
            입력
          </button>
        </div>
      </div>

      {/* Grid container */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 print:border-0 print:bg-transparent print:p-0">
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40 print:border-slate-300 print:bg-white print:rounded-none">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 select-none print:bg-slate-100 print:text-slate-800 print:border-slate-300">
                <th className="p-3 font-semibold">자재코드</th>
                <th className="p-3 font-semibold">자재명</th>
                <th className="p-3 font-semibold">단위</th>
                <th className="p-3 font-semibold">부서</th>
                <th className="p-3 font-semibold">제조사</th>
                <th className="p-3 font-semibold">모델</th>
                <th className="p-3 font-semibold">안전재고</th>
                <th className="p-3 font-semibold">재주문점</th>
                <th className="p-3 font-semibold">리드타임</th>
                <th className="p-3 font-semibold text-right print:hidden">작업</th>
              </tr>
            </thead>
            <tbody>
              {inventories.length === 0 ? (
                <tr><td colSpan={10} className="p-8 text-center text-slate-600 print:text-slate-400">등록된 자재가 없습니다.</td></tr>
              ) : (
                inventories.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-900 hover:bg-slate-900/30 text-slate-300 print:border-slate-200 print:text-slate-800 print:hover:bg-transparent">
                    <td className="p-3 font-mono text-slate-400 print:text-slate-600">{inv.id}</td>
                    <td className="p-3 font-semibold text-slate-200 print:text-slate-900">{inv.name}</td>
                    <td className="p-3 text-slate-400 print:text-slate-600">{inv.unit || '-'}</td>
                    <td className="p-3">{depts.find(d => d.id === inv.departmentId)?.name || inv.departmentId || '-'}</td>
                    <td className="p-3 text-slate-400 print:text-slate-600">{inv.makerName || '-'}</td>
                    <td className="p-3 text-slate-400 print:text-slate-600">{inv.model || '-'}</td>
                    <td className="p-3 font-semibold text-slate-300 print:text-slate-800">{inv.safetyQty}</td>
                    <td className="p-3 text-slate-400 print:text-slate-600">{inv.reorderQty}</td>
                    <td className="p-3 text-slate-400 print:text-slate-600">{inv.leadTimeDays}일</td>
                    <td className="p-3 text-right space-x-2 print:hidden">
                      <button
                        onClick={() => handleOpenEdit(inv)}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-blue-400 transition-colors border-0 cursor-pointer bg-transparent"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(inv.id)}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-rose-400 transition-colors border-0 cursor-pointer bg-transparent"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Input Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center shrink-0">
              <h2 className="text-lg font-bold text-slate-200">
                {editingId ? `자재 마스터 수정 (${editingId})` : '신규 자재 등록'}
              </h2>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-slate-500 hover:text-slate-300 p-1 hover:bg-slate-800 rounded transition-colors border-0 cursor-pointer bg-transparent"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
              {/* [기본 정보] 섹션 */}
              <div>
                <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-3 border-l-2 border-blue-500 pl-2">
                  [기본 정보]
                </h3>
                <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-slate-400 mb-1.5">자재 코드 <span className="text-rose-500">*</span></label>
                      <input
                        type="text"
                        required
                        disabled={!!editingId}
                        value={id}
                        onChange={(e) => setId(e.target.value)}
                        placeholder="예: INV_BOLT_M10"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none transition-colors disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1.5">자재 품명 <span className="text-rose-500">*</span></label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="예: 육각 볼트 M10 (100mm)"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1.5">자재 구분타입</label>
                      <select
                        value={invTypeCode}
                        onChange={(e) => setInvTypeCode(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-300 outline-none transition-colors"
                      >
                        <option value="INV_TYPE_01">예비부품 (Spare Part)</option>
                        <option value="INV_TYPE_02">소모성 공구 (Tool)</option>
                        <option value="INV_TYPE_03">부자재 (Material)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1.5">단위</label>
                      <input
                        type="text"
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        placeholder="예: EA, BOX, SET"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1.5">관리 부서</label>
                      <select
                        value={departmentId}
                        onChange={(e) => setDepartmentId(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-300 outline-none transition-colors"
                      >
                        <option value="">부서 미지정</option>
                        {depts.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* [제조사 및 스펙 정보] 섹션 */}
              <div>
                <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3 border-l-2 border-emerald-500 pl-2">
                  [제조사 및 스펙 정보]
                </h3>
                <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-slate-400 mb-1.5">제조사</label>
                      <input
                        type="text"
                        value={makerName}
                        onChange={(e) => setMakerName(e.target.value)}
                        placeholder="제조사명"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1.5">모델명</label>
                      <input
                        type="text"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        placeholder="모델명"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1.5">일련번호</label>
                      <input
                        type="text"
                        value={serialNumber}
                        onChange={(e) => setSerialNumber(e.target.value)}
                        placeholder="Serial Number"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1.5">규격/스펙상세</label>
                      <input
                        type="text"
                        value={spec}
                        onChange={(e) => setSpec(e.target.value)}
                        placeholder="예: 탄소강 고장력"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* [주문 관리] 섹션 */}
              <div>
                <h3 className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-3 border-l-2 border-amber-500 pl-2">
                  [주문 관리]
                </h3>
                <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-slate-400 mb-1.5">안전 재고 수량</label>
                      <input
                        type="number"
                        value={safetyQty}
                        onChange={(e) => setSafetyQty(parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1.5">재주문 기준수량 (ROP)</label>
                      <input
                        type="number"
                        value={reorderQty}
                        onChange={(e) => setReorderQty(parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1.5">구매 리드타임 (일)</label>
                      <input
                        type="number"
                        value={leadTimeDays}
                        onChange={(e) => setLeadTimeDays(parseInt(e.target.value) || 0)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* [운영 정보] 섹션 */}
              <div>
                <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-3 border-l-2 border-indigo-500 pl-2">
                  [운영 정보]
                </h3>
                <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-5">
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-slate-400 mb-1.5">비고 및 특이사항</label>
                      <textarea
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="특이사항 기록"
                        rows={2}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none transition-colors resize-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </form>

            <div className="p-6 border-t border-slate-800 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg py-2 px-4 text-xs font-semibold transition-colors cursor-pointer border-0"
              >
                취소
              </button>
              <button
                onClick={handleFormSubmit}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 px-6 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer border-0 disabled:opacity-50"
              >
                <Save size={14} />
                {isLoading ? '저장 중...' : '자재 저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
