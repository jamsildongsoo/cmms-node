import type { Dispatch, SetStateAction } from 'react';
import { CheckSquare, ChevronDown, ChevronUp, Square } from 'lucide-react';
import Modal from '../../../components/Modal';
import { formatDateOnly } from '../../../utils/datetime';
import EquipmentSelector from '../../master/components/EquipmentSelector';
import type { WorkPermitCheckItem } from '../work-permit.types';

interface WorkPermitFormProps {
  wpNo: string;
  stepStage: string;
  createdAt: string;
  departmentId: string;
  depts: Array<{ id: string; name: string }>;
  createdBy: string;
  user: { id?: string; name?: string } | null | undefined;
  usersList: Array<{ id: string; name: string; title?: string | null; position?: string | null }>;
  title: string;
  setTitle: Dispatch<SetStateAction<string>>;
  equipmentId: string;
  plantId: string;
  activePlantId: string | null;
  canEditCurrent: boolean;
  canDeleteCurrent: boolean;
  setEquipmentId: Dispatch<SetStateAction<string>>;
  setEquipmentName: Dispatch<SetStateAction<string>>;
  setPlantId: Dispatch<SetStateAction<string>>;
  supervisorId: string;
  setSupervisorId: Dispatch<SetStateAction<string>>;
  workOrderId: string;
  setWorkOrderId: Dispatch<SetStateAction<string>>;
  workOrders: Array<{ id: string; title: string }>;
  startAt: string;
  setStartAt: Dispatch<SetStateAction<string>>;
  endAt: string;
  setEndAt: Dispatch<SetStateAction<string>>;
  selectedTypes: string[];
  handleTypeToggle: (type: string) => void;
  getWpTypeLabel: (type: string) => string;
  workSummary: string;
  setWorkSummary: Dispatch<SetStateAction<string>>;
  riskFactors: string;
  setRiskFactors: Dispatch<SetStateAction<string>>;
  safetyMeasures: string;
  setSafetyMeasures: Dispatch<SetStateAction<string>>;
  checksheets: Array<{ id: string; name: string; state: WorkPermitCheckItem[] }>;
  accordionOpen: Record<string, boolean>;
  toggleAccordion: (type: string) => void;
  handleCheckChange: (type: string, index: number, field: 'checked' | 'remarks', value: boolean | string) => void;
  isLoading: boolean;
  handleSave: (status: 'T' | 'P') => void | Promise<void>;
  handleDelete: () => void | Promise<void>;
}

export default function WorkPermitFormModal({ title: modalTitle, onClose, form }: { title: string; onClose: () => void; form: WorkPermitFormProps }) {
  const {
    wpNo, stepStage, createdAt, departmentId, depts, createdBy, user, usersList,
    title, setTitle, equipmentId, plantId, activePlantId, canEditCurrent,
    canDeleteCurrent,
    setEquipmentId, setEquipmentName, setPlantId, supervisorId, setSupervisorId,
    workOrderId, setWorkOrderId, workOrders, startAt, setStartAt, endAt, setEndAt,
    selectedTypes, handleTypeToggle, getWpTypeLabel, workSummary, setWorkSummary,
    riskFactors, setRiskFactors, safetyMeasures, setSafetyMeasures, checksheets,
    accordionOpen, toggleAccordion, handleCheckChange, isLoading, handleSave,
    handleDelete,
  } = form;

  return (
    <Modal title={modalTitle} onClose={onClose} contentClassName="flex-1 overflow-y-auto p-0">
      <>
            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 print:hidden">

              {/* PAGE 1: GENERAL PERMIT COVER */}
              <div className="space-y-6">

                {/* Status Header Area */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 block mb-0.5">문서번호</span>
                    <span className="font-mono font-semibold text-slate-300">{wpNo || '(저장 시 자동발행)'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5">작성일</span>
                    <span className="font-mono text-slate-300">{formatDateOnly(createdAt) || (wpNo ? '-' : '저장 시 기록')}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5">부서</span>
                    <span className="text-slate-300">{departmentId || '-'} / {depts.find((item) => item.id === departmentId)?.name || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5">작성자</span>
                    <span className="text-slate-300">{createdBy || user?.id || '-'} / {usersList.find((item) => item.id === (createdBy || user?.id))?.name || user?.name || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5">단계</span>
                    <span className="text-slate-300">{stepStage === 'P' ? '계획(P)' : '실적(R)'}</span>
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
                          <label className="block text-slate-400 mb-1.5 print:text-slate-600 font-semibold">허가명 <span className="text-rose-500 print:hidden">*</span></label>
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
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1.5 print:text-slate-600">담당자</label>
                          <input
                            type="text"
                            readOnly
                            value={usersList.find((item) => item.id === (createdBy || user?.id))?.name || user?.name || createdBy || '-'}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 px-3 text-slate-400 outline-none cursor-not-allowed print:bg-white print:border-slate-300 print:text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1.5 print:text-slate-600">감독자</label>
                          <select
                            value={supervisorId}
                            onChange={(e) => setSupervisorId(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-300 outline-none print:bg-white print:border-slate-300 print:text-slate-800"
                          >
                            <option value="">-- 감독자 선택 --</option>
                            {usersList.map((candidate) => (
                              <option key={candidate.id} value={candidate.id}>{candidate.name} [{candidate.id}]</option>
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
                          <label className="block text-slate-400 mb-1.5 print:text-slate-600">시작 시간</label>
                          <input
                            type="datetime-local"
                            value={startAt}
                            onChange={(e) => setStartAt(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none print:bg-white print:border-slate-300 print:text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1.5 print:text-slate-600">종료 시간</label>
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

            {/* Modal Footer */}
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
