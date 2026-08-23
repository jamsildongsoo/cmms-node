import type { Dispatch, SetStateAction } from 'react';
import { Plus, X } from 'lucide-react';
import Modal from '../../../components/Modal';
import type { CodeItem, Department, Plant, Warehouse, ReferenceUser } from '../../mdm/mdm.types';
import InventorySelector from '../../master/components/InventorySelector';
import { formatDateOnly } from '../../../utils/datetime';
import type { PurchaseRequest, PurchaseRequestItem } from '../procurement.types';

interface PurchaseRequestFormModalProps {
  title: string;
  onClose: () => void;
  formHeader: Partial<PurchaseRequest>;
    setFormHeader: Dispatch<SetStateAction<Partial<PurchaseRequest>>>;
    formItems: PurchaseRequestItem[];
    setFormItems: Dispatch<SetStateAction<PurchaseRequestItem[]>>;
    plants: Plant[];
    filteredWarehouses: Warehouse[];
    prTypes: CodeItem[];
    depts: Department[];
    usersList: ReferenceUser[];
    user: { id?: string; name?: string } | null | undefined;
    formEditable: boolean;
    canManageFlow: boolean;
  detailMode: 'create' | 'request';
  canDeleteCurrent: boolean;
  canCloseRequest: boolean;
  canSaveRequest: boolean;
  deleteRequest: (id: string) => void;
  closeRequest: (id: string) => void;
  submitForm: (action: 'T' | 'P') => void;
}

export default function PurchaseRequestFormModal({
  title,
  onClose,
  formHeader,
  setFormHeader,
  formItems,
  setFormItems,
  plants,
  filteredWarehouses,
  prTypes,
  depts,
  usersList,
  user,
  formEditable,
  canManageFlow,
  detailMode,
  canDeleteCurrent,
  canCloseRequest,
  canSaveRequest,
  deleteRequest,
  closeRequest,
  submitForm,
}: PurchaseRequestFormModalProps) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="mb-6 grid grid-cols-2 gap-4 rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs sm:grid-cols-4">
              <div><span className="mb-0.5 block text-slate-500">문서번호</span><span className="font-mono font-semibold text-slate-300">{formHeader.id || '(저장 시 자동발행)'}</span></div>
              <div><span className="mb-0.5 block text-slate-500">작성일</span><span className="font-mono text-slate-300">{formatDateOnly(formHeader.createdAt) || (formHeader.id ? '-' : '저장 시 기록')}</span></div>
              <div><span className="mb-0.5 block text-slate-500">부서</span><span className="text-slate-300">{formHeader.departmentId || '-'} / {depts.find((dept) => dept.id === formHeader.departmentId)?.name || formHeader.departmentId || '-'}</span></div>
              <div><span className="mb-0.5 block text-slate-500">작성자</span><span className="text-slate-300">{formHeader.requesterId || user?.id || '-'} / {usersList.find((candidate) => candidate.id === formHeader.requesterId)?.name || user?.name || '-'}</span></div>
            </div>
      
            <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
              <label className="flex flex-col sm:col-span-2 lg:col-span-4"><span className="mb-1.5 text-slate-400">제목</span><input value={formHeader.title || ''} onChange={(event) => setFormHeader({ ...formHeader, title: event.target.value })} className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500 disabled:opacity-50" disabled={!formEditable} /></label>
              <label className="flex flex-col"><span className="mb-1.5 text-slate-400">요청일</span><input type="date" value={formHeader.requestDate || ''} onChange={(event) => setFormHeader({ ...formHeader, requestDate: event.target.value })} className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500 disabled:opacity-50" disabled={!formEditable} /></label>
              <label className="flex flex-col"><span className="mb-1.5 text-slate-400">요청유형</span><select value={formHeader.requestType || ''} onChange={(event) => setFormHeader({ ...formHeader, requestType: event.target.value })} className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500 disabled:opacity-50" disabled={!formEditable}>
                <option value="">선택</option>
                {prTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
              </select></label>
              <label className="flex flex-col"><span className="mb-1.5 text-slate-400">플랜트</span><select value={formHeader.plantId || ''} onChange={(event) => setFormHeader({ ...formHeader, plantId: event.target.value, warehouseId: '' })} className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500 disabled:opacity-50" disabled={!formEditable}>
                <option value="">선택</option>
                {plants.map((plant) => <option key={plant.id} value={plant.id}>{plant.id} — {plant.name}</option>)}
              </select></label>
              <label className="flex flex-col"><span className="mb-1.5 text-slate-400">예정 창고</span><select value={formHeader.warehouseId || ''} onChange={(event) => setFormHeader({ ...formHeader, warehouseId: event.target.value })} className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500 disabled:opacity-50" disabled={!formEditable}>
                <option value="">선택</option>
                {filteredWarehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.id} — {warehouse.name}{!warehouse.plantId ? ' (공통)' : ''}</option>)}
              </select></label>
              <label className="flex flex-col sm:col-span-2 lg:col-span-4"><span className="mb-1.5 text-slate-400">비고</span><input value={formHeader.remarks || ''} onChange={(event) => setFormHeader({ ...formHeader, remarks: event.target.value })} className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500 disabled:opacity-50" disabled={!formEditable} /></label>
              {formHeader.id && <label className="flex flex-col"><span className="mb-1.5 text-slate-400">예정도착일</span><input type="date" value={formHeader.etaDate || ''} onChange={(event) => setFormHeader({ ...formHeader, etaDate: event.target.value })} className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500 disabled:opacity-50" disabled={!canManageFlow} /></label>}
            </div>
      
            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-400">자재 라인</span>
                {formEditable && <button type="button" onClick={() => setFormItems([...formItems, { itemNo: formItems.length + 1, inventoryId: '', qty: 0, unit: '' }])} className="flex cursor-pointer items-center gap-1 border-0 bg-transparent text-xs font-semibold text-blue-400"><Plus size={12} /> 라인 추가</button>}
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/40">
                <table className="w-full border-collapse text-xs">
                  <thead><tr className="border-b border-slate-800 bg-slate-900 text-slate-400"><th className="p-3 text-left font-semibold">자재</th><th className="w-28 p-3 text-right font-semibold">수량</th><th className="w-24 p-3 text-left font-semibold">단위</th><th className="w-12" /></tr></thead>
                  <tbody>
                    {formItems.map((item, index) => (
                      <tr key={index}>
                        <td className="p-1"><InventorySelector value={item.inventoryId} disabled={!formEditable} placeholder="자재번호 또는 자재명 검색" onChange={(id, selected) => setFormItems(formItems.map((current, itemIndex) => itemIndex === index ? { ...current, inventoryId: id, unit: selected && 'unit' in selected ? selected.unit || current.unit : current.unit } : current))} /></td>
                        <td className="p-1"><input type="number" value={item.qty || ''} onChange={(event) => setFormItems(formItems.map((current, itemIndex) => itemIndex === index ? { ...current, qty: Number(event.target.value) } : current))} className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-right text-xs text-slate-200 outline-none focus:border-blue-500 disabled:opacity-50" disabled={!formEditable} /></td>
                        <td className="p-1"><input value={item.unit || ''} onChange={(event) => setFormItems(formItems.map((current, itemIndex) => itemIndex === index ? { ...current, unit: event.target.value } : current))} className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500 disabled:opacity-50" disabled={!formEditable} /></td>
                        <td className="p-1 text-center">{formEditable && <button type="button" onClick={() => setFormItems(formItems.filter((_, itemIndex) => itemIndex !== index))} className="cursor-pointer border-0 bg-transparent text-rose-400"><X size={12} /></button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
      <div className="mt-6 flex justify-end gap-2 border-t border-slate-800 pt-6">
        <button type="button" onClick={onClose} className="cursor-pointer rounded-lg border-0 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700">닫기</button>
        {formHeader.id && detailMode === 'request' && canDeleteCurrent && <button type="button" onClick={() => deleteRequest(formHeader.id!)} className="cursor-pointer rounded-lg border-0 bg-rose-900/70 px-4 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-800">삭제</button>}
        {formHeader.id && canCloseRequest && <button type="button" onClick={() => closeRequest(formHeader.id!)} className="cursor-pointer rounded-lg border-0 bg-rose-700 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-600">종료</button>}
        {formEditable && canSaveRequest && <button type="button" onClick={() => submitForm('T')} className="cursor-pointer rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700">임시 저장</button>}
        {formEditable && canSaveRequest && <button type="button" onClick={() => submitForm('P')} className="cursor-pointer rounded-lg border-0 bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500">결재 상신</button>}
      </div>
    </Modal>
  );
}
