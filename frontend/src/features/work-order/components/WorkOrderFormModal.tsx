import { Plus, Trash } from 'lucide-react';
import { formatDateOnly } from '../../../utils/datetime';
import EquipmentSelector from '../../master/components/EquipmentSelector';
import type { Dispatch, SetStateAction } from 'react';
import Modal from '../../../components/Modal';
import type { WorkOrderItem } from '../work-order.types';

interface WorkOrderFormProps {
  woNo: string;
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
  equipmentName: string;
  plantId: string;
  activePlantId: string | null;
  canEditCurrent: boolean;
  canDeleteCurrent: boolean;
  setEquipmentId: Dispatch<SetStateAction<string>>;
  setEquipmentName: Dispatch<SetStateAction<string>>;
  setPlantId: Dispatch<SetStateAction<string>>;
  woTypeCode: string;
  setWoTypeCode: Dispatch<SetStateAction<string>>;
  workDate: string;
  setWorkDate: Dispatch<SetStateAction<string>>;
  manHours: number;
  setManHours: Dispatch<SetStateAction<number>>;
  manHoursUnit: string;
  setManHoursUnit: Dispatch<SetStateAction<string>>;
  cost: number;
  setCost: Dispatch<SetStateAction<number>>;
  refNo: string;
  refModule: string;
  remarks: string;
  setRemarks: Dispatch<SetStateAction<string>>;
  workItems: WorkOrderItem[];
  handleAddItem: () => void;
  handleRemoveItem: (index: number) => void;
  handleItemChange: (index: number, field: keyof WorkOrderItem, value: string) => void;
  isLoading: boolean;
  handleSave: (status: 'T' | 'P') => void | Promise<void>;
  handleDelete: () => void | Promise<void>;
}

export default function WorkOrderFormModal({ title: modalTitle, onClose, form }: { title: string; onClose: () => void; form: WorkOrderFormProps }) {
  const {
    woNo, stepStage, createdAt, departmentId, depts, createdBy, user, usersList,
    title, setTitle, equipmentId, plantId, activePlantId, canEditCurrent,
    canDeleteCurrent,
    setEquipmentId, setEquipmentName, setPlantId, woTypeCode, setWoTypeCode,
    workDate, setWorkDate, manHours, setManHours, manHoursUnit, setManHoursUnit,
    cost, setCost, refNo, refModule, remarks, setRemarks, workItems,
    handleAddItem, handleRemoveItem, handleItemChange, isLoading, handleSave,
    handleDelete,
  } = form;

  return (
    <Modal title={modalTitle} onClose={onClose} contentClassName="flex-1 overflow-y-auto p-0">
      <>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 print:hidden">

              {/* Status Header Area */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-5 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block mb-0.5">문서번호</span>
                  <span className="font-mono font-semibold text-slate-300">{woNo || '(저장 시 자동발행)'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block mb-0.5">작성일</span>
                  <span className="font-mono text-slate-300">{formatDateOnly(createdAt) || (woNo ? '-' : '저장 시 기록')}</span>
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
                        <label className="block text-slate-400 mb-1.5 print:text-slate-600 font-semibold">지시명 <span className="text-rose-500 print:hidden">*</span></label>
                        <input
                          type="text"
                          required
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          placeholder="예: 3호기 순환펌프 메카니컬 씰 교체 작업"
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
                        <label className="block text-slate-400 mb-1.5 print:text-slate-600">작업 구분</label>
                        <select
                          value={woTypeCode}
                          onChange={(e) => setWoTypeCode(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-300 outline-none print:bg-white print:border-slate-300 print:text-slate-800"
                        >
                          <option value="BM">고장정비 (BM)</option>
                          <option value="PM">예방보전 (PM)</option>
                          <option value="CM">개조/개선 (CM)</option>
                          <option value="ETC">기타 작업</option>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                      <div>
                        <label className="block text-slate-400 mb-1.5 print:text-slate-600">계획/수행 일자</label>
                        <input
                          type="date"
                          value={workDate}
                          onChange={(e) => setWorkDate(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none print:bg-white print:border-slate-300 print:text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1.5 print:text-slate-600">소요 공수시간(M/H)</label>
                        <div className="flex gap-1.5">
                          <input
                            type="number"
                            step="0.5"
                            value={manHours}
                            onChange={(e) => setManHours(Number(e.target.value))}
                            className="flex-1 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none print:bg-white print:border-slate-300 print:text-slate-800"
                          />
                          <select
                            value={manHoursUnit}
                            onChange={(e) => setManHoursUnit(e.target.value)}
                            className="w-16 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-1 text-slate-300 text-center outline-none print:bg-white print:border-slate-300 print:text-slate-800"
                          >
                            <option value="H">시간</option>
                            <option value="D">일(Day)</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1.5 print:text-slate-600">외주/자재 비용 (원)</label>
                        <input
                          type="number"
                          value={cost}
                          onChange={(e) => setCost(Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none print:bg-white print:border-slate-300 print:text-slate-800"
                        />
                      </div>
                      <div className="hidden print:block">
                        <label className="block text-slate-400 mb-1.5 print:text-slate-600">연계 참조번호 / 참조모듈</label>
                        <div className="flex gap-1.5 font-mono text-[10px]">
                          <input
                            type="text"
                            placeholder="참조번호"
                            disabled
                            value={refNo}
                            className="w-2/3 bg-slate-950 border border-slate-800 rounded-lg py-2 px-2 text-slate-200 outline-none print:bg-white print:border-slate-300 print:text-slate-800"
                          />
                          <input
                            type="text"
                            placeholder="모듈"
                            disabled
                            value={refModule}
                            className="w-1/3 bg-slate-950 border border-slate-800 rounded-lg py-2 px-2 text-slate-200 text-center outline-none print:bg-white print:border-slate-300 print:text-slate-800"
                          />
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
                    <div className="grid grid-cols-1 gap-4 text-xs">
                      <div>
                        <label className="block text-slate-400 mb-1.5 print:text-slate-600">작업 특이사항 및 조치 비고</label>
                        <textarea
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          placeholder="고장 증상, 원인 분석 및 대책 조치 비고 등을 상세 기술합니다."
                          rows={2}
                          className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none resize-none print:bg-white print:border-slate-300 print:text-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Items checklist (Work Order Items) */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider border-l-2 border-blue-500 pl-2 print:text-slate-850 print:border-slate-400">
                    작업 세부 항목 / 절차 리스트
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="bg-slate-850 hover:bg-slate-800 border border-slate-800 text-blue-400 rounded-lg px-2.5 py-1 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer print:hidden"
                  >
                    <Plus size={12} />
                    <span>작업 항목 추가</span>
                  </button>
                </div>
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/20 print:border-slate-300 print:rounded-none">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 select-none print:bg-slate-100 print:text-slate-800 print:border-slate-300">
                        <th className="p-3 font-semibold w-12 text-center">순번</th>
                        <th className="p-3 font-semibold w-2/5">작업/점검 내용 <span className="text-rose-500 print:hidden">*</span></th>
                        <th className="p-3 font-semibold w-2/5">작업 방법/표준</th>
                        <th className="p-3 font-semibold">작업 결과 (실적 조치)</th>
                        <th className="p-3 font-semibold w-16 text-center print:hidden">삭제</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workItems.length === 0 ? (
                        <tr><td colSpan={5} className="p-8 text-center text-slate-600 print:text-slate-400">작업 세부 항목이 없습니다. 우측 상단의 [작업 항목 추가] 버튼을 클릭하세요.</td></tr>
                      ) : (
                        workItems.map((item, idx) => (
                          <tr key={idx} className="border-b border-slate-900 hover:bg-slate-900/30 text-slate-300 print:border-slate-200 print:text-slate-800 print:hover:bg-transparent">
                            <td className="p-3 text-center text-slate-500 font-semibold">{item.itemNo}</td>
                            <td className="p-2">
                              <input
                                type="text"
                                required
                                placeholder="예: 구품 메카니컬 씰 철거"
                                value={item.workName}
                                onChange={(e) => handleItemChange(idx, 'workName', e.target.value)}
                                className="w-full bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-lg py-1.5 px-2.5 text-xs text-slate-200 outline-none print:border-slate-200 print:bg-white print:text-slate-800"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                placeholder="예: 샤프트 흠집 주의 및 이물질 청소"
                                value={item.workMethod || ''}
                                onChange={(e) => handleItemChange(idx, 'workMethod', e.target.value)}
                                className="w-full bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-lg py-1.5 px-2.5 text-xs text-slate-300 outline-none print:border-slate-200 print:bg-white print:text-slate-850"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                placeholder="예: 이상 무 / 청소 및 조치 완료"
                                value={item.workResult || ''}
                                onChange={(e) => handleItemChange(idx, 'workResult', e.target.value)}
                                className="w-full bg-slate-950 border border-slate-850 focus:border-blue-500 rounded-lg py-1.5 px-2.5 text-xs text-slate-300 outline-none print:border-slate-200 print:bg-white print:text-slate-855"
                              />
                            </td>
                            <td className="p-2 text-center print:hidden">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="p-1 hover:bg-slate-850 rounded text-slate-500 hover:text-rose-400 transition-colors border-0 cursor-pointer bg-transparent"
                              >
                                <Trash size={14} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
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
