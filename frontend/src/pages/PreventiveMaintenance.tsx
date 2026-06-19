import { useState, useEffect } from 'react';
import axiosInstance from '../api/axios';
import { useAuthStore } from '../store/useAuthStore';
import { getCommonStatusLabel as getStatusLabel, getCommonStatusClass as getStatusClass } from '../constants/status';
import { formatDateOnly, todayLocal } from '../utils/datetime';
import { getApiErrorMessage } from '../utils/apiError';
import PrintHeader from '../components/PrintHeader';
import PmReportPrint from '../components/PmReportPrint';
import ApprovalSubmitModal from '../components/ApprovalSubmitModal';
import { 
  ClipboardList, Edit2, Trash2, Printer, X, Calendar, ClipboardCheck, ArrowRight, User, Plus
} from 'lucide-react';

interface PmSchedule {
  equipmentId: string;
  equipmentName: string;
  plantId: string;
  checkTypeCode: string;
  cycleVal: number;
  cycleUnit: string;
  lastCheckDate: string | null;
  nextCheckDate: string;
}

interface PmRecord {
  id: string;
  plantId: string;
  equipmentId: string;
  departmentId: string;
  checkTypeCode: string;
  workDate: string;
  workerId: string;
  judgeCode: string;
  remarks: string | null;
  certNumber: string | null;
  certExpireDate: string | null;
  certAgency: string | null;
  approvalId: string | null;
  status: string; // T, S, P, C, R, X
}

interface PmRecordItem {
  itemNo: number;
  checkName: string;
  checkMethod: string;
  minValue: number | null;
  maxValue: number | null;
  baseValue: number | null;
  unit: string;
  checkValue: number | null;
}

interface EquipmentOption {
  id: string;
  plantId: string;
  name: string;
}

export default function PreventiveMaintenance() {
  const user = useAuthStore((s) => s.user);
  const [activeSubTab, setActiveSubTab] = useState<'schedule' | 'history'>('schedule');

  const [schedules, setSchedules] = useState<PmSchedule[]>([]);
  const [records, setRecords] = useState<PmRecord[]>([]);
  const [depts, setDepts] = useState<{ id: string; name: string }[]>([]);
  const [equipments, setEquipments] = useState<EquipmentOption[]>([]);
  const [usersList, setUsersList] = useState<{ id: string; name: string }[]>([]);

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isManualEntry, setIsManualEntry] = useState(false);
  
  // Fields for PM
  const [pmNo, setPmNo] = useState(''); // Empty for new
  const [plantId, setPlantId] = useState('');
  const [equipmentId, setEquipmentId] = useState('');
  const [equipmentName, setEquipmentName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [checkTypeCode, setCheckTypeCode] = useState('');
  const [workDate, setWorkDate] = useState(todayLocal());
  const [workerId, setWorkerId] = useState('');
  const [judgeCode, setJudgeCode] = useState('OK');
  const [remarks, setRemarks] = useState('');
  const [certNumber, setCertNumber] = useState('');
  const [certExpireDate, setCertExpireDate] = useState('');
  const [certAgency, setCertAgency] = useState('');
  const [approvalId, setApprovalId] = useState('');
  const [status, setStatus] = useState('T');

  const [checkItems, setCheckItems] = useState<PmRecordItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [approvalRef, setApprovalRef] = useState<{ refNo: string; title: string } | null>(null);

  const canDirectConfirm = user?.permissions?.PM?.A === 'Y';

  const fetchData = async () => {
    try {
      const [schedRes, recordRes, deptRes, equipmentRes, userRes] = await Promise.all([
        axiosInstance.get('/pm/schedules'),
        axiosInstance.get('/pm/records'),
        axiosInstance.get('/mdm/departments'),
        axiosInstance.get('/master/equipments'),
        axiosInstance.get('/mdm/users')
      ]);
      setSchedules((schedRes.data || []).map((schedule: PmSchedule) => ({
        ...schedule,
        lastCheckDate: formatDateOnly(schedule.lastCheckDate) || null,
        nextCheckDate: formatDateOnly(schedule.nextCheckDate),
      })));
      setRecords((recordRes.data || []).map((record: PmRecord) => ({
        ...record,
        workDate: formatDateOnly(record.workDate),
        certExpireDate: formatDateOnly(record.certExpireDate) || null,
      })));
      setDepts(deptRes.data);
      setEquipments(equipmentRes.data);
      setUsersList(userRes.data);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: getApiErrorMessage(err, '목록을 불러오지 못했습니다.') });
    }
  };

  useEffect(() => { fetchData(); }, []);

  const resetNewRecord = () => {
    setPmNo('');
    setPlantId('');
    setEquipmentId('');
    setEquipmentName('');
    setDepartmentId(user?.departmentId || (depts.length > 0 ? depts[0].id : ''));
    setCheckTypeCode('');
    setWorkDate(todayLocal());
    setWorkerId(user?.id || '');
    setJudgeCode('OK');
    setRemarks('');
    setCertNumber('');
    setCertExpireDate('');
    setCertAgency('');
    setApprovalId('');
    setStatus('T');
    setCheckItems([]);
  };

  const handleOpenManualEntry = () => {
    resetNewRecord();
    setIsManualEntry(true);
    setIsFormOpen(true);
  };

  const handleManualEquipmentChange = async (value: string) => {
    const selected = equipments.find((equipment) => `${equipment.plantId}:${equipment.id}` === value);
    if (!selected) {
      setPlantId('');
      setEquipmentId('');
      setEquipmentName('');
      setCheckItems([]);
      return;
    }

    setPlantId(selected.plantId);
    setEquipmentId(selected.id);
    setEquipmentName(selected.name);
    try {
      const itemRes = await axiosInstance.get(`/pm/records/initial-items?plantId=${selected.plantId}&equipmentId=${selected.id}`);
      setCheckItems(itemRes.data || []);
    } catch (err) {
      setCheckItems([]);
      setMessage({ type: 'error', text: getApiErrorMessage(err, '설비 점검 항목을 불러오지 못했습니다.') });
    }
  };

  const handleOpenCreateFromSchedule = async (sched: PmSchedule) => {
    setIsLoading(true);
    try {
      // Fetch initial check items from equipment template
      const itemRes = await axiosInstance.get(`/pm/records/initial-items?plantId=${sched.plantId}&equipmentId=${sched.equipmentId}`);
      
      setIsManualEntry(false);
      setPmNo('');
      setPlantId(sched.plantId);
      setEquipmentId(sched.equipmentId);
      setEquipmentName(sched.equipmentName);
      setDepartmentId(user?.departmentId || (depts.length > 0 ? depts[0].id : ''));
      setCheckTypeCode(sched.checkTypeCode);
      setWorkDate(todayLocal());
      setWorkerId(user?.id || '');
      setJudgeCode('OK');
      setRemarks('');
      setCertNumber('');
      setCertExpireDate('');
      setCertAgency('');
      setApprovalId('');
      setStatus('T');
      setCheckItems(itemRes.data || []);
      
      setIsFormOpen(true);
    } catch (err) {
      alert(getApiErrorMessage(err, '설비 점검 항목을 불러오지 못했습니다.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenEdit = async (record: PmRecord) => {
    setIsLoading(true);
    try {
      setIsManualEntry(false);
      const res = await axiosInstance.get(`/pm/records/details?plantId=${record.plantId}&id=${record.id}`);
      const data = res.data;
      const r = data.pmRecord;
      
      // Fetch equipment name
      let eqName = r.equipmentId;
      try {
        const eqRes = await axiosInstance.get(`/master/equipments/details?plantId=${r.plantId}&id=${r.equipmentId}`);
        eqName = eqRes.data.equipment.name;
      } catch (e) {}

      setPmNo(r.id);
      setPlantId(r.plantId);
      setEquipmentId(r.equipmentId);
      setEquipmentName(eqName);
      setDepartmentId(r.departmentId);
      setCheckTypeCode(r.checkTypeCode);
      setWorkDate(formatDateOnly(r.workDate));
      setWorkerId(r.workerId);
      setJudgeCode(r.judgeCode);
      setRemarks(r.remarks || '');
      setCertNumber(r.certNumber || '');
      setCertExpireDate(formatDateOnly(r.certExpireDate));
      setCertAgency(r.certAgency || '');
      setApprovalId(r.approvalId || '');
      setStatus(r.status);
      setCheckItems(data.checkItems || []);
      
      setIsFormOpen(true);
    } catch (err) {
      alert(getApiErrorMessage(err, '점검 상세 기록을 불러오지 못했습니다.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (record: PmRecord) => {
    if (!confirm('정말 이 점검 기록을 삭제하시겠습니까?')) return;
    try {
      await axiosInstance.delete(`/pm/records?plantId=${record.plantId}&id=${record.id}`);
      setMessage({ type: 'success', text: '점검 기록이 삭제되었습니다.' });
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: getApiErrorMessage(err, '삭제 실패.') });
    }
  };

  const handleItemValueChange = (idx: number, val: string) => {
    setCheckItems(checkItems.map((item, i) => {
      if (i === idx) {
        return {
          ...item,
          checkValue: val === '' ? null : parseFloat(val)
        };
      }
      return item;
    }));
  };

  const handleSave = async (submitStatus: 'T' | 'S' | 'P') => {
    if (!plantId || !equipmentId || !checkTypeCode || !workDate || !departmentId) {
      setMessage({ type: 'error', text: '설비, 점검유형, 점검일자, 부서는 필수입니다.' });
      return;
    }
    setIsLoading(true);
    setMessage(null);
    try {
      const saveStatus = submitStatus === 'P' ? 'T' : submitStatus;
      const payload = {
        pmRecord: {
          id: pmNo || null,
          plantId,
          equipmentId,
          departmentId,
          checkTypeCode,
          workDate,
          workerId,
          judgeCode,
          remarks: remarks || null,
          certNumber: certNumber || null,
          certExpireDate: certExpireDate || null,
          certAgency: certAgency || null,
          approvalId: approvalId || null,
          status: saveStatus
        },
        checkItems
      };

      const response = await axiosInstance.post('/pm/records', payload);
      if (submitStatus === 'P') {
        const savedId = response.data.id;
        setPmNo(savedId);
        setStatus('T');
        setApprovalRef({ refNo: savedId, title: `[예방점검] ${equipmentName || equipmentId}` });
        return;
      }
      setMessage({ 
        type: 'success', 
        text: submitStatus === 'T' 
          ? '임시저장 되었습니다.' 
          : '점검이 직접 확정 및 완료 처리되었습니다. (차기 스케줄 갱신됨)'
      });
      setIsFormOpen(false);
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: getApiErrorMessage(err, '저장 중 오류가 발생했습니다.') });
    } finally {
      setIsLoading(false);
    }
  };


  const getJudgeLabel = (j: string) => {
    return { OK: '양호 (OK)', NG: '불량 (NG)', OTHER: '기타' }[j] || j;
  };

  return (
    <div className="space-y-6">
      {/* Header (print:hidden) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <ClipboardList size={24} className="text-blue-500" />
            예방점검 관리
          </h1>
          <p className="text-slate-400 text-sm mt-1">다음 점검일 도래 대상을 확인하여 현장 점검 결과를 기안 또는 확정합니다.</p>
        </div>

        <div className="flex items-center gap-3">
        {activeSubTab === 'history' && (
          <button
            onClick={() => window.print()}
            className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Printer size={14} />
            가로 목록 인쇄
          </button>
        )}
        {activeSubTab === 'schedule' && (
          <button
            onClick={handleOpenManualEntry}
            className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border-0"
          >
            <Plus size={14} />
            입력
          </button>
        )}
        {/* Subtab control */}
        <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-lg">
          <button
            onClick={() => setActiveSubTab('schedule')}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer border-0 outline-none ${
              activeSubTab === 'schedule' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            입력
          </button>
          <button
            onClick={() => setActiveSubTab('history')}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer border-0 outline-none ${
              activeSubTab === 'history' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            목록
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

      {/* Main content grid (print:block) */}
      <div className={`bg-slate-900 border border-slate-800 rounded-xl p-6 print:border-0 print:bg-transparent print:p-0 print-landscape ${isFormOpen ? 'print:hidden' : ''}`}>
        
        {/* TAB 1: SCHEDULE */}
        {activeSubTab === 'schedule' && (
          <div className="space-y-4 print:hidden">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
              <Calendar size={16} className="text-blue-500" />
              점검 기한이 도래한 설비 스케줄 (오늘 기준)
            </h3>
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 select-none">
                    <th className="p-3 font-semibold">설비코드</th>
                    <th className="p-3 font-semibold">설비명</th>
                    <th className="p-3 font-semibold">점검유형</th>
                    <th className="p-3 font-semibold">주기</th>
                    <th className="p-3 font-semibold">지난 점검일</th>
                    <th className="p-3 font-semibold">다음 점검일</th>
                    <th className="p-3 font-semibold text-right">점검수행</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.length === 0 ? (
                    <tr><td colSpan={7} className="p-8 text-center text-slate-600">오늘 점검 주기가 도래한 대상 설비가 없습니다.</td></tr>
                  ) : (
                    schedules.map((sched, idx) => (
                      <tr key={idx} className="border-b border-slate-900 hover:bg-slate-900/30 text-slate-300">
                        <td className="p-3 font-mono text-slate-400">{sched.equipmentId}</td>
                        <td className="p-3 font-semibold text-slate-200">{sched.equipmentName}</td>
                        <td className="p-3 font-mono text-slate-400">{sched.checkTypeCode}</td>
                        <td className="p-3">{sched.cycleVal}{sched.cycleUnit === 'M' ? '개월' : sched.cycleUnit === 'D' ? '일' : sched.cycleUnit === 'W' ? '주' : '년'}</td>
                        <td className="p-3 text-slate-500">{sched.lastCheckDate || '기록없음'}</td>
                        <td className="p-3 font-semibold text-amber-500 print:text-black">{sched.nextCheckDate}</td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleOpenCreateFromSchedule(sched)}
                            className="bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 rounded-lg px-3 py-1.5 font-semibold text-[11px] transition-colors border border-blue-500/20 hover:border-blue-500/40 flex items-center gap-1 ml-auto cursor-pointer"
                          >
                            <span>점검 입력</span>
                            <ArrowRight size={12} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: HISTORY */}
        {activeSubTab === 'history' && (
          <div className="space-y-4 print:block">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5 print:hidden">
              <ClipboardCheck size={16} className="text-blue-500" />
              최근 예방점검 기록 이력 목록
            </h3>

            {/* Print Only Title */}
            <PrintHeader />
            <h1 className="hidden print:block text-center text-xl font-bold tracking-widest text-black border-b-2 border-black pb-2 mb-4">예 방 점 검 현 황</h1>

            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40 print:border-slate-300 print:bg-white print:rounded-none">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 select-none print:bg-slate-100 print:text-slate-800 print:border-slate-300">
                    <th className="p-3 font-semibold">점검번호</th>
                    <th className="p-3 font-semibold">설비코드</th>
                    <th className="p-3 font-semibold">점검일자</th>
                    <th className="p-3 font-semibold">점검자</th>
                    <th className="p-3 font-semibold">점검유형</th>
                    <th className="p-3 font-semibold">판정결과</th>
                    <th className="p-3 font-semibold">연계결재번호</th>
                    <th className="p-3 font-semibold">문서상태</th>
                    <th className="p-3 font-semibold text-right print:hidden">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {records.length === 0 ? (
                    <tr><td colSpan={9} className="p-8 text-center text-slate-600 print:text-slate-400">등록된 점검 이력이 없습니다.</td></tr>
                  ) : (
                    records.map((rec) => (
                      <tr key={rec.id} className="border-b border-slate-900 hover:bg-slate-900/30 text-slate-300 print:border-slate-200 print:text-slate-800 print:hover:bg-transparent">
                        <td className="p-3 font-mono text-slate-400 print:text-slate-600">{rec.id}</td>
                        <td className="p-3 font-semibold text-slate-200 print:text-slate-900">{rec.equipmentId}</td>
                        <td className="p-3">{rec.workDate}</td>
                        <td className="p-3">{rec.workerId}</td>
                        <td className="p-3 font-mono text-slate-500">{rec.checkTypeCode}</td>
                        <td className="p-3">
                          <span className={`font-semibold ${rec.judgeCode === 'OK' ? 'text-emerald-400 print:text-emerald-700' : 'text-rose-400 print:text-rose-700'}`}>
                            {getJudgeLabel(rec.judgeCode)}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-slate-500">{rec.approvalId || '-'}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${getStatusClass(rec.status)}`}>
                            {getStatusLabel(rec.status)}
                          </span>
                        </td>
                        <td className="p-3 text-right space-x-2 print:hidden">
                          <button
                            onClick={() => handleOpenEdit(rec)}
                            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-blue-400 transition-colors border-0 cursor-pointer bg-transparent"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDelete(rec)}
                            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-rose-400 transition-colors border-0 cursor-pointer bg-transparent"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Input / View Detail Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto print:absolute print:inset-0 print:bg-white print:p-0">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl print:border-0 print:shadow-none print:max-h-none print:w-full print:h-full">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex justify-between items-center shrink-0 print:hidden">
              <h2 className="text-lg font-bold text-slate-200">
                {pmNo ? `예방점검 상세/수정 [${pmNo}]` : `신규 예방점검 기록 입력`}
              </h2>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-slate-500 hover:text-slate-300 p-1 hover:bg-slate-800 rounded transition-colors border-0 cursor-pointer bg-transparent"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 print:hidden">

              {/* Status Header Area */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block mb-0.5">점검번호</span>
                  <span className="font-mono font-semibold text-slate-300">{pmNo || '(저장 시 자동발행)'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">문서 상태</span>
                  <div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${getStatusClass(status)}`}>
                      {getStatusLabel(status)}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">결재 문서 번호</span>
                  <span className="font-mono text-slate-300">{approvalId || '미연계 (결재 상신 전)'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">최종 갱신자</span>
                  <span className="text-slate-300">{workerId}</span>
                </div>
              </div>

              {/* Input Form Grid divided into [일반 정보], [작업 정보], [법정 인증 정보] */}
              <div className="space-y-6">
                {/* [일반 정보] 섹션 */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider pl-2 border-l-2 border-blue-500 print:text-slate-800 print:border-slate-400">
                    [일반 정보]
                  </h4>
                  <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-5 print:bg-white print:border-slate-300">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div>
                        <label className="block text-slate-400 mb-1.5 print:text-slate-600">대상 설비 <span className="text-rose-500 print:hidden">*</span></label>
                        {isManualEntry && !pmNo ? (
                          <select
                            value={plantId && equipmentId ? `${plantId}:${equipmentId}` : ''}
                            onChange={(e) => handleManualEquipmentChange(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none"
                          >
                            <option value="">-- 설비 선택 --</option>
                            {equipments.map((equipment) => (
                              <option key={`${equipment.plantId}:${equipment.id}`} value={`${equipment.plantId}:${equipment.id}`}>
                                {equipment.name} ({equipment.id})
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            disabled
                            value={equipmentName}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-slate-200 outline-none disabled:opacity-80 print:bg-white print:border-slate-300 print:text-slate-800"
                          />
                        )}
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1.5 print:text-slate-600">점검자 ID</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-600">
                            <User size={14} />
                          </div>
                          <input
                            type="text"
                            disabled
                            value={workerId}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 pl-8 pr-3 text-slate-200 outline-none disabled:opacity-80 print:bg-white print:border-slate-300 print:text-slate-800"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* [작업 정보] 섹션 */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider pl-2 border-l-2 border-emerald-500 print:text-slate-800 print:border-slate-400">
                    [작업 정보]
                  </h4>
                  <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-5 print:bg-white print:border-slate-300">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      {isManualEntry && !pmNo && (
                        <div>
                          <label className="block text-slate-400 mb-1.5 print:text-slate-600">점검 유형 <span className="text-rose-500 print:hidden">*</span></label>
                          <select
                            value={checkTypeCode}
                            onChange={(e) => setCheckTypeCode(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-300 outline-none"
                          >
                            <option value="">-- 점검 유형 선택 --</option>
                            <option value="INSPECT">예방점검</option>
                            <option value="PATROL">순회점검</option>
                            <option value="REPLACE">소모품교체</option>
                            <option value="LEGAL">정기법정검사</option>
                          </select>
                        </div>
                      )}
                      <div>
                        <label className="block text-slate-400 mb-1.5 print:text-slate-600">점검 일자 <span className="text-rose-500 print:hidden">*</span></label>
                        <input
                          type="date"
                          required
                          value={workDate}
                          onChange={(e) => setWorkDate(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none print:bg-white print:border-slate-300 print:text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1.5 print:text-slate-600">종합 판정</label>
                        <select
                          value={judgeCode}
                          onChange={(e) => setJudgeCode(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-300 outline-none print:bg-white print:border-slate-300 print:text-slate-800"
                        >
                          <option value="OK">양호 (OK)</option>
                          <option value="NG">불량 (NG)</option>
                          <option value="OTHER">기타</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-slate-400 mb-1.5 print:text-slate-600">특이 사항 (비고)</label>
                        <textarea
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          placeholder="특이사항 상세 기술"
                          rows={2}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none resize-none print:bg-white print:border-slate-300 print:text-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* [법정 인증 정보] 섹션 */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider pl-2 border-l-2 border-amber-500 print:text-slate-800 print:border-slate-400">
                    [법정 인증 정보]
                  </h4>
                  <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-5 print:bg-white print:border-slate-300">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                      <div>
                        <label className="block text-slate-400 mb-1.5 print:text-slate-600">법정검사 인증번호</label>
                        <input
                          type="text"
                          value={certNumber}
                          onChange={(e) => setCertNumber(e.target.value)}
                          placeholder="인증번호 (법정검사 시)"
                          className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none print:bg-white print:border-slate-300 print:text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1.5 print:text-slate-600">인증 기관</label>
                        <input
                          type="text"
                          value={certAgency}
                          onChange={(e) => setCertAgency(e.target.value)}
                          placeholder="인증 기관"
                          className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none print:bg-white print:border-slate-300 print:text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1.5 print:text-slate-600">인증 유효 만료일</label>
                        <input
                          type="date"
                          value={certExpireDate}
                          onChange={(e) => setCertExpireDate(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none print:bg-white print:border-slate-300 print:text-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Items checklist (Accordion-like or list layout) */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider border-l-2 border-blue-500 pl-2 print:text-slate-850 print:border-slate-400">점검 세부 항목 리스트</h3>
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/20 print:border-slate-300 print:rounded-none">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 select-none print:bg-slate-100 print:text-slate-800 print:border-slate-300">
                        <th className="p-3 font-semibold w-12 text-center">번호</th>
                        <th className="p-3 font-semibold">점검 항목</th>
                        <th className="p-3 font-semibold">점검 방법</th>
                        <th className="p-3 font-semibold text-center">기준 범위 (Min ~ Max)</th>
                        <th className="p-3 font-semibold text-center w-36">점검 측정값</th>
                        <th className="p-3 font-semibold w-16">단위</th>
                      </tr>
                    </thead>
                    <tbody>
                      {checkItems.length === 0 ? (
                        <tr><td colSpan={6} className="p-8 text-center text-slate-600 print:text-slate-400">점검할 항목이 등록되어 있지 않습니다.</td></tr>
                      ) : (
                        checkItems.map((item, idx) => (
                          <tr key={idx} className="border-b border-slate-900 hover:bg-slate-900/30 text-slate-300 print:border-slate-200 print:text-slate-800 print:hover:bg-transparent">
                            <td className="p-3 text-center text-slate-500">{idx + 1}</td>
                            <td className="p-3 font-semibold text-slate-200 print:text-slate-900">{item.checkName}</td>
                            <td className="p-3 text-slate-400 print:text-slate-600">{item.checkMethod || '-'}</td>
                            <td className="p-3 text-center text-slate-400 print:text-slate-600">
                              {item.minValue !== null || item.maxValue !== null ? (
                                <span className="font-mono">
                                  {item.minValue !== null ? item.minValue : '-'} ~ {item.maxValue !== null ? item.maxValue : '-'}
                                  {item.baseValue !== null && ` (기준: ${item.baseValue})`}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="p-2 text-center">
                              <input
                                type="number"
                                step="any"
                                value={item.checkValue === null ? '' : item.checkValue}
                                onChange={(e) => handleItemValueChange(idx, e.target.value)}
                                placeholder="측정치 입력"
                                className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-1 px-2.5 text-center text-xs text-slate-200 outline-none print:border-slate-300 print:bg-white print:text-slate-800"
                              />
                            </td>
                            <td className="p-3 text-slate-500">{item.unit || '-'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* 전용 인쇄뷰 (흑백) — 화면 숨김, 인쇄/PDF 저장 시에만 노출 */}
            <PmReportPrint
              pmNo={pmNo}
              status={status}
              approvalId={approvalId}
              deptName={depts.find((d) => d.id === departmentId)?.name || departmentId}
              workerId={workerId}
              workDate={workDate}
              equipmentName={equipmentName}
              checkTypeCode={checkTypeCode}
              judgeCode={judgeCode}
              certNumber={certNumber}
              certAgency={certAgency}
              certExpireDate={certExpireDate}
              remarks={remarks}
              checkItems={checkItems}
            />

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-800 flex justify-between items-center shrink-0 print:hidden">
              <div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-750 px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer size={14} />
                  인쇄 / PDF 저장
                </button>
              </div>
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg py-2 px-4 text-xs font-semibold transition-colors cursor-pointer border-0"
                >
                  닫기
                </button>
                <button
                  onClick={() => handleSave('T')}
                  disabled={isLoading}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-750 rounded-lg py-2 px-4 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                >
                  임시 저장
                </button>
                <button
                  onClick={() => handleSave('P')}
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 px-4 text-xs font-semibold transition-colors cursor-pointer border-0 disabled:opacity-50"
                >
                  결재 상신
                </button>
                {canDirectConfirm && (
                  <button
                    onClick={() => handleSave('S')}
                    disabled={isLoading}
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg py-2 px-5 text-xs font-semibold transition-all cursor-pointer border-0 disabled:opacity-50 shadow-md shadow-emerald-950/20"
                  >
                    직접 확정 (Save)
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      <ApprovalSubmitModal
        open={!!approvalRef}
        refModule="PM"
        refNo={approvalRef?.refNo || ''}
        defaultTitle={approvalRef?.title || ''}
        users={usersList}
        currentUserId={user?.id}
        onClose={() => setApprovalRef(null)}
        onSubmitted={(newApprovalId) => {
          setApprovalId(newApprovalId);
          setStatus('P');
          setApprovalRef(null);
          setIsFormOpen(false);
          setMessage({ type: 'success', text: '예방점검 결재 문서가 상신되었습니다.' });
          fetchData();
        }}
      />
    </div>
  );
}
