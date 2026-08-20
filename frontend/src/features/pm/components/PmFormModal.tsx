import { MinusCircle, Plus } from 'lucide-react';
import { formatDateOnly, todayLocal } from '../../../utils/datetime';
import EquipmentSelector from '../../master/components/EquipmentSelector';
import type { Dispatch, SetStateAction } from 'react';
import Modal from '../../../components/Modal';
import type { PmRecordItem, PmStage } from '../pm.types';

interface PmFormProps {
  pmNo: string;
  stepStage: PmStage;
  createdAt: string;
  departmentId: string;
  depts: Array<{ id: string; name: string }>;
  createdBy: string;
  user: { id?: string; name?: string } | null | undefined;
  usersList: Array<{ id: string; name: string; title?: string | null; position?: string | null }>;
  title: string;
  setTitle: Dispatch<SetStateAction<string>>;
  equipmentId: string;
  equipmentName: string;
  plantId: string;
  activePlantId: string | null;
  canEditCurrent: boolean;
  canDeleteCurrent: boolean;
  setEquipmentId: Dispatch<SetStateAction<string>>;
  setEquipmentName: Dispatch<SetStateAction<string>>;
  setPlantId: Dispatch<SetStateAction<string>>;
  checkTypeCode: string;
  pmTypes: Array<{ id: string; name: string }>;
  refNo: string;
  handleCheckTypeChange: (value: string) => void;
  loadTemplates: (value: string) => void | Promise<void>;
  workDate: string;
  setWorkDate: Dispatch<SetStateAction<string>>;
  isRecurring: boolean;
  setIsRecurring: Dispatch<SetStateAction<boolean>>;
  cycleFrom: string;
  setCycleFrom: Dispatch<SetStateAction<string>>;
  cycleEnd: string;
  setCycleEnd: Dispatch<SetStateAction<string>>;
  judgeCode: string;
  setJudgeCode: Dispatch<SetStateAction<string>>;
  remarks: string;
  setRemarks: Dispatch<SetStateAction<string>>;
  certNumber: string;
  setCertNumber: Dispatch<SetStateAction<string>>;
  certAgency: string;
  setCertAgency: Dispatch<SetStateAction<string>>;
  certExpireDate: string;
  setCertExpireDate: Dispatch<SetStateAction<string>>;
  checkItems: PmRecordItem[];
  addPlanItem: () => void;
  updateItem: (index: number, field: keyof PmRecordItem, value: string) => void;
  removePlanItem: (index: number) => void;
  isLoading: boolean;
  handleSave: (status: 'T' | 'P') => void | Promise<void>;
  handleDelete: () => void | Promise<void>;
}

export default function PmFormModal({ title: modalTitle, onClose, form }: { title: string; onClose: () => void; form: PmFormProps }) {
  const {
    pmNo, stepStage, createdAt, departmentId, depts, createdBy, user, usersList,
    title, setTitle, equipmentId, equipmentName, plantId, activePlantId,
    canEditCurrent, canDeleteCurrent, setEquipmentId, setEquipmentName, setPlantId, checkTypeCode,
    pmTypes, refNo, handleCheckTypeChange, loadTemplates, workDate, setWorkDate,
    isRecurring, setIsRecurring, cycleFrom, setCycleFrom, cycleEnd, setCycleEnd,
    judgeCode, setJudgeCode, remarks, setRemarks, certNumber, setCertNumber,
    certAgency, setCertAgency, certExpireDate, setCertExpireDate, checkItems,
    addPlanItem, updateItem, removePlanItem, isLoading, handleSave, handleDelete,
  } = form;

  return (
    <Modal title={modalTitle} onClose={onClose} contentClassName="flex-1 overflow-y-auto p-0">
      <>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 print:hidden">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block mb-0.5">문서번호</span>
                  <span className="font-mono font-semibold text-slate-300">{pmNo || '(저장 시 자동발행)'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">작성일</span>
                  <span className="font-mono text-slate-300">{formatDateOnly(createdAt) || (pmNo ? '-' : '저장 시 기록')}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">부서</span>
                  <span className="text-slate-300">
                    {departmentId || '-'} / {depts.find((dept) => dept.id === departmentId)?.name || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">작성자</span>
                  <span className="text-slate-300">
                    {(createdBy || user?.id) || '-'} / {usersList.find((candidate) => candidate.id === (createdBy || user?.id))?.name || user?.name || '-'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">단계</span>
                  <span className="text-slate-300">{stepStage === 'P' ? '계획(P)' : '실적(R)'}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="md:col-span-2">
                  <label className="block text-slate-400 mb-1.5">점검명</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="예방점검명을 입력하세요"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1.5">대상 설비 <span className="text-rose-500">*</span></label>
                  {!pmNo ? (
                    <EquipmentSelector
                      value={equipmentId}
                      plantId={plantId || activePlantId}
                      disabled={!canEditCurrent}
                      placeholder="설비번호 또는 설비명 검색"
                      onChange={(id, item) => {
                        setEquipmentId(id);
                        setEquipmentName(item?.name || id);
                        setPlantId(item && 'plantId' in item ? item.plantId : plantId || activePlantId || '');
                      }}
                    />
                  ) : (
                    <input
                      type="text"
                      disabled
                      value={equipmentName || equipmentId}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-slate-200 outline-none disabled:opacity-80"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-slate-400 mb-1.5">점검 유형 <span className="text-rose-500">*</span></label>
                  <div className="flex gap-2">
                    <select
                      disabled={stepStage === 'R' && !!refNo}
                      value={checkTypeCode}
                      onChange={(e) => handleCheckTypeChange(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-300 outline-none disabled:opacity-80"
                    >
                      {pmTypes.map((type) => (
                        <option key={type.id} value={type.id}>{type.name}</option>
                      ))}
                    </select>
                    {(stepStage === 'P' || !refNo) && (
                      <button
                        type="button"
                        onClick={() => loadTemplates(checkTypeCode)}
                        className="bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg px-3 text-[11px] font-semibold transition-colors border-0 cursor-pointer whitespace-nowrap"
                      >
                        템플릿
                      </button>
                    )}
                  </div>
                </div>
                {stepStage === 'P' && (
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_1fr] gap-3 items-end">
                    <div>
                      <label className="block text-slate-400 mb-1.5">계획일 {!isRecurring && <span className="text-rose-500">*</span>}</label>
                      <input
                        type="date"
                        disabled={isRecurring}
                        required={!isRecurring}
                        value={workDate}
                        onChange={(e) => setWorkDate(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none disabled:opacity-40"
                      />
                    </div>
                    <label className="flex h-9 items-center gap-2 px-2 text-slate-300 cursor-pointer whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={isRecurring}
                        onChange={(event) => {
                          const checked = event.target.checked;
                          setIsRecurring(checked);
                          if (checked) {
                            setWorkDate('');
                          } else {
                            setCycleFrom('');
                            setCycleEnd('');
                            setWorkDate((current) => current || todayLocal());
                          }
                        }}
                        className="rounded border-slate-700 bg-slate-950"
                      />
                      반복작업
                    </label>
                    <div>
                      <label className="block text-slate-400 mb-1.5">시작일 {isRecurring && <span className="text-rose-500">*</span>}</label>
                      <input
                        type="date"
                        disabled={!isRecurring}
                        required={isRecurring}
                        value={cycleFrom}
                        onChange={(e) => setCycleFrom(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none disabled:opacity-40"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1.5">종료일 {isRecurring && <span className="text-rose-500">*</span>}</label>
                      <input
                        type="date"
                        disabled={!isRecurring}
                        required={isRecurring}
                        value={cycleEnd}
                        onChange={(e) => setCycleEnd(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none disabled:opacity-40"
                      />
                    </div>
                  </div>
                )}
                {stepStage === 'R' && (
                  <div>
                    <label className="block text-slate-400 mb-1.5">점검일 <span className="text-rose-500">*</span></label>
                    <input
                      type="date"
                      required
                      value={workDate}
                      onChange={(e) => setWorkDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none"
                    />
                  </div>
                )}
                {stepStage === 'R' && (
                  <div>
                    <label className="block text-slate-400 mb-1.5">종합 판정</label>
                    <select
                      value={judgeCode}
                      onChange={(e) => setJudgeCode(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-300 outline-none"
                    >
                      <option value="OK">양호</option>
                      <option value="NG">불량</option>
                      <option value="OTHER">기타</option>
                    </select>
                  </div>
                )}
                <div className="md:col-span-2">
                  <label className="block text-slate-400 mb-1.5">비고</label>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={2}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none resize-none"
                  />
                </div>
              </div>

              {stepStage === 'R' && (
                <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-5">
                  <h4 className="text-xs font-bold text-amber-400 mb-3 border-l-2 border-amber-500 pl-2">법정 인증 정보</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                    <input className="bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none" value={certNumber} onChange={(e) => setCertNumber(e.target.value)} placeholder="인증번호" />
                    <input className="bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none" value={certAgency} onChange={(e) => setCertAgency(e.target.value)} placeholder="인증기관" />
                    <input type="date" className="bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none" value={certExpireDate} onChange={(e) => setCertExpireDate(e.target.value)} />
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div className="flex justify-between items-center border-l-2 border-blue-500 pl-2">
                  <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                    {stepStage === 'P' ? '계획 점검 항목' : '실적 측정 항목'}
                  </h3>
                  {stepStage === 'P' && (
                    <button
                      type="button"
                      onClick={addPlanItem}
                      className="bg-slate-800 hover:bg-slate-700 text-blue-400 rounded-lg px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1 transition-colors border-0 cursor-pointer"
                    >
                      <Plus size={13} />
                      항목 추가
                    </button>
                  )}
                </div>
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/20">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 select-none">
                        <th className="p-3 font-semibold w-12 text-center">번호</th>
                        <th className="p-3 font-semibold">점검 항목</th>
                        <th className="p-3 font-semibold">점검 방법</th>
                        <th className="p-3 font-semibold text-center">Min</th>
                        <th className="p-3 font-semibold text-center">Max</th>
                        <th className="p-3 font-semibold text-center">기준</th>
                        {stepStage === 'R' && <th className="p-3 font-semibold text-center">측정값</th>}
                        <th className="p-3 font-semibold w-24">단위</th>
                        {stepStage === 'P' && <th className="p-3 font-semibold w-12"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {checkItems.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-600">
                            등록된 점검항목이 없습니다.
                          </td>
                        </tr>
                      ) : (
                        checkItems.map((item, idx) => (
                          <tr key={idx} className="border-b border-slate-900 hover:bg-slate-900/30 text-slate-300">
                            <td className="p-3 text-center text-slate-500">{idx + 1}</td>
                            <td className="p-2">
                              {stepStage === 'P' ? (
                                <input value={item.checkName} onChange={(e) => updateItem(idx, 'checkName', e.target.value)} className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-1 px-2 text-slate-200 outline-none" />
                              ) : <span className="font-semibold text-slate-200">{item.checkName}</span>}
                            </td>
                            <td className="p-2">
                              {stepStage === 'P' ? (
                                <input value={item.checkMethod || ''} onChange={(e) => updateItem(idx, 'checkMethod', e.target.value)} className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-1 px-2 text-slate-200 outline-none" />
                              ) : <span className="text-slate-400">{item.checkMethod || '-'}</span>}
                            </td>
                            {(['minValue', 'maxValue', 'baseValue'] as const).map((field) => (
                              <td key={field} className="p-2">
                                {stepStage === 'P' ? (
                                  <input type="number" step="any" value={item[field] ?? ''} onChange={(e) => updateItem(idx, field, e.target.value)} className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-1 px-2 text-center text-slate-200 outline-none" />
                                ) : <span className="block text-center text-slate-400">{item[field] ?? '-'}</span>}
                              </td>
                            ))}
                            {stepStage === 'R' && (
                              <td className="p-2">
                                <input type="number" step="any" value={item.checkValue ?? ''} onChange={(e) => updateItem(idx, 'checkValue', e.target.value)} className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-1 px-2 text-center text-slate-200 outline-none" />
                              </td>
                            )}
                            <td className="p-2">
                              {stepStage === 'P' ? (
                                <input value={item.unit || ''} onChange={(e) => updateItem(idx, 'unit', e.target.value)} className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-1 px-2 text-slate-200 outline-none" />
                              ) : <span className="text-slate-500">{item.unit || '-'}</span>}
                            </td>
                            {stepStage === 'P' && (
                              <td className="p-2 text-center">
                                <button onClick={() => removePlanItem(idx)} className="p-1.5 text-rose-500 hover:bg-slate-800 rounded border-0 cursor-pointer bg-transparent">
                                  <MinusCircle size={15} />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-800 flex justify-between items-center shrink-0 print:hidden">
              <div className="flex gap-2 ml-auto">
                <button
                  type="button"
                  onClick={onClose}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg py-2 px-4 text-xs font-semibold transition-colors cursor-pointer border-0"
                >
                  닫기
                </button>
                {canDeleteCurrent && <button
                  type="button"
                  onClick={() => handleDelete()}
                  disabled={isLoading}
                  className="cursor-pointer rounded-lg border-0 bg-rose-900/70 px-4 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-800 disabled:opacity-50"
                >
                  삭제
                </button>}
                {canEditCurrent && <button
                  onClick={() => handleSave('T')}
                  disabled={isLoading}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-750 rounded-lg py-2 px-4 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                >
                  임시 저장
                </button>}
                {canEditCurrent && <button
                  onClick={() => handleSave('P')}
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 px-4 text-xs font-semibold transition-colors cursor-pointer border-0 disabled:opacity-50"
                >
                  결재 상신
                </button>}
              </div>
            </div>


      </>
    </Modal>
  );
}
