import { useState, type FormEvent } from 'react';
import { MinusCircle, RefreshCw, Save, X } from 'lucide-react';
import type { CodeItem, Plant } from '../../mdm/mdm.types';
import type {
  EquipmentCheckCycle,
  EquipmentFormValues,
  YesNo,
} from '../equipment.types';

interface EquipmentFormModalProps {
  editingId: string | null;
  initialValues: EquipmentFormValues;
  plants: Plant[];
  equipmentTypes: CodeItem[];
  checkTypes: CodeItem[];
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (values: EquipmentFormValues) => Promise<void>;
}

const inputClass = 'w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200 outline-none transition-colors focus:border-blue-500 disabled:opacity-50';

export default function EquipmentFormModal({
  editingId,
  initialValues,
  plants,
  equipmentTypes,
  checkTypes,
  isSaving,
  onClose,
  onSubmit,
}: EquipmentFormModalProps) {
  const [values, setValues] = useState(initialValues);
  const update = <K extends keyof EquipmentFormValues>(field: K, value: EquipmentFormValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
  };
  const updateCycle = (
    index: number,
    field: keyof EquipmentCheckCycle,
    value: string | number | null,
  ) => {
    update('checkCycles', values.checkCycles.map((cycle, cycleIndex) => (
      cycleIndex === index
        ? { ...cycle, [field]: value === '' ? null : value } as EquipmentCheckCycle
        : cycle
    )));
  };
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void onSubmit(values);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-800 p-6">
          <h2 className="text-lg font-bold text-slate-200">
            {editingId ? `설비 수정 (${editingId})` : '신규 설비 등록'}
          </h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="cursor-pointer rounded border-0 bg-transparent p-1 text-slate-500 hover:bg-slate-800 hover:text-slate-300">
            <X size={20} />
          </button>
        </div>

        <form id="equipment-form" onSubmit={handleSubmit} className="flex-1 space-y-6 overflow-y-auto p-6 text-xs">
          <section>
            <h3 className="mb-3 border-l-2 border-blue-500 pl-2 font-bold uppercase tracking-wider text-blue-400">[기본 정보]</h3>
            <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
                <label className="text-slate-400">
                  플랜트 지정 <span className="text-rose-500">*</span>
                  <select value={values.plantId} onChange={(event) => update('plantId', event.target.value)} disabled={!!editingId} className={`${inputClass} mt-1.5 text-slate-300`}>
                    {plants.map((plant) => <option key={plant.id} value={plant.id}>{plant.name}</option>)}
                  </select>
                </label>
                <label className="text-slate-400">
                  설비 코드 <span className="text-rose-500">*</span>
                  <input required disabled={!!editingId} value={values.id} onChange={(event) => update('id', event.target.value)} placeholder="예: EQ_PMP001" className={`${inputClass} mt-1.5`} />
                </label>
                <label className="text-slate-400 sm:col-span-2">
                  설비명 <span className="text-rose-500">*</span>
                  <input required value={values.name} onChange={(event) => update('name', event.target.value)} placeholder="예: 제1송수 펌프 모터" className={`${inputClass} mt-1.5`} />
                </label>
                <label className="text-slate-400">
                  설비 구분 타입
                  <select value={values.eqTypeCode} onChange={(event) => update('eqTypeCode', event.target.value)} className={`${inputClass} mt-1.5 text-slate-300`}>
                    {equipmentTypes.map((type) => <option key={type.id} value={type.id}>{type.name} ({type.id})</option>)}
                  </select>
                </label>
                <label className="text-slate-400">
                  설치 위치
                  <input value={values.location} onChange={(event) => update('location', event.target.value)} placeholder="예: 공장 동편 기계실" className={`${inputClass} mt-1.5`} />
                </label>
                <label className="text-slate-400">
                  설치 일자
                  <input type="date" value={values.installDate} onChange={(event) => update('installDate', event.target.value)} className={`${inputClass} mt-1.5`} />
                </label>
                <label className="text-slate-400">
                  작업허가 대상
                  <select value={values.workPermitYn} onChange={(event) => update('workPermitYn', event.target.value as YesNo)} className={`${inputClass} mt-1.5 text-slate-300`}>
                    <option value="N">미대상 (일반작업)</option>
                    <option value="Y">대상 (안전허가 요구)</option>
                  </select>
                </label>
              </div>
            </div>
          </section>

          <section>
            <h3 className="mb-3 border-l-2 border-emerald-500 pl-2 font-bold uppercase tracking-wider text-emerald-400">[제조사 및 스펙 정보]</h3>
            <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-800/80 bg-slate-950/40 p-5 sm:grid-cols-2 md:grid-cols-4">
              <label className="text-slate-400">제조사<input value={values.makerName} onChange={(event) => update('makerName', event.target.value)} className={`${inputClass} mt-1.5`} /></label>
              <label className="text-slate-400">모델명<input value={values.model} onChange={(event) => update('model', event.target.value)} className={`${inputClass} mt-1.5`} /></label>
              <label className="text-slate-400">일련번호 (S/N)<input value={values.serialNumber} onChange={(event) => update('serialNumber', event.target.value)} className={`${inputClass} mt-1.5`} /></label>
              <label className="text-slate-400">제조사 스펙상세<input value={values.spec} onChange={(event) => update('spec', event.target.value)} placeholder="예: 220V, 60Hz, 15kW" className={`${inputClass} mt-1.5`} /></label>
            </div>
          </section>

          <section>
            <h3 className="mb-3 border-l-2 border-indigo-500 pl-2 font-bold uppercase tracking-wider text-indigo-400">[운영 정보]</h3>
            <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-5">
              <label className="text-slate-400">비고 및 설명<textarea value={values.remarks} onChange={(event) => update('remarks', event.target.value)} rows={2} className={`${inputClass} mt-1.5 resize-none`} /></label>
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between border-l-2 border-emerald-500 pl-2">
              <div>
                <h3 className="font-bold uppercase tracking-wider text-emerald-400">설비 정기 점검 주기</h3>
                <p className="mt-0.5 text-[10px] text-slate-500">점검유형별 주기를 등록하면 예방점검 스케줄에 반영됩니다.</p>
              </div>
              <button type="button" onClick={() => update('checkCycles', [...values.checkCycles, { checkTypeCode: '', cycleVal: null, cycleUnit: 'M', lastCheckDate: null, nextCheckDate: null }])} className="flex cursor-pointer items-center gap-1 rounded-lg border-0 bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 hover:bg-slate-700">
                <RefreshCw size={13} />주기 추가
              </button>
            </div>
            <div className="space-y-3">
              {values.checkCycles.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-slate-500">등록된 점검주기가 없습니다.</div>
              ) : values.checkCycles.map((cycle, index) => (
                <div key={index} className="flex items-end gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <div className="grid flex-1 grid-cols-2 gap-3 lg:grid-cols-5">
                    <label className="text-[10px] text-slate-500">점검유형<select value={cycle.checkTypeCode} onChange={(event) => updateCycle(index, 'checkTypeCode', event.target.value)} className={`${inputClass} mt-1 py-1.5`}><option value="">-- 선택 --</option>{checkTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
                    <label className="text-[10px] text-slate-500">주기 값<input type="number" min="1" value={cycle.cycleVal ?? ''} onChange={(event) => updateCycle(index, 'cycleVal', event.target.value ? Number(event.target.value) : null)} className={`${inputClass} mt-1 py-1.5`} /></label>
                    <label className="text-[10px] text-slate-500">주기 단위<select value={cycle.cycleUnit} onChange={(event) => updateCycle(index, 'cycleUnit', event.target.value)} className={`${inputClass} mt-1 py-1.5`}><option value="D">일 (D)</option><option value="W">주 (W)</option><option value="M">월 (M)</option><option value="Y">년 (Y)</option></select></label>
                    <label className="text-[10px] text-slate-500">지난 점검일<input type="date" value={cycle.lastCheckDate || ''} onChange={(event) => updateCycle(index, 'lastCheckDate', event.target.value)} className={`${inputClass} mt-1 py-1.5`} /></label>
                    <label className="text-[10px] text-slate-500">다음 점검일<input type="date" value={cycle.nextCheckDate || ''} onChange={(event) => updateCycle(index, 'nextCheckDate', event.target.value)} className={`${inputClass} mt-1 py-1.5`} /></label>
                  </div>
                  <button type="button" onClick={() => update('checkCycles', values.checkCycles.filter((_, cycleIndex) => cycleIndex !== index))} aria-label="점검주기 삭제" className="cursor-pointer rounded-lg border-0 bg-slate-900 p-2 text-rose-500">
                    <MinusCircle size={16} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </form>

        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-800 p-6">
          <button type="button" onClick={onClose} className="cursor-pointer rounded-lg border-0 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700">취소</button>
          <button type="submit" form="equipment-form" disabled={isSaving} className="flex cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-blue-600 px-6 py-2 text-xs font-semibold text-white disabled:opacity-50">
            <Save size={14} />{isSaving ? '저장 중...' : '설비 저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
