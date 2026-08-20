import { useState, type FormEvent } from 'react';
import { Save } from 'lucide-react';
import Modal from '../../../components/Modal';
import type { CodeItem } from '../../mdm/mdm.types';
import type { InventoryFormValues } from '../inventory.types';

interface InventoryFormModalProps {
  editingId: string | null;
  initialValues: InventoryFormValues;
  inventoryTypes: CodeItem[];
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (values: InventoryFormValues) => Promise<void>;
}

const inputClass = 'mt-1.5 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200 outline-none transition-colors focus:border-blue-500 disabled:opacity-50';

export default function InventoryFormModal({
  editingId,
  initialValues,
  inventoryTypes,
  isSaving,
  onClose,
  onSubmit,
}: InventoryFormModalProps) {
  const [values, setValues] = useState(initialValues);
  const update = <K extends keyof InventoryFormValues>(field: K, value: InventoryFormValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
  };
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void onSubmit(values);
  };

  return (
    <Modal
      title={editingId ? `자재 마스터 수정 (${editingId})` : '신규 자재 등록'}
      onClose={onClose}
      contentClassName="flex-1 overflow-y-auto p-0"
      footer={(
        <>
          <button type="button" onClick={onClose} className="cursor-pointer rounded-lg border-0 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700">취소</button>
          <button type="submit" form="inventory-form" disabled={isSaving} className="flex cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-blue-600 px-6 py-2 text-xs font-semibold text-white disabled:opacity-50">
            <Save size={14} />{isSaving ? '저장 중...' : '자재 저장'}
          </button>
        </>
      )}
    >
        <form id="inventory-form" onSubmit={handleSubmit} className="space-y-6 p-6 text-xs">
          <section>
            <h3 className="mb-3 border-l-2 border-blue-500 pl-2 font-bold uppercase tracking-wider text-blue-400">[기본 정보]</h3>
            <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-800/80 bg-slate-950/40 p-5 sm:grid-cols-2 md:grid-cols-4">
              <label className="text-slate-400">
                자재 코드 <span className="text-rose-500">*</span>
                <input required disabled={!!editingId} value={values.id} onChange={(event) => update('id', event.target.value)} placeholder="예: INV_BOLT_M10" className={inputClass} />
              </label>
              <label className="text-slate-400">
                자재 품명 <span className="text-rose-500">*</span>
                <input required value={values.name} onChange={(event) => update('name', event.target.value)} className={inputClass} />
              </label>
              <label className="text-slate-400">
                자재 구분타입
                <select value={values.invTypeCode} onChange={(event) => update('invTypeCode', event.target.value)} className={inputClass}>
                  {inventoryTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
                </select>
              </label>
              <label className="text-slate-400">
                단위
                <input value={values.unit} onChange={(event) => update('unit', event.target.value)} placeholder="예: EA, BOX, SET" className={inputClass} />
              </label>
            </div>
          </section>

          <section>
            <h3 className="mb-3 border-l-2 border-emerald-500 pl-2 font-bold uppercase tracking-wider text-emerald-400">[제조사 및 스펙 정보]</h3>
            <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-800/80 bg-slate-950/40 p-5 sm:grid-cols-2 md:grid-cols-4">
              <label className="text-slate-400">제조사<input value={values.makerName} onChange={(event) => update('makerName', event.target.value)} className={inputClass} /></label>
              <label className="text-slate-400">모델명<input value={values.model} onChange={(event) => update('model', event.target.value)} className={inputClass} /></label>
              <label className="text-slate-400">일련번호 (S/N)<input value={values.serialNumber} onChange={(event) => update('serialNumber', event.target.value)} className={inputClass} /></label>
              <label className="text-slate-400">상세 규격<input value={values.spec} onChange={(event) => update('spec', event.target.value)} className={inputClass} /></label>
            </div>
          </section>

          <section>
            <h3 className="mb-3 border-l-2 border-amber-500 pl-2 font-bold uppercase tracking-wider text-amber-400">[재고 관리 기준]</h3>
            <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-800/80 bg-slate-950/40 p-5 sm:grid-cols-3">
              <label className="text-slate-400">안전재고<input type="number" min="0" value={values.safetyQty} onChange={(event) => update('safetyQty', Number(event.target.value))} className={inputClass} /></label>
              <label className="text-slate-400">재주문점<input type="number" min="0" value={values.reorderQty} onChange={(event) => update('reorderQty', Number(event.target.value))} className={inputClass} /></label>
              <label className="text-slate-400">리드타임(일)<input type="number" min="0" value={values.leadTimeDays} onChange={(event) => update('leadTimeDays', Number(event.target.value))} className={inputClass} /></label>
            </div>
          </section>

          <section>
            <h3 className="mb-3 border-l-2 border-indigo-500 pl-2 font-bold uppercase tracking-wider text-indigo-400">[비고]</h3>
            <textarea value={values.remarks} onChange={(event) => update('remarks', event.target.value)} rows={3} className={`${inputClass} resize-none`} />
          </section>
        </form>

    </Modal>
  );
}
