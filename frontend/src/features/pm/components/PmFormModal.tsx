import { MinusCircle, Plus } from 'lucide-react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import Modal from '../../../components/Modal';
import EquipmentSelector from '../../master/components/EquipmentSelector';
import type { PmRecordItem } from '../pm.types';

type Option = { id: string; name: string };
type UserOption = Option & { title?: string | null; position?: string | null };

interface PmFormProps {
  pmNo: string;
  createdAt: string;
  departmentId: string;
  depts: Option[];
  createdBy: string;
  user: { id?: string; name?: string } | null | undefined;
  usersList: UserOption[];
  title: string;
  setTitle: Dispatch<SetStateAction<string>>;
  equipmentId: string;
  equipmentName: string;
  plantId: string;
  activePlantId: string | null;
  canEditCurrent: boolean;
  canDeleteCurrent: boolean;
  onEquipmentChange: (id: string, plantId: string, name: string) => void | Promise<void>;
  checkTypeCode: string;
  availablePmTypes: Option[];
  handleCheckTypeChange: (value: string) => void;
  loadTemplates: (value: string) => void | Promise<void>;
  workDate: string;
  setWorkDate: Dispatch<SetStateAction<string>>;
  judgeCode: string;
  setJudgeCode: Dispatch<SetStateAction<string>>;
  remarks: string;
  setRemarks: Dispatch<SetStateAction<string>>;
  checkItems: PmRecordItem[];
  addPlanItem: () => void;
  updateItem: (index: number, field: keyof PmRecordItem, value: string) => void;
  removePlanItem: (index: number) => void;
  isLoading: boolean;
  handleSave: (status: 'T' | 'P') => void | Promise<void>;
  handleDelete: () => void | Promise<void>;
}

const inputClass = 'w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-slate-200';

export default function PmFormModal({
  title: modalTitle,
  onClose,
  form,
}: {
  title: string;
  onClose: () => void;
  form: PmFormProps;
}) {
  const {
    pmNo, createdAt, departmentId, depts, createdBy, user, usersList,
    title, setTitle, equipmentId, equipmentName, plantId, activePlantId,
    canEditCurrent, canDeleteCurrent, onEquipmentChange, checkTypeCode,
    availablePmTypes, handleCheckTypeChange, loadTemplates, workDate, setWorkDate,
    judgeCode, setJudgeCode, remarks, setRemarks, checkItems, addPlanItem,
    updateItem, removePlanItem, isLoading, handleSave, handleDelete,
  } = form;

  const updateEquipment = (id: string, item?: { name?: string; plantId?: string }) => {
    const selectedPlantId = item?.plantId || plantId || activePlantId || '';
    void onEquipmentChange(id, selectedPlantId, item?.name || id);
  };

  return (
    <Modal title={modalTitle} onClose={onClose} contentClassName="flex-1 overflow-y-auto p-0">
      <div className="p-6 space-y-6">
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <Info label="문서번호" value={pmNo || '(저장 시 자동발행)'} />
          <Info label="작성일" value={createdAt || '-'} />
          <Info label="부서" value={`${departmentId} / ${depts.find((item) => item.id === departmentId)?.name || '-'}`} />
          <Info label="작성자" value={`${createdBy || user?.id || '-'} / ${usersList.find((item) => item.id === (createdBy || user?.id))?.name || user?.name || '-'}`} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <Field label="점검명" className="md:col-span-2">
            <input value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} />
          </Field>
          <Field label="대상 설비 *">
            {!pmNo ? (
              <EquipmentSelector
                value={equipmentId}
                plantId={plantId || activePlantId}
                pmTargetOnly
                disabled={!canEditCurrent}
                onChange={(id, item) => updateEquipment(id, item)}
              />
            ) : <input disabled value={equipmentName || equipmentId} className={inputClass} />}
          </Field>
          <Field label="점검 유형 *">
            <div className="flex gap-2">
              <select disabled={!!pmNo} value={checkTypeCode} onChange={(event) => handleCheckTypeChange(event.target.value)} className={`${inputClass} flex-1`}>
                {availablePmTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
              </select>
              <button type="button" onClick={() => void loadTemplates(checkTypeCode)} className="bg-slate-800 text-blue-400 rounded-lg px-3">템플릿</button>
            </div>
          </Field>
          <Field label="점검일 *"><input type="date" value={workDate} onChange={(event) => setWorkDate(event.target.value)} className={inputClass} /></Field>
          <Field label="종합 판정">
            <select value={judgeCode} onChange={(event) => setJudgeCode(event.target.value)} className={inputClass}>
              <option value="OK">양호</option><option value="NG">불량</option><option value="OTHER">기타</option>
            </select>
          </Field>
          <Field label="비고" className="md:col-span-2"><textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} rows={2} className={inputClass} /></Field>
        </div>

        <div>
          <div className="flex justify-between items-center border-l-2 border-blue-500 pl-2 mb-3">
            <h3 className="text-xs font-bold text-blue-400">실적 측정 항목</h3>
            {canEditCurrent && <button type="button" onClick={addPlanItem} className="bg-slate-800 text-blue-400 rounded-lg px-2.5 py-1 text-xs flex items-center gap-1"><Plus size={13} /> 항목 추가</button>}
          </div>
          <CheckItemTable items={checkItems} canEdit={canEditCurrent} updateItem={updateItem} removeItem={removePlanItem} />
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-800 pt-4">
          <button type="button" onClick={onClose} className="bg-slate-800 text-slate-300 rounded-lg py-2 px-4 text-xs">닫기</button>
          {canDeleteCurrent && <button type="button" onClick={() => void handleDelete()} disabled={isLoading} className="bg-rose-900 text-rose-100 rounded-lg py-2 px-4 text-xs">삭제</button>}
          {canEditCurrent && <button type="button" onClick={() => void handleSave('T')} disabled={isLoading} className="bg-slate-800 text-slate-300 rounded-lg py-2 px-4 text-xs">임시 저장</button>}
          {canEditCurrent && <button type="button" onClick={() => void handleSave('P')} disabled={isLoading} className="bg-blue-600 text-white rounded-lg py-2 px-4 text-xs">결재 상신</button>}
        </div>
      </div>
    </Modal>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><span className="text-slate-500 block">{label}</span><span className="text-slate-300">{value}</span></div>;
}

function Field({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return <div className={className}><label className="block text-slate-400 mb-1.5">{label}</label>{children}</div>;
}

function CheckItemTable({ items, canEdit, updateItem, removeItem }: { items: PmRecordItem[]; canEdit: boolean; updateItem: PmFormProps['updateItem']; removeItem: PmFormProps['removePlanItem'] }) {
  const fields = ['checkName', 'checkMethod', 'minValue', 'maxValue', 'baseValue', 'checkValue', 'unit'] as const;
  return <div className="border border-slate-800 rounded-xl overflow-hidden"><table className="w-full text-left text-xs"><thead><tr className="bg-slate-900 text-slate-400"><th className="p-3">번호</th>{fields.map((field) => <th key={field} className="p-3">{field}</th>)}<th /></tr></thead><tbody>{items.length === 0 ? <tr><td colSpan={9} className="p-8 text-center text-slate-600">등록된 점검항목이 없습니다.</td></tr> : items.map((item, index) => <tr key={index} className="border-b border-slate-900"><td className="p-2 text-center">{index + 1}</td>{fields.map((field) => <td key={field} className="p-2"><input type={field.includes('Value') ? 'number' : 'text'} value={item[field] ?? ''} onChange={(event) => updateItem(index, field, event.target.value)} disabled={!canEdit} className="w-full bg-slate-950 border border-slate-800 rounded py-1 px-2 text-slate-200" /></td>)}<td className="p-2">{canEdit && <button type="button" onClick={() => removeItem(index)} className="text-rose-500 bg-transparent border-0"><MinusCircle size={15} /></button>}</td></tr>)}</tbody></table></div>;
}
