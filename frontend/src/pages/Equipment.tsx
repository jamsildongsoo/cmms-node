import { useState, useEffect } from 'react';
import axiosInstance from '../api/axios';
import PrintHeader from '../components/PrintHeader';
import { getApiErrorMessage } from '../utils/apiError';
import { formatDateOnly } from '../utils/datetime';
import { 
  Wrench, Plus, Edit2, Trash2, Printer, Save, X, PlusCircle, MinusCircle, FileSpreadsheet, RefreshCw 
} from 'lucide-react';

interface EquipmentType {
  id: string;
  plantId: string;
  name: string;
  location: string | null;
  eqTypeCode: string | null;
  installDate: string | null;
  workPermitYn: string;
  makerName: string | null;
  spec: string | null;
  model: string | null;
  serialNumber: string | null;
  remarks: string | null;
  lastCheckDate: string | null;
  nextCheckDate: string | null;
}

interface CheckItem {
  itemNo?: number;
  checkName: string;
  checkMethod: string;
  minValue: number | null;
  maxValue: number | null;
  baseValue: number | null;
  unit: string;
}

interface CheckCycle {
  checkTypeCode: string;
  cycleVal: number | null;
  cycleUnit: string;
  lastCheckDate: string | null;
  nextCheckDate: string | null;
}

export default function Equipment() {
  const [equipments, setEquipments] = useState<EquipmentType[]>([]);
  const [plants, setPlants] = useState<{ id: string; name: string }[]>([]);
  const [selectedPlantId, setSelectedPlantId] = useState('');
  
  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Equipment Fields
  const [id, setId] = useState('');
  const [plantId, setPlantId] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [eqTypeCode, setEqTypeCode] = useState('PUMP'); // Default
  const [installDate, setInstallDate] = useState('');
  const [workPermitYn, setWorkPermitYn] = useState('N');
  const [makerName, setMakerName] = useState('');
  const [spec, setSpec] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [remarks, setRemarks] = useState('');

  // Combined Check Items
  const [checkItems, setCheckItems] = useState<CheckItem[]>([]);

  // Combined Check Cycles
  const [checkCycles, setCheckCycles] = useState<CheckCycle[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = async () => {
    try {
      const [eqRes, plantRes] = await Promise.all([
        axiosInstance.get('/master/equipments'),
        axiosInstance.get('/mdm/plants')
      ]);
      setEquipments(eqRes.data);
      setPlants(plantRes.data);
      if (plantRes.data.length > 0 && !plantId) {
        setPlantId(plantRes.data[0].id);
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: getApiErrorMessage(err, '목록을 불러오지 못했습니다.') });
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleOpenCreate = () => {
    setEditingId(null);
    setId('');
    setName('');
    setLocation('');
    if (plants.length > 0) setPlantId(plants[0].id);
    setEqTypeCode('PUMP');
    setInstallDate('');
    setWorkPermitYn('N');
    setMakerName('');
    setSpec('');
    setModel('');
    setSerialNumber('');
    setRemarks('');
    setCheckItems([]);
    setCheckCycles([]);
    setIsFormOpen(true);
  };

  const handleOpenEdit = async (eq: EquipmentType) => {
    try {
      const res = await axiosInstance.get(`/master/equipments/details?plantId=${eq.plantId}&id=${eq.id}`);
      const data = res.data;
      const targetEq = data.equipment;
      
      setEditingId(targetEq.id);
      setId(targetEq.id);
      setPlantId(targetEq.plantId);
      setName(targetEq.name);
      setLocation(targetEq.location || '');
      setEqTypeCode(targetEq.eqTypeCode || '');
      setInstallDate(formatDateOnly(targetEq.installDate));
      setWorkPermitYn(targetEq.workPermitYn || 'N');
      setMakerName(targetEq.makerName || '');
      setSpec(targetEq.spec || '');
      setModel(targetEq.model || '');
      setSerialNumber(targetEq.serialNumber || '');
      setRemarks(targetEq.remarks || '');
      setCheckItems(data.checkItems || []);
      setCheckCycles((data.checkCycles || []).map((c: any) => ({
        checkTypeCode: c.checkTypeCode,
        cycleVal: c.cycleVal,
        cycleUnit: c.cycleUnit,
        lastCheckDate: formatDateOnly(c.lastCheckDate) || null,
        nextCheckDate: formatDateOnly(c.nextCheckDate) || null,
      })));
      
      setIsFormOpen(true);
    } catch (err) {
      alert(getApiErrorMessage(err, '설비 상세 내역을 불러오지 못했습니다.'));
    }
  };

  const handleDelete = async (eq: EquipmentType) => {
    if (!confirm('정말 이 설비를 삭제하시겠습니까?')) return;
    try {
      await axiosInstance.delete(`/master/equipments?plantId=${eq.plantId}&id=${eq.id}`);
      setMessage({ type: 'success', text: '설비가 성공적으로 삭제되었습니다.' });
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: getApiErrorMessage(err, '설비 삭제 실패.') });
    }
  };

  const handleAddCheckItem = () => {
    setCheckItems([...checkItems, { checkName: '', checkMethod: '', minValue: null, maxValue: null, baseValue: null, unit: '' }]);
  };

  const handleRemoveCheckItem = (idx: number) => {
    setCheckItems(checkItems.filter((_, i) => i !== idx));
  };

  const handleCheckItemChange = (idx: number, field: keyof CheckItem, val: any) => {
    setCheckItems(checkItems.map((item, i) => {
      if (i === idx) {
        return { ...item, [field]: val === '' ? null : val };
      }
      return item;
    }));
  };

  const handleAddCheckCycle = () => {
    setCheckCycles([...checkCycles, { checkTypeCode: '', cycleVal: null, cycleUnit: 'M', lastCheckDate: null, nextCheckDate: null }]);
  };

  const handleRemoveCheckCycle = (idx: number) => {
    setCheckCycles(checkCycles.filter((_, i) => i !== idx));
  };

  const handleCheckCycleChange = (idx: number, field: keyof CheckCycle, val: any) => {
    setCheckCycles(checkCycles.map((item, i) => {
      if (i === idx) {
        return { ...item, [field]: val === '' ? null : val };
      }
      return item;
    }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !name || !plantId) return;

    setIsLoading(true);
    setMessage(null);
    try {
      const payload = {
        equipment: {
          id, plantId, name, location: location || null, eqTypeCode: eqTypeCode || null,
          installDate: installDate || null, workPermitYn, makerName: makerName || null,
          spec: spec || null, model: model || null, serialNumber: serialNumber || null,
          remarks: remarks || null
        },
        checkItems,
        checkCycles: checkCycles.map(c => ({
          checkTypeCode: c.checkTypeCode,
          cycleVal: c.cycleVal ? Number(c.cycleVal) : null,
          cycleUnit: c.cycleUnit,
          lastCheckDate: c.lastCheckDate || null,
          nextCheckDate: c.nextCheckDate || null,
        }))
      };

      await axiosInstance.post('/master/equipments', payload);
      setMessage({ type: 'success', text: '설비 정보가 성공적으로 저장되었습니다.' });
      setIsFormOpen(false);
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: getApiErrorMessage(err, '저장 중 오류가 발생했습니다.') });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCsvDownload = async () => {
    try {
      const res = await axiosInstance.get('/master/equipments/csv', { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'equipments_export.csv');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert(getApiErrorMessage(err, 'CSV 다운로드 실패'));
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Filter list by selected plant
  const filteredEquipments = selectedPlantId 
    ? equipments.filter(e => e.plantId === selectedPlantId) 
    : equipments;

  return (
    <div className="space-y-6 print-area print-landscape">
      <PrintHeader />
      <h1 className="hidden print:block text-center text-xl font-bold tracking-widest text-black border-b-2 border-black pb-2 mb-4">설비 마스터 목록</h1>

      {/* Header and top buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Wrench size={24} className="text-blue-500" />
            설비 마스터 관리
          </h1>
          <p className="text-slate-400 text-sm mt-1">공장 내 설비 목록을 등록하고 각 설비별 정기 점검 항목을 지정합니다.</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleCsvDownload}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-750 px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileSpreadsheet size={15} />
            CSV 내보내기
          </button>
          <button
            onClick={handlePrint}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-750 px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Printer size={15} />
            가로 목록 인쇄
          </button>
          <button
            onClick={handleOpenCreate}
            className="bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border-0"
          >
            <Plus size={15} />
            입력
          </button>
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

      {/* Filter and Grid (print:block) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 print:border-0 print:bg-transparent print:p-0">
        <div className="flex items-center gap-2 mb-4 print:hidden">
          <span className="text-xs text-slate-400 font-semibold uppercase">플랜트 필터:</span>
          <select
            value={selectedPlantId}
            onChange={(e) => setSelectedPlantId(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-3 text-slate-300 text-xs outline-none focus:border-blue-500"
          >
            <option value="">전체 보기</option>
            {plants.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Equipment Table Grid */}
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40 print:border-slate-300 print:bg-white print:rounded-none">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 select-none print:bg-slate-100 print:text-slate-800 print:border-slate-300">
                <th className="p-3 font-semibold">설비코드</th>
                <th className="p-3 font-semibold">설비명</th>
                <th className="p-3 font-semibold">플랜트</th>
                <th className="p-3 font-semibold">설치위치</th>
                <th className="p-3 font-semibold">설치일자</th>
                <th className="p-3 font-semibold">제조사</th>
                <th className="p-3 font-semibold">모델</th>
                <th className="p-3 font-semibold">지난 점검일</th>
                <th className="p-3 font-semibold">다음 점검일</th>
                <th className="p-3 font-semibold">작업허가</th>
                <th className="p-3 font-semibold text-right print:hidden">작업</th>
              </tr>
            </thead>
            <tbody>
              {filteredEquipments.length === 0 ? (
                <tr><td colSpan={11} className="p-8 text-center text-slate-600 print:text-slate-400">등록된 설비 내역이 없습니다.</td></tr>
              ) : (
                filteredEquipments.map((eq) => (
                  <tr key={eq.id} className="border-b border-slate-900 hover:bg-slate-900/30 text-slate-300 print:border-slate-200 print:text-slate-800 print:hover:bg-transparent">
                    <td className="p-3 font-mono text-slate-400 print:text-slate-600">{eq.id}</td>
                    <td className="p-3 font-semibold text-slate-200 print:text-slate-900">{eq.name}</td>
                    <td className="p-3">{plants.find(p => p.id === eq.plantId)?.name || eq.plantId}</td>
                    <td className="p-3 text-slate-400 print:text-slate-600">{eq.location || '-'}</td>
                    <td className="p-3 text-slate-400 print:text-slate-600">{formatDateOnly(eq.installDate) || '-'}</td>
                    <td className="p-3 text-slate-400 print:text-slate-600">{eq.makerName || '-'}</td>
                    <td className="p-3 text-slate-400 print:text-slate-600">{eq.model || '-'}</td>
                    <td className="p-3 text-slate-400 print:text-slate-600">{formatDateOnly(eq.lastCheckDate) || '-'}</td>
                    <td className="p-3 font-semibold text-amber-500 print:text-black">{formatDateOnly(eq.nextCheckDate) || '-'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        eq.workPermitYn === 'Y' 
                          ? 'bg-amber-950 text-amber-400 border border-amber-900 print:bg-amber-100 print:text-amber-800' 
                          : 'bg-slate-950 text-slate-500 border border-slate-900 print:bg-slate-100 print:text-slate-400'
                      }`}>
                        {eq.workPermitYn === 'Y' ? '대상' : '미대상'}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-2 print:hidden">
                      <button
                        onClick={() => handleOpenEdit(eq)}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-blue-400 transition-colors border-0 cursor-pointer bg-transparent"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(eq)}
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

      {/* Detail Input Dialog/Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex justify-between items-center shrink-0">
              <h2 className="text-lg font-bold text-slate-200">
                {editingId ? `설비 수정 (${editingId})` : '신규 설비 등록'}
              </h2>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-slate-500 hover:text-slate-300 p-1 hover:bg-slate-800 rounded transition-colors border-0 cursor-pointer bg-transparent"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* [기본 정보] 섹션 */}
              <div>
                <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-3 border-l-2 border-blue-500 pl-2">
                  [기본 정보]
                </h3>
                <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div>
                      <label className="block text-slate-400 mb-1.5">플랜트 지정 <span className="text-rose-500">*</span></label>
                      <select
                        value={plantId}
                        onChange={(e) => setPlantId(e.target.value)}
                        disabled={!!editingId}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-300 outline-none transition-colors"
                      >
                        {plants.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1.5">설비 코드 <span className="text-rose-500">*</span></label>
                      <input
                        type="text"
                        required
                        disabled={!!editingId}
                        value={id}
                        onChange={(e) => setId(e.target.value)}
                        placeholder="예: EQ_PMP001"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none transition-colors disabled:opacity-50"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-slate-400 mb-1.5">설비명 <span className="text-rose-500">*</span></label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="예: 제1송수 펌프 모터"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1.5">설비 구분 타입</label>
                      <select
                        value={eqTypeCode}
                        onChange={(e) => setEqTypeCode(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-300 outline-none transition-colors"
                      >
                        <option value="PUMP">펌프 (PUMP)</option>
                        <option value="MOTOR">모터 (MOTOR)</option>
                        <option value="BOILER">보일러 (BOILER)</option>
                        <option value="VALVE">밸브 (VALVE)</option>
                        <option value="COMPRESSOR">압축기 (COMPRESSOR)</option>
                        <option value="PANEL">전기판넬 (PANEL)</option>
                        <option value="ETC">기타 설비 (ETC)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1.5">설치 위치</label>
                      <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="예: 공장 동편 기계실"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1.5">설치 일자</label>
                      <input
                        type="date"
                        value={installDate}
                        onChange={(e) => setInstallDate(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1.5">작업허가 대상</label>
                      <select
                        value={workPermitYn}
                        onChange={(e) => setWorkPermitYn(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-300 outline-none transition-colors"
                      >
                        <option value="N">미대상 (일반작업)</option>
                        <option value="Y">대상 (안전허가 요구)</option>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
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
                      <label className="block text-slate-400 mb-1.5">일련번호 (S/N)</label>
                      <input
                        type="text"
                        value={serialNumber}
                        onChange={(e) => setSerialNumber(e.target.value)}
                        placeholder="Serial Number"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none transition-colors"
                      />
                    </div>
                    <div className="sm:col-span-2 md:col-span-1">
                      <label className="block text-slate-400 mb-1.5">제조사 스펙상세</label>
                      <input
                        type="text"
                        value={spec}
                        onChange={(e) => setSpec(e.target.value)}
                        placeholder="예: 220V, 60Hz, 15kW"
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
                  <div className="grid grid-cols-1 gap-4 text-xs">
                    <div>
                      <label className="block text-slate-400 mb-1.5">비고 및 설명</label>
                      <textarea
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="설비 관련 설명 또는 특이사항 기록"
                        rows={2}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none transition-colors resize-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Check Items Section */}
              <div>
                <div className="flex justify-between items-center mb-4 border-l-2 border-blue-500 pl-2">
                  <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider">설비 정기 점검 항목</h3>
                  <button
                    type="button"
                    onClick={handleAddCheckItem}
                    className="bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1 transition-colors border-0 cursor-pointer"
                  >
                    <PlusCircle size={14} />
                    점검항목 추가
                  </button>
                </div>

                <div className="space-y-3">
                  {checkItems.length === 0 ? (
                    <div className="border border-dashed border-slate-800 p-6 text-center text-slate-500 text-xs rounded-xl">
                      등록된 점검항목이 없습니다. 우측 상단의 추가 버튼을 눌러 점검 항목을 추가해 주세요.
                    </div>
                  ) : (
                    checkItems.map((item, idx) => (
                      <div key={idx} className="flex gap-3 bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs relative items-center">
                        <div className="flex-1 space-y-3">
                          {/* 1번째 줄: 점검항목명, 점검방법 */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-slate-500 text-[10px] mb-1">점검항목명</label>
                              <input
                                type="text"
                                required
                                value={item.checkName}
                                onChange={(e) => handleCheckItemChange(idx, 'checkName', e.target.value)}
                                placeholder="예: 모터 내부 온도"
                                className="w-full bg-slate-900 border border-slate-850 focus:border-blue-500 rounded-lg py-1.5 px-3 text-slate-200 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-slate-500 text-[10px] mb-1">점검방법</label>
                              <input
                                type="text"
                                value={item.checkMethod}
                                onChange={(e) => handleCheckItemChange(idx, 'checkMethod', e.target.value)}
                                placeholder="예: 열화상 카메라 측정"
                                className="w-full bg-slate-900 border border-slate-850 focus:border-blue-500 rounded-lg py-1.5 px-3 text-slate-200 outline-none"
                              />
                            </div>
                          </div>

                          {/* 2번째 줄: 최소값, 최대값, 기준값, 단위 */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                              <label className="block text-slate-500 text-[10px] mb-1">최소값</label>
                              <input
                                type="number"
                                step="any"
                                value={item.minValue === null ? '' : item.minValue}
                                onChange={(e) => handleCheckItemChange(idx, 'minValue', e.target.value)}
                                placeholder="Min"
                                className="w-full bg-slate-900 border border-slate-850 focus:border-blue-500 rounded-lg py-1.5 px-3 text-slate-200 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-slate-500 text-[10px] mb-1">최대값</label>
                              <input
                                type="number"
                                step="any"
                                value={item.maxValue === null ? '' : item.maxValue}
                                onChange={(e) => handleCheckItemChange(idx, 'maxValue', e.target.value)}
                                placeholder="Max"
                                className="w-full bg-slate-900 border border-slate-850 focus:border-blue-500 rounded-lg py-1.5 px-3 text-slate-200 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-slate-500 text-[10px] mb-1">기준값</label>
                              <input
                                type="number"
                                step="any"
                                value={item.baseValue === null ? '' : item.baseValue}
                                onChange={(e) => handleCheckItemChange(idx, 'baseValue', e.target.value)}
                                placeholder="Base"
                                className="w-full bg-slate-900 border border-slate-850 focus:border-blue-500 rounded-lg py-1.5 px-3 text-slate-200 outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-slate-500 text-[10px] mb-1">단위</label>
                              <input
                                type="text"
                                value={item.unit}
                                onChange={(e) => handleCheckItemChange(idx, 'unit', e.target.value)}
                                placeholder="예: ℃, A, V"
                                className="w-full bg-slate-900 border border-slate-850 focus:border-blue-500 rounded-lg py-1.5 px-3 text-slate-200 outline-none"
                              />
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveCheckItem(idx)}
                          className="p-2 bg-slate-900 hover:bg-slate-850 text-rose-500 rounded-lg transition-colors border-0 cursor-pointer self-center"
                        >
                          <MinusCircle size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Check Cycles Section */}
              <div>
                <div className="flex justify-between items-center mb-4 border-l-2 border-emerald-500 pl-2">
                  <div>
                    <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">설비 정기 점검 주기</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">점검유형별 주기를 등록하면 예방점검 스케줄에 자동 반영됩니다.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCheckCycle}
                    className="bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-lg px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1 transition-colors border-0 cursor-pointer"
                  >
                    <RefreshCw size={13} />
                    주기 추가
                  </button>
                </div>

                <div className="space-y-3">
                  {checkCycles.length === 0 ? (
                    <div className="border border-dashed border-slate-800 p-6 text-center text-slate-500 text-xs rounded-xl">
                      등록된 점검주기가 없습니다. 주기 추가 버튼으로 점검 주기를 등록해 주세요.
                    </div>
                  ) : (
                    checkCycles.map((cycle, idx) => (
                      <div key={idx} className="flex gap-3 bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs items-end">
                        <div className="flex-1 grid grid-cols-2 lg:grid-cols-5 gap-3">
                          <div>
                            <label className="block text-slate-500 text-[10px] mb-1">점검유형 <span className="text-rose-500">*</span></label>
                            <select
                              value={cycle.checkTypeCode}
                              onChange={(e) => handleCheckCycleChange(idx, 'checkTypeCode', e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg py-1.5 px-2 text-slate-200 outline-none"
                            >
                              <option value="">-- 선택 --</option>
                              <option value="INSPECT">예방점검</option>
                              <option value="PATROL">순회점검</option>
                              <option value="REPLACE">소모품교체</option>
                              <option value="LEGAL">정기법정검사</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-slate-500 text-[10px] mb-1">주기 값 <span className="text-rose-500">*</span></label>
                            <input
                              type="number"
                              min="1"
                              value={cycle.cycleVal === null ? '' : cycle.cycleVal}
                              onChange={(e) => handleCheckCycleChange(idx, 'cycleVal', e.target.value)}
                              placeholder="예: 3"
                              className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg py-1.5 px-3 text-slate-200 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-500 text-[10px] mb-1">주기 단위 <span className="text-rose-500">*</span></label>
                            <select
                              value={cycle.cycleUnit}
                              onChange={(e) => handleCheckCycleChange(idx, 'cycleUnit', e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg py-1.5 px-3 text-slate-200 outline-none"
                            >
                              <option value="D">일 (D)</option>
                              <option value="W">주 (W)</option>
                              <option value="M">월 (M)</option>
                              <option value="Y">년 (Y)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-slate-500 text-[10px] mb-1">지난 점검일</label>
                            <input
                              type="date"
                              value={cycle.lastCheckDate || ''}
                              onChange={(e) => handleCheckCycleChange(idx, 'lastCheckDate', e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg py-1.5 px-3 text-slate-200 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-500 text-[10px] mb-1">다음 점검일</label>
                            <input
                              type="date"
                              value={cycle.nextCheckDate || ''}
                              onChange={(e) => handleCheckCycleChange(idx, 'nextCheckDate', e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-lg py-1.5 px-3 text-slate-200 outline-none"
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveCheckCycle(idx)}
                          className="p-2 bg-slate-900 hover:bg-slate-850 text-rose-500 rounded-lg transition-colors border-0 cursor-pointer mb-0"
                        >
                          <MinusCircle size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </form>

            {/* Modal Footer */}
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
                {isLoading ? '저장 중...' : '설비 저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
