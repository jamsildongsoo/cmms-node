import { useState, useEffect } from 'react';
import axiosInstance from '../api/axios';
import { useAuthStore } from '../store/useAuthStore';
import { getCommonStatusLabel as getStatusLabel, getCommonStatusClass as getStatusClass } from '../constants/status';
import { formatDateTime, nowLocalInput, utcToInput, inputToUtc } from '../utils/datetime';
import { getApiErrorMessage } from '../utils/apiError';
import PrintHeader from '../components/PrintHeader';
import WorkPermitPrint from '../components/WorkPermitPrint';
import ApprovalSubmitModal from '../components/ApprovalSubmitModal';
import { 
  ClipboardList, Edit2, Trash2, Printer, X, Plus, Download, CheckSquare, Square, ChevronDown, ChevronUp 
} from 'lucide-react';

interface WorkPermitModel {
  id: string;
  plantId: string;
  equipmentId: string;
  workOrderId: string | null;
  title: string;
  stepStage: string; // P: 계획, R: 실적
  permitTypeCodes: string; // GENERAL, FIRE 등 쉼표 구분
  startAt: string | null;
  endAt: string | null;
  departmentId: string;
  supervisorId: string;
  workSummary: string | null;
  riskFactors: string | null;
  safetyMeasures: string | null;
  jsonGeneral: string | null;
  jsonFire: string | null;
  jsonConfined: string | null;
  jsonElectric: string | null;
  jsonHighPlace: string | null;
  jsonExcavation: string | null;
  jsonHeavyLoad: string | null;
  remarks: string | null;
  fileGroupId: number | null;
  refNo: string | null;
  refModule: string | null;
  approvalId: string | null;
  status: string; // T, S, P, C, R, X
}

interface CheckItem {
  question: string;
  checked: boolean;
  remarks: string;
}

const INITIAL_GENERAL: CheckItem[] = [
  { question: '안전모, 안전화, 안전장갑 등 작업자 보호구 착용이 완료되었는가?', checked: false, remarks: '' },
  { question: '작업 구역 주변 안전 표지판 및 바리케이드를 설치하였는가?', checked: false, remarks: '' },
  { question: '작업 전 위험성 평가 및 현장 TBM(Tool Box Meeting)을 통해 안전 교육을 실시하였는가?', checked: false, remarks: '' }
];

const INITIAL_FIRE: CheckItem[] = [
  { question: '작업 장소 반경 11m 이내 가연성/인화성 물질을 제거 또는 방화막으로 격리하였는가?', checked: false, remarks: '' },
  { question: '현장 내 소화기를 적정 수량 비치하고 즉시 사용 가능 상태인가?', checked: false, remarks: '' },
  { question: '작업 중 불꽃 비산 방지포 설치 및 화재감시자를 별도 지정 배치하였는가?', checked: false, remarks: '' }
];

const INITIAL_CONFINED: CheckItem[] = [
  { question: '진입 전 밀폐공간 내 산소 및 유해가스 농도를 측정 완료하였는가?', checked: false, remarks: '' },
  { question: '작업 중 공기 배출 및 급기를 위해 송풍기를 지속 운전 중인가?', checked: false, remarks: '' },
  { question: '외부 감시인을 배치하고 비상 통신 장비 및 인명 구조용 장비를 갖추었는가?', checked: false, remarks: '' }
];

const INITIAL_ELECTRIC: CheckItem[] = [
  { question: '해당 선로의 전원 차단 후 LOTO(Lock-Out, Tag-Out) 잠금장치 및 꼬리표를 부착했는가?', checked: false, remarks: '' },
  { question: '검전기를 사용하여 무전압 상태임을 확인하였는가?', checked: false, remarks: '' },
  { question: '절연 보호구 및 절연 공구류를 점검 후 사용 중인가?', checked: false, remarks: '' }
];

const INITIAL_HIGH_PLACE: CheckItem[] = [
  { question: '높이 2m 이상 고소 작업으로 안전대 부착 설비에 안전줄을 견고히 체결했는가?', checked: false, remarks: '' },
  { question: '비계, 사다리, 고소작업대 등 발판의 안전성(아웃트리거 고정 등)을 점검했는가?', checked: false, remarks: '' },
  { question: '하부 낙하물 방지망 설치 또는 안전 통제 구역을 설정하여 신호수를 배치했는가?', checked: false, remarks: '' }
];

const INITIAL_EXCAVATION: CheckItem[] = [
  { question: '굴착 지역 내 지하 매설물(가스관, 전기선, 배관 등) 여부를 현장 조사 및 확인했는가?', checked: false, remarks: '' },
  { question: '굴착 사면의 붕괴 방지를 위해 흙막이 지보공을 설치하고 안전 구배를 준수하는가?', checked: false, remarks: '' },
  { question: '굴착 주변에 장비 진입 차단 펜스 및 안내 표지를 배치했는가?', checked: false, remarks: '' }
];

const INITIAL_HEAVY_LOAD: CheckItem[] = [
  { question: '크레인/이동식 크레인 등 양중 장비의 정격 하중 및 안전 장치 정상 여부를 확인했는가?', checked: false, remarks: '' },
  { question: '인양용 줄걸이 와이어 로프, 슬링 벨트의 소선 단선 또는 균열이 없는지 점검했는가?', checked: false, remarks: '' },
  { question: '양중 작업 반경 내 일반인의 진입을 철저히 차단하고 신호수를 배치했는가?', checked: false, remarks: '' }
];

export default function WorkPermit() {
  const user = useAuthStore((s) => s.user);


  const [permits, setPermits] = useState<WorkPermitModel[]>([]);
  const [equipments, setEquipments] = useState<{ id: string; name: string; plantId: string }[]>([]);
  const [depts, setDepts] = useState<{ id: string; name: string }[]>([]);
  const [usersList, setUsersList] = useState<{ id: string; name: string }[]>([]);
  const [workOrders, setWorkOrders] = useState<{ id: string; title: string }[]>([]);

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  // Fields for WorkPermit
  const [wpNo, setWpNo] = useState('');
  const [plantId, setPlantId] = useState('');
  const [equipmentId, setEquipmentId] = useState('');
  const [equipmentName, setEquipmentName] = useState('');
  const [workOrderId, setWorkOrderId] = useState('');
  const [title, setTitle] = useState('');
  const [stepStage, setStepStage] = useState('P');
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['GENERAL']); // GENERAL is always selected
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [supervisorId, setSupervisorId] = useState('');
  const [workSummary, setWorkSummary] = useState('');
  const [riskFactors, setRiskFactors] = useState('');
  const [safetyMeasures, setSafetyMeasures] = useState('');
  const [remarks, setRemarks] = useState('');
  const [refNo, setRefNo] = useState('');
  const [refModule, setRefModule] = useState('');
  const [approvalId, setApprovalId] = useState('');
  const [status, setStatus] = useState('T');

  // JSON Checksheets
  const [genChecks, setGenChecks] = useState<CheckItem[]>(INITIAL_GENERAL);
  const [fireChecks, setFireChecks] = useState<CheckItem[]>(INITIAL_FIRE);
  const [confChecks, setConfChecks] = useState<CheckItem[]>(INITIAL_CONFINED);
  const [elecChecks, setElecChecks] = useState<CheckItem[]>(INITIAL_ELECTRIC);
  const [highChecks, setHighChecks] = useState<CheckItem[]>(INITIAL_HIGH_PLACE);
  const [excaChecks, setExcaChecks] = useState<CheckItem[]>(INITIAL_EXCAVATION);
  const [heavyChecks, setHeavyChecks] = useState<CheckItem[]>(INITIAL_HEAVY_LOAD);

  // Accordion Expand states
  const [accordionOpen, setAccordionOpen] = useState<{ [key: string]: boolean }>({
    GENERAL: true,
    FIRE: false,
    CONFINED: false,
    ELECTRIC: false,
    HIGH_PLACE: false,
    EXCAVATION: false,
    HEAVY_LOAD: false
  });

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [approvalRef, setApprovalRef] = useState<{ refNo: string; title: string } | null>(null);

  const canDirectConfirm = user?.permissions?.WP?.A === 'Y';

  const fetchData = async () => {
    try {
      const [wpRes, eqRes, deptRes, userRes, woRes] = await Promise.all([
        axiosInstance.get('/work-permit'),
        axiosInstance.get('/master/equipments'),
        axiosInstance.get('/mdm/departments'),
        axiosInstance.get('/mdm/users'),
        axiosInstance.get('/work-order')
      ]);
      setPermits(wpRes.data);
      setEquipments(eqRes.data);
      setDepts(deptRes.data);
      setUsersList(userRes.data);
      setWorkOrders(woRes.data);
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: getApiErrorMessage(err, '목록을 불러오지 못했습니다.') });
    }
  };

  useEffect(() => { fetchData(); }, []);

  const toggleAccordion = (type: string) => {
    setAccordionOpen(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const handleTypeToggle = (type: string) => {
    if (type === 'GENERAL') return; // GENERAL cannot be toggled off
    
    let updated;
    if (selectedTypes.includes(type)) {
      updated = selectedTypes.filter(t => t !== type);
      setAccordionOpen(prev => ({ ...prev, [type]: false }));
    } else {
      updated = [...selectedTypes, type];
      setAccordionOpen(prev => ({ ...prev, [type]: true }));
    }
    setSelectedTypes(updated);
  };

  const handleCheckChange = (type: string, idx: number, field: 'checked' | 'remarks', val: any) => {
    const updater = (prev: CheckItem[]) => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item);
    switch (type) {
      case 'GENERAL': setGenChecks(updater); break;
      case 'FIRE': setFireChecks(updater); break;
      case 'CONFINED': setConfChecks(updater); break;
      case 'ELECTRIC': setElecChecks(updater); break;
      case 'HIGH_PLACE': setHighChecks(updater); break;
      case 'EXCAVATION': setExcaChecks(updater); break;
      case 'HEAVY_LOAD': setHeavyChecks(updater); break;
    }
  };

  const handleOpenCreate = () => {
    setWpNo('');
    setPlantId(equipments.length > 0 ? equipments[0].plantId : '');
    setEquipmentId(equipments.length > 0 ? equipments[0].id : '');
    setEquipmentName(equipments.length > 0 ? equipments[0].name : '');
    setWorkOrderId('');
    setTitle('');
    setStepStage('P');
    setSelectedTypes(['GENERAL']);
    setStartAt(nowLocalInput());
    setEndAt(utcToInput(new Date(Date.now() + 8 * 3600 * 1000).toISOString()));
    setDepartmentId(user?.departmentId || (depts.length > 0 ? depts[0].id : ''));
    setSupervisorId(user?.id || '');
    setWorkSummary('');
    setRiskFactors('');
    setSafetyMeasures('');
    setRemarks('');
    setRefNo('');
    setRefModule('');
    setApprovalId('');
    setStatus('T');

    // Reset checksheets
    setGenChecks(INITIAL_GENERAL);
    setFireChecks(INITIAL_FIRE);
    setConfChecks(INITIAL_CONFINED);
    setElecChecks(INITIAL_ELECTRIC);
    setHighChecks(INITIAL_HIGH_PLACE);
    setExcaChecks(INITIAL_EXCAVATION);
    setHeavyChecks(INITIAL_HEAVY_LOAD);

    setAccordionOpen({
      GENERAL: true, FIRE: false, CONFINED: false, ELECTRIC: false, HIGH_PLACE: false, EXCAVATION: false, HEAVY_LOAD: false
    });

    setIsFormOpen(true);
  };

  const handleOpenEdit = async (wp: WorkPermitModel) => {
    setIsLoading(true);
    try {
      const res = await axiosInstance.get(`/work-permit/details?plantId=${wp.plantId}&id=${wp.id}`);
      const w = res.data;
      
      const matchedEq = equipments.find(e => e.id === w.equipmentId);
      setEquipmentName(matchedEq ? matchedEq.name : w.equipmentId);

      setWpNo(w.id);
      setPlantId(w.plantId);
      setEquipmentId(w.equipmentId);
      setWorkOrderId(w.workOrderId || '');
      setTitle(w.title);
      setStepStage(w.stepStage);
      setSelectedTypes(w.permitTypeCodes.split(','));
      setStartAt(utcToInput(w.startAt));
      setEndAt(utcToInput(w.endAt));
      setDepartmentId(w.departmentId);
      setSupervisorId(w.supervisorId);
      setWorkSummary(w.workSummary || '');
      setRiskFactors(w.riskFactors || '');
      setSafetyMeasures(w.safetyMeasures || '');
      setRemarks(w.remarks || '');
      setRefNo(w.refNo || '');
      setRefModule(w.refModule || '');
      setApprovalId(w.approvalId || '');
      setStatus(w.status);

      // Parse JSON checksheets
      setGenChecks(w.jsonGeneral ? JSON.parse(w.jsonGeneral) : INITIAL_GENERAL);
      setFireChecks(w.jsonFire ? JSON.parse(w.jsonFire) : INITIAL_FIRE);
      setConfChecks(w.jsonConfined ? JSON.parse(w.jsonConfined) : INITIAL_CONFINED);
      setElecChecks(w.jsonElectric ? JSON.parse(w.jsonElectric) : INITIAL_ELECTRIC);
      setHighChecks(w.jsonHighPlace ? JSON.parse(w.jsonHighPlace) : INITIAL_HIGH_PLACE);
      setExcaChecks(w.jsonExcavation ? JSON.parse(w.jsonExcavation) : INITIAL_EXCAVATION);
      setHeavyChecks(w.jsonHeavyLoad ? JSON.parse(w.jsonHeavyLoad) : INITIAL_HEAVY_LOAD);

      // Accordion setup based on selected types
      const types = w.permitTypeCodes.split(',');
      setAccordionOpen({
        GENERAL: true,
        FIRE: types.includes('FIRE'),
        CONFINED: types.includes('CONFINED'),
        ELECTRIC: types.includes('ELECTRIC'),
        HIGH_PLACE: types.includes('HIGH_PLACE'),
        EXCAVATION: types.includes('EXCAVATION'),
        HEAVY_LOAD: types.includes('HEAVY_LOAD')
      });

      setIsFormOpen(true);
    } catch (err) {
      alert(getApiErrorMessage(err, '작업허가서 상세 기록을 불러오지 못했습니다.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (wp: WorkPermitModel) => {
    if (!confirm('정말 이 작업허가서를 삭제하시겠습니까?')) return;
    try {
      await axiosInstance.delete(`/work-permit?plantId=${wp.plantId}&id=${wp.id}`);
      setMessage({ type: 'success', text: '작업허가서가 삭제되었습니다.' });
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: getApiErrorMessage(err, '삭제 실패.') });
    }
  };

  const handleSave = async (submitStatus: 'T' | 'S' | 'P') => {
    if (!title.trim()) {
      alert('허가서 제목을 입력해주세요.');
      return;
    }
    setIsLoading(true);
    setMessage(null);
    try {
      const saveStatus = submitStatus === 'P' ? 'T' : submitStatus;
      const payload = {
        id: wpNo || null,
        plantId,
        equipmentId,
        workOrderId: workOrderId || null,
        title,
        stepStage,
        permitTypeCodes: selectedTypes.join(','),
        startAt: inputToUtc(startAt),
        endAt: inputToUtc(endAt),
        departmentId,
        supervisorId,
        workSummary: workSummary || null,
        riskFactors: riskFactors || null,
        safetyMeasures: safetyMeasures || null,
        jsonGeneral: JSON.stringify(genChecks),
        jsonFire: selectedTypes.includes('FIRE') ? JSON.stringify(fireChecks) : null,
        jsonConfined: selectedTypes.includes('CONFINED') ? JSON.stringify(confChecks) : null,
        jsonElectric: selectedTypes.includes('ELECTRIC') ? JSON.stringify(elecChecks) : null,
        jsonHighPlace: selectedTypes.includes('HIGH_PLACE') ? JSON.stringify(highChecks) : null,
        jsonExcavation: selectedTypes.includes('EXCAVATION') ? JSON.stringify(excaChecks) : null,
        jsonHeavyLoad: selectedTypes.includes('HEAVY_LOAD') ? JSON.stringify(heavyChecks) : null,
        remarks: remarks || null,
        refNo: refNo || null,
        refModule: refModule || null,
        approvalId: approvalId || null,
        status: saveStatus
      };

      const response = await axiosInstance.post('/work-permit', payload);
      if (submitStatus === 'P') {
        const savedId = response.data.id;
        setWpNo(savedId);
        setStatus('T');
        setApprovalRef({ refNo: savedId, title: `[작업허가서] ${title}` });
        return;
      }
      setMessage({ 
        type: 'success', 
        text: submitStatus === 'T' 
          ? '임시저장 되었습니다.' 
          : '안전작업허가서가 직접 확정 발급 완료되었습니다.'
      });
      setIsFormOpen(false);
      fetchData();
    } catch (err) {
      setMessage({ type: 'error', text: getApiErrorMessage(err, '저장 중 오류가 발생했습니다.') });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEquipmentChange = (eqId: string) => {
    const matched = equipments.find(e => e.id === eqId);
    if (matched) {
      setEquipmentId(eqId);
      setEquipmentName(matched.name);
      setPlantId(matched.plantId);
    }
  };


  const getWpTypeLabel = (code: string) => {
    return {
      GENERAL: '일반위험작업',
      FIRE: '화기작업',
      CONFINED: '밀폐공간출입',
      ELECTRIC: '정전작업',
      HIGH_PLACE: '고소작업',
      EXCAVATION: '굴착작업',
      HEAVY_LOAD: '중량물취급'
    }[code] || code;
  };

  const exportToCsv = () => {
    if (permits.length === 0) return;
    const headers = ['허가서번호', '허가서명', '설비코드', '허가구분', '부서', '감독자', '시작일시', '종료일시', '상태'];
    const rows = permits.map(w => [
      w.id,
      w.title,
      w.equipmentId,
      w.permitTypeCodes.split(',').map(getWpTypeLabel).join('|'),
      depts.find(d => d.id === w.departmentId)?.name || w.departmentId,
      usersList.find(u => u.id === w.supervisorId)?.name || w.supervisorId,
      formatDateTime(w.startAt),
      formatDateTime(w.endAt),
      getStatusLabel(w.status)
    ]);

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'work_permits.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const checksheets = [
    { id: 'GENERAL', name: '일반위험작업 체크시트', state: genChecks },
    { id: 'FIRE', name: '화기작업 체크시트', state: fireChecks },
    { id: 'CONFINED', name: '밀폐공간출입 체크시트', state: confChecks },
    { id: 'ELECTRIC', name: '정전작업 체크시트', state: elecChecks },
    { id: 'HIGH_PLACE', name: '고소작업 체크시트', state: highChecks },
    { id: 'EXCAVATION', name: '굴착작업 체크시트', state: excaChecks },
    { id: 'HEAVY_LOAD', name: '중량물취급 체크시트', state: heavyChecks }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <ClipboardList size={24} className="text-blue-500" />
            안전작업허가서(Work Permit) 관리
          </h1>
          <p className="text-slate-400 text-sm mt-1">현장 안전 사고 방지를 위한 작업 유형별 허가서 발급 및 체크시트를 작성합니다.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={exportToCsv}
            className="bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download size={14} />
            CSV 내보내기
          </button>
          
          <button
            onClick={handleOpenCreate}
            className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 transition-colors border-0 cursor-pointer shadow-lg shadow-blue-900/20"
          >
            <Plus size={14} />
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

      {/* Main Grid View — 모달(허가서) 열림 시 인쇄 제외(전용뷰와 중복 방지) */}
      <div className={`bg-slate-900 border border-slate-800 rounded-xl p-6 print:border-0 print:bg-transparent print:p-0 ${isFormOpen ? 'print:hidden' : ''}`}>

        {/* Print Only Header */}
        <PrintHeader />
        <h1 className="hidden print:block text-center text-xl font-bold tracking-widest text-black border-b-2 border-black pb-2 mb-4">작 업 허 가 대 장</h1>

        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40 print:border-slate-300 print:bg-white print:rounded-none">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 select-none print:bg-slate-100 print:text-slate-800 print:border-slate-300">
                <th className="p-3 font-semibold">허가서번호</th>
                <th className="p-3 font-semibold">허가서 제목</th>
                <th className="p-3 font-semibold">설비코드</th>
                <th className="p-3 font-semibold">허가 유형</th>
                <th className="p-3 font-semibold">담당 부서</th>
                <th className="p-3 font-semibold">안전 감독자</th>
                <th className="p-3 font-semibold">작업 예정 시작</th>
                <th className="p-3 font-semibold">작업 예정 종료</th>
                <th className="p-3 font-semibold">연계결재번호</th>
                <th className="p-3 font-semibold">상태</th>
                <th className="p-3 font-semibold text-right print:hidden">작업</th>
              </tr>
            </thead>
            <tbody>
              {permits.length === 0 ? (
                <tr><td colSpan={11} className="p-8 text-center text-slate-600 print:text-slate-400">조회된 작업허가서 내역이 없습니다.</td></tr>
              ) : (
                permits.map((wp) => (
                  <tr key={wp.id} className="border-b border-slate-900 hover:bg-slate-900/30 text-slate-300 print:border-slate-200 print:text-slate-800 print:hover:bg-transparent">
                    <td className="p-3 font-mono text-slate-400 print:text-slate-600">{wp.id}</td>
                    <td className="p-3 font-semibold text-slate-200 print:text-slate-900">{wp.title}</td>
                    <td className="p-3 font-mono text-slate-400">{wp.equipmentId}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {wp.permitTypeCodes.split(',').map((t, i) => (
                          <span key={i} className="bg-slate-850 px-1.5 py-0.5 rounded text-[10px] text-slate-400 print:bg-slate-100 print:text-slate-700">
                            {getWpTypeLabel(t)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3">{depts.find(d => d.id === wp.departmentId)?.name || wp.departmentId}</td>
                    <td className="p-3">{usersList.find(u => u.id === wp.supervisorId)?.name || wp.supervisorId}</td>
                    <td className="p-3 font-mono text-slate-400">{formatDateTime(wp.startAt)}</td>
                    <td className="p-3 font-mono text-slate-400">{formatDateTime(wp.endAt)}</td>
                    <td className="p-3 font-mono text-slate-500">{wp.approvalId || '-'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${getStatusClass(wp.status)}`}>
                        {getStatusLabel(wp.status)}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-2 print:hidden">
                      <button
                        onClick={() => handleOpenEdit(wp)}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-blue-400 transition-colors border-0 cursor-pointer bg-transparent"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(wp)}
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

      {/* Input / View Detail Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto print:absolute print:inset-0 print:bg-white print:p-0">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[95vh] flex flex-col shadow-2xl print:border-0 print:shadow-none print:max-h-none print:w-full print:h-full">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex justify-between items-center shrink-0 print:hidden">
              <h2 className="text-lg font-bold text-slate-200">
                {wpNo ? `작업허가서 수정/상세 [${wpNo}] ${equipmentName}` : `신규 안전작업허가서 작성`}
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

              {/* PAGE 1: GENERAL PERMIT COVER */}
              <div className="space-y-6">

                {/* Status Header Area */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs print:bg-slate-50 print:border-slate-300">
                  <div>
                    <span className="text-slate-500 block mb-0.5 print:text-slate-600">허가서 번호</span>
                    <span className="font-mono font-semibold text-slate-300 print:text-slate-800">{wpNo || '(저장 시 자동발행)'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5 print:text-slate-600">문서 상태</span>
                    <div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${getStatusClass(status)}`}>
                        {getStatusLabel(status)}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5 print:text-slate-600">결재 문서 번호</span>
                    <span className="font-mono text-slate-300 print:text-slate-800">{approvalId || '미연계 (결재 상신 전)'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5 print:text-slate-600">안전 감독자</span>
                    <span className="text-slate-300 print:text-slate-800">
                      {usersList.find(u => u.id === supervisorId)?.name || supervisorId}
                    </span>
                  </div>
                </div>

                {/* Input Form Grid divided into [일반 정보], [작업 정보], [기타 정보] */}
                <div className="space-y-6">
                  {/* [일반 정보] 섹션 */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider pl-2 border-l-2 border-blue-500 print:text-slate-800 print:border-slate-400">
                      [일반 정보]
                    </h4>
                    <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-5 print:bg-white print:border-slate-300">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                        <div className="sm:col-span-2 md:col-span-3">
                          <label className="block text-slate-400 mb-1.5 print:text-slate-600 font-semibold">허가서 제목 <span className="text-rose-500 print:hidden">*</span></label>
                          <input
                            type="text"
                            required
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="예: 2공장 전기 집진기 내부 쉘프 정비 작업"
                            className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none print:bg-white print:border-slate-300 print:text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1.5 print:text-slate-600">대상 설비 <span className="text-rose-500 print:hidden">*</span></label>
                          <select
                            value={equipmentId}
                            onChange={(e) => handleEquipmentChange(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-300 outline-none print:bg-white print:border-slate-300 print:text-slate-800"
                          >
                            {equipments.map(eq => (
                              <option key={eq.id} value={eq.id}>{eq.name} [{eq.id}]</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1.5 print:text-slate-600 font-semibold">담당 부서 <span className="text-rose-500 print:hidden">*</span></label>
                          <select
                            value={departmentId}
                            onChange={(e) => setDepartmentId(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-300 outline-none print:bg-white print:border-slate-300 print:text-slate-800"
                          >
                            {depts.map(d => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1.5 print:text-slate-600 font-semibold">안전 감독자 <span className="text-rose-500 print:hidden">*</span></label>
                          <select
                            value={supervisorId}
                            onChange={(e) => setSupervisorId(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-300 outline-none print:bg-white print:border-slate-300 print:text-slate-800"
                          >
                            {usersList.map(u => (
                              <option key={u.id} value={u.id}>{u.name} [{u.id}]</option>
                            ))}
                          </select>
                        </div>
                        <div className="sm:col-span-2 md:col-span-3">
                          <label className="block text-slate-400 mb-1.5 print:text-slate-600">연계 작업지시서(WO)</label>
                          <select
                            value={workOrderId}
                            onChange={(e) => setWorkOrderId(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-300 outline-none print:bg-white print:border-slate-300 print:text-slate-800"
                          >
                            <option value="">(미연계)</option>
                            {workOrders.map(wo => (
                              <option key={wo.id} value={wo.id}>{wo.title} [{wo.id}]</option>
                            ))}
                          </select>
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
                        <div>
                          <label className="block text-slate-400 mb-1.5 print:text-slate-600">허가유효 시작 시간</label>
                          <input
                            type="datetime-local"
                            value={startAt}
                            onChange={(e) => setStartAt(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none print:bg-white print:border-slate-300 print:text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1.5 print:text-slate-600">허가유효 종료 시간</label>
                          <input
                            type="datetime-local"
                            value={endAt}
                            onChange={(e) => setEndAt(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none print:bg-white print:border-slate-300 print:text-slate-800"
                          />
                        </div>

                        {/* Checkbox selector for multiple permit types */}
                        <div className="sm:col-span-2 bg-slate-950 border border-slate-850 p-4 rounded-xl print:bg-slate-50 print:border-slate-300">
                          <span className="block text-slate-400 mb-2 print:text-slate-700 font-semibold">작업허가 유형 추가 선택 (복수 선택 가능, 일반은 항상 포함)</span>
                          <div className="flex flex-wrap gap-4">
                            {['GENERAL', 'FIRE', 'CONFINED', 'ELECTRIC', 'HIGH_PLACE', 'EXCAVATION', 'HEAVY_LOAD'].map(type => {
                              const isGeneral = type === 'GENERAL';
                              const isSelected = selectedTypes.includes(type);
                              return (
                                <button
                                  type="button"
                                  key={type}
                                  disabled={isGeneral}
                                  onClick={() => handleTypeToggle(type)}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                                    isSelected 
                                      ? 'bg-blue-600/10 text-blue-400 border-blue-600/30' 
                                      : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300 hover:border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed print:border-slate-300 print:text-slate-700'
                                  }`}
                                >
                                  {isSelected ? <CheckSquare size={13} /> : <Square size={13} />}
                                  <span>{getWpTypeLabel(type)}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* [기타 정보] 섹션 */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-2 border-l-2 border-slate-500 print:text-slate-800 print:border-slate-400">
                      [기타 정보]
                    </h4>
                    <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-5 print:bg-white print:border-slate-300">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div className="sm:col-span-1">
                          <label className="block text-slate-400 mb-1.5 print:text-slate-600">작업 내용 요약</label>
                          <textarea
                            value={workSummary}
                            onChange={(e) => setWorkSummary(e.target.value)}
                            placeholder="작업의 목적 및 절차 요약을 기재합니다."
                            rows={3}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none resize-none print:bg-white print:border-slate-300 print:text-slate-800"
                          />
                        </div>
                        <div className="sm:col-span-1">
                          <label className="block text-slate-400 mb-1.5 print:text-slate-600">주요 위험 요인</label>
                          <textarea
                            value={riskFactors}
                            onChange={(e) => setRiskFactors(e.target.value)}
                            placeholder="작업 중 발생할 수 있는 주요 위험 및 유해 요인(화재, 추락, 감전 등)을 기재합니다."
                            rows={3}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none resize-none print:bg-white print:border-slate-300 print:text-slate-800"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-slate-400 mb-1.5 print:text-slate-600">핵심 안전 대책</label>
                          <textarea
                            value={safetyMeasures}
                            onChange={(e) => setSafetyMeasures(e.target.value)}
                            placeholder="위험 요인을 회피하거나 조치하기 위한 물리적 방안 및 관리 대책을 기술합니다."
                            rows={2}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none resize-none print:bg-white print:border-slate-300 print:text-slate-800"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* PAGE 2+: ACCORDION CHECKSHEETS & PRINT BREAK */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider border-l-2 border-blue-500 pl-2 print:hidden">
                  안전 점검 체크시트 상세 (해당 유형 체크 시 활성화)
                </h3>

                {checksheets.map(({ id: typeId, name: sheetName, state: checkState }) => {
                  const isSelected = selectedTypes.includes(typeId);
                  const isExpanded = accordionOpen[typeId];
                  
                  if (!isSelected && !isFormOpen) return null; // Only show active sheets in print/display

                  return (
                    <div 
                      key={typeId} 
                      className={`border rounded-xl overflow-hidden transition-all duration-200 ${
                        isSelected 
                          ? 'border-slate-800 bg-slate-950/10' 
                          : 'border-slate-900 bg-slate-950/5 opacity-40 print:hidden'
                      } print:border-slate-300 print:bg-white print:rounded-none print:opacity-100 print:break-before-page`}
                    >
                      {/* Accordion Header */}
                      <button
                        type="button"
                        onClick={() => toggleAccordion(typeId)}
                        disabled={!isSelected}
                        className="w-full px-5 py-3.5 flex justify-between items-center text-xs font-bold text-slate-300 border-0 bg-slate-900/40 hover:bg-slate-900/60 disabled:cursor-not-allowed select-none print:bg-slate-100 print:text-slate-900 print:border-b print:border-slate-300"
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-blue-500' : 'bg-slate-700'} print:hidden`} />
                          <span>{sheetName} {!isSelected && '(유형 선택 시 작성 가능)'}</span>
                        </div>
                        <div className="print:hidden">
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </button>

                      {/* Accordion Body */}
                      {isExpanded && isSelected && (
                        <div className="p-4 space-y-4">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-slate-800 text-slate-500 select-none print:border-slate-300 print:text-slate-700">
                                <th className="p-2 w-12 text-center">번호</th>
                                <th className="p-2 w-3/5">안전 조치 및 점검 문항</th>
                                <th className="p-2 text-center w-24">체크 여부</th>
                                <th className="p-2">점검 확인사항/비고</th>
                              </tr>
                            </thead>
                            <tbody>
                              {checkState.map((check, idx) => (
                                <tr key={idx} className="border-b border-slate-900 hover:bg-slate-900/10 text-slate-300 print:border-slate-200 print:text-slate-800">
                                  <td className="p-2.5 text-center text-slate-500">{idx + 1}</td>
                                  <td className="p-2.5 font-semibold">{check.question}</td>
                                  <td className="p-2 text-center">
                                    <input
                                      type="checkbox"
                                      checked={check.checked}
                                      onChange={(e) => handleCheckChange(typeId, idx, 'checked', e.target.checked)}
                                      className="w-4 h-4 cursor-pointer accent-blue-600 print:accent-black"
                                    />
                                  </td>
                                  <td className="p-2">
                                    <input
                                      type="text"
                                      value={check.remarks}
                                      onChange={(e) => handleCheckChange(typeId, idx, 'remarks', e.target.value)}
                                      placeholder="특이사항 기록"
                                      className="w-full bg-slate-950 border border-slate-900 focus:border-blue-500 rounded px-2.5 py-1 text-xs text-slate-300 outline-none print:border-slate-200 print:bg-white print:text-slate-800"
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

            </div>

            {/* 전용 인쇄뷰 (흑백) — LOTO 체크시트 포함, 시트별 페이지 분할 */}
            <WorkPermitPrint
              wpNo={wpNo}
              title={title}
              status={status}
              approvalId={approvalId}
              deptName={depts.find((d) => d.id === departmentId)?.name || departmentId}
              supervisorName={usersList.find((u) => u.id === supervisorId)?.name || supervisorId}
              startAt={startAt}
              endAt={endAt}
              equipmentName={equipmentName}
              workOrderId={workOrderId}
              permitTypeLabel={selectedTypes.map(getWpTypeLabel).join(', ')}
              stepStage={stepStage}
              workSummary={workSummary}
              riskFactors={riskFactors}
              safetyMeasures={safetyMeasures}
              remarks={remarks}
              checksheets={checksheets}
              selectedTypes={selectedTypes}
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
        refModule="WP"
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
          setMessage({ type: 'success', text: '작업허가서 결재 문서가 상신되었습니다.' });
          fetchData();
        }}
      />
    </div>
  );
}
