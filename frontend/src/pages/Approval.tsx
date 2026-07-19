import { useState, useEffect } from 'react';
import axiosInstance from '../api/axios';
import { formatDateTime } from '../utils/datetime';
import RichTextEditor from '../components/RichTextEditor';
import { getApiErrorMessage } from '../utils/apiError';
import { useAuthStore } from '../store/useAuthStore';
import FileUpload from '../components/FileUpload';
import ApprovalDocPrint from '../components/ApprovalDocPrint';
import {
  getCommonStatusLabel as getStatusLabel,
  getCommonStatusClass as getStatusClass,
  getStepTypeLabel,
} from '../constants/status';
import {
  FileSignature, Check, X, Printer, ArrowRight, Plus, Pencil
} from 'lucide-react';

interface ApprovalModel {
  id: string;
  title: string;
  content: string | null;
  drafterId: string;
  fileGroupId: number | null;
  status: string; // T: 임시, P: 진행, C: 완결승인, R: 반려, X: 취소
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: string;
  name: string;
  title: string | null;
  position: string | null;
  departmentName: string | null;
  departmentId: string | null;
  useYn?: string;
}

interface ApprovalStepModel {
  approvalId: string;
  stepNo: number;
  approverId: string;
  approvalType: string; // D: 기안, A: 결재, G: 합의, R: 참조
  approvalResult: string | null; // null: 대기, Y: 승인, N: 반려
  actionAt: string | null;
  comments: string | null;
}

export default function Approval() {
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<'pending' | 'sent' | 'referenced' | 'processed'>('pending');

  const [approvals, setApprovals] = useState<ApprovalModel[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);

  // Modal / Detail states
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalModel | null>(null);
  const [approvalSteps, setApprovalSteps] = useState<ApprovalStepModel[]>([]);

  // Action input states
  const [comments, setComments] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);


  // New Draft Creation Modal
  const [isDraftModalOpen, setIsDraftModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newRefNo, setNewRefNo] = useState('');
  const [newRefModule, setNewRefModule] = useState('');
  const [selectedLine, setSelectedLine] = useState<{ approverId: string; type: string }[]>([]);
  const [lineUserId, setLineUserId] = useState('');
  const [lineType, setLineType] = useState<'A' | 'G' | 'R'>('A');
  const [newFileGroupId, setNewFileGroupId] = useState<number | null>(null);
  const [fileUploading, setFileUploading] = useState(false);
  const [editingApprovalId, setEditingApprovalId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [appRes, userRes] = await Promise.all([
        axiosInstance.get(`/approval/${activeTab}`),
        axiosInstance.get('/mdm/users')
      ]);
      setApprovals(appRes.data);
      setUsersList(userRes.data);
    } catch (err) {
      console.error(err);
      alert(getApiErrorMessage(err, '목록을 불러오지 못했습니다.'));
    }
  };

  useEffect(() => { fetchData(); }, [activeTab]);

  const handleOpenDetail = async (app: ApprovalModel) => {
    setIsLoading(true);
    try {
      const res = await axiosInstance.get(`/approval/${app.id}/details`);
      setSelectedApproval(res.data.approval);
      setApprovalSteps(res.data.steps || []);
      setComments('');
      setIsDetailOpen(true);
    } catch (err) {
      alert(getApiErrorMessage(err, '결재 문서 정보를 불러오는데 실패했습니다.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (action: 'APPROVE' | 'REJECT') => {
    if (!selectedApproval) return;
    setIsLoading(true);
    try {
      await axiosInstance.post(`/approval/${selectedApproval.id}/action`, {
        comments,
        action
      });
      alert(action === 'APPROVE' ? '승인 처리되었습니다.' : '반려 처리되었습니다.');
      setIsDetailOpen(false);
      fetchData();
    } catch (err) {
      alert(getApiErrorMessage(err, '결재 처리 실패'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDraftModal = () => {
    setNewTitle('');
    setNewContent('');
    setNewRefNo('');
    setNewRefModule('');
    setSelectedLine([]);
    setLineUserId('');
    setLineType('A');
    setNewFileGroupId(null);
    setEditingApprovalId(null);
    setNewContent('');
    setIsDraftModalOpen(true);
  };

  const handleEditDraft = async (app: ApprovalModel) => {
    setIsLoading(true);
    try {
      const res = await axiosInstance.get(`/approval/${app.id}/details`);
      setNewTitle(res.data.approval.title);
      setNewContent(res.data.approval.content || '');
      setNewRefNo(res.data.approval.refNo || '');
      setNewRefModule(res.data.approval.refModule || '');
      setNewFileGroupId(res.data.approval.fileGroupId);
      // 기존 결재선 로드 (step_no > 0만, 기안 제외)
      const existingSteps = (res.data.steps || [])
        .filter((s: any) => s.stepNo > 0)
        .map((s: any) => ({ approverId: s.approverId, type: s.approvalType }));
      setSelectedLine(existingSteps);
      setEditingApprovalId(app.id);
      setIsDraftModalOpen(true);
    } catch (err) {
      alert(getApiErrorMessage(err, '결재 문서 정보를 불러오는데 실패했습니다.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddLineApprover = () => {
    if (!lineUserId) return;
    if (selectedLine.some(l => l.approverId === lineUserId)) return;
    setSelectedLine([...selectedLine, { approverId: lineUserId, type: lineType }]);
    setLineUserId('');
  };

  const handleRemoveLineApprover = (idx: number) => {
    setSelectedLine(selectedLine.filter((_, i) => i !== idx));
  };

  const handleSaveDraft = async () => {
    if (!newTitle.trim()) {
      alert('결재 제목을 입력하세요.');
      return;
    }
    if (selectedLine.filter(l => l.type === 'A').length === 0) {
      alert('최소 한 명 이상의 결재선(A)을 지정해야 합니다.');
      return;
    }
    if (fileUploading) {
      alert('첨부파일 업로드가 끝난 뒤 상신해 주세요.');
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        approval: {
          id: editingApprovalId || null,
          title: newTitle,
          content: newContent,
          fileGroupId: newFileGroupId
        },
        steps: selectedLine.map(l => ({
          approverId: l.approverId,
          approvalType: l.type,
        })),
        refNo: newRefNo || null,
        refModule: newRefModule || null
      };

      await axiosInstance.post('/approval/submit', payload);
      alert(editingApprovalId ? '결재 문서가 수정되었습니다.' : '결재 문서가 상신되었습니다.');
      setIsDraftModalOpen(false);
      fetchData();
    } catch (err) {
      alert(getApiErrorMessage(err, '상신 중 오류가 발생했습니다.'));
    } finally {
      setIsLoading(false);
    }
  };

  // Filter steps for signature box
  const draftersAndApprovers = approvalSteps.filter(s => s.approvalType === 'D' || s.approvalType === 'A');
  const agreements = approvalSteps.filter(s => s.approvalType === 'G');
  const references = approvalSteps.filter(s => s.approvalType === 'R');

  // Check if I am the active approver for this document
  const isMyTurn = selectedApproval?.status === 'P' && approvalSteps.some(
    step => step.approverId === user?.id
      && (step.approvalType === 'A' || step.approvalType === 'G')
      && !step.approvalResult
  );

  const renderSignatureBox = (step: ApprovalStepModel) => {
    const matchedUser = usersList.find(u => u.id === step.approverId);
    return (
      <div key={step.stepNo} className="border border-slate-700 w-24 text-center text-[10px] bg-slate-950/40 shrink-0 print:border-slate-450 print:bg-white print:text-black">
        <div className="bg-slate-850 p-1 border-b border-slate-800 text-[9px] font-semibold text-slate-400 print:bg-slate-100 print:text-black print:border-slate-400">
          {matchedUser?.title || (step.approvalType === 'D' ? '기안자' : '결재자')}
        </div>
        <div className="p-2 font-bold text-slate-100 min-h-[30px] flex items-center justify-center print:text-black">
          {matchedUser?.name || step.approverId}
        </div>
        <div className="p-1 border-t border-slate-850 text-[8px] print:border-slate-300">
          {step.approvalResult === 'Y' ? (
            <span className="text-emerald-400 font-extrabold print:text-emerald-700">● 승인</span>
          ) : step.approvalResult === 'N' ? (
            <span className="text-rose-400 font-extrabold print:text-rose-700">● 반려</span>
          ) : (
            <span className="text-blue-400 font-semibold">[대기]</span>
          )}
          {step.actionAt && (
            <div className="text-slate-500 font-mono text-[7px] mt-0.5 print:text-slate-600">
              {formatDateTime(step.actionAt)}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{`
        .approval-content table { border-collapse: collapse; width: 100%; margin-bottom: 1rem; }
        .approval-content td, .approval-content th { border: 1px solid #334155; padding: 6px 8px; }
        .approval-content th { background-color: #334155; color: #e2e8f0; font-weight: 600; }
        .approval-content tr:nth-child(even) td { background-color: #1e293b33; }
        .approval-content table, .approval-content td, .approval-content th { font-size: 0.75rem; }
        @media print {
          .approval-content td, .approval-content th { border-color: #94a3b8; }
          .approval-content th { background-color: #f1f5f9; color: #0f172a; }
          .approval-content tr:nth-child(even) td { background-color: #f8fafc; }
        }
      `}</style>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <FileSignature size={24} className="text-blue-500" />
            전자결재 보관함
          </h1>
          <p className="text-slate-400 text-sm mt-1">예방점검, 작업지시, 작업허가 등 핵심 업무 문서를 상신하거나 승인/반려합니다.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleOpenDraftModal}
            className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-xs font-semibold flex items-center gap-1.5 transition-colors border-0 cursor-pointer shadow-lg shadow-blue-900/20"
          >
            <Plus size={14} />
            기안문
          </button>

          {/* Subtab control */}
          <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer border-0 outline-none ${
                activeTab === 'pending' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              결재 대기함
            </button>
            <button
              onClick={() => setActiveTab('sent')}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer border-0 outline-none ${
                activeTab === 'sent' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              기안/상신함
            </button>
            <button
              onClick={() => setActiveTab('referenced')}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer border-0 outline-none ${
                activeTab === 'referenced' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              참조문서함
            </button>
            <button
              onClick={() => setActiveTab('processed')}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer border-0 outline-none ${
                activeTab === 'processed' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              결재/반려함
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid List */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 print:border-0 print:bg-transparent print:p-0">
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 select-none">
                <th className="p-3 font-semibold">결재문서번호</th>
                <th className="p-3 font-semibold">결재 제목</th>
                <th className="p-3 font-semibold">기안자</th>
                <th className="p-3 font-semibold">상신일시</th>
                <th className="p-3 font-semibold">진행 상태</th>
                <th className="p-3 font-semibold text-right">작업</th>
              </tr>
            </thead>
            <tbody>
              {approvals.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-600">조회된 결재 문서가 없습니다.</td></tr>
              ) : (
                approvals.map((app) => (
                  <tr key={app.id} className="border-b border-slate-900 hover:bg-slate-900/30 text-slate-300">
                    <td className="p-3 font-mono text-slate-400">{app.id}</td>
                    <td className="p-3 font-semibold text-slate-200">{app.title}</td>
                    <td className="p-3">{usersList.find(u => u.id === app.drafterId)?.name || app.drafterId}</td>
                    <td className="p-3 font-mono text-slate-400">{formatDateTime(app.createdAt)}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${getStatusClass(app.status)}`}>
                        {getStatusLabel(app.status)}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {app.status === 'T' && app.drafterId === user?.id && (
                          <button
                            onClick={() => handleEditDraft(app)}
                            className="bg-amber-600/10 hover:bg-amber-600/20 text-amber-400 rounded-lg px-3 py-1.5 font-semibold text-[11px] border border-amber-500/20 hover:border-amber-500/40 flex items-center gap-1 cursor-pointer"
                          >
                            <Pencil size={12} />
                            <span>수정</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenDetail(app)}
                          className="bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 rounded-lg px-3 py-1.5 font-semibold text-[11px] border border-blue-500/20 hover:border-blue-500/40 flex items-center gap-1 cursor-pointer"
                        >
                          <span>결재 보기</span>
                          <ArrowRight size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL MODAL (With signature box) */}
      {isDetailOpen && selectedApproval && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto print:absolute print:inset-0 print:bg-white print:p-0">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl print:border-0 print:shadow-none print:max-h-none print:w-full print:h-full">
            {/* Header */}
            <div className="p-6 border-b border-slate-800 flex justify-between items-center shrink-0 print:hidden">
              <h2 className="text-lg font-bold text-slate-200">전자결재 품의 상세 [품의번호: {selectedApproval.id}]</h2>
              <button onClick={() => setIsDetailOpen(false)} className="text-slate-500 hover:text-slate-300 border-0 cursor-pointer bg-transparent"><X size={20} /></button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 print:hidden">

              {/* Signature Block (4x2 layout) */}
              <div className="flex flex-col sm:flex-row justify-end items-end gap-6 border border-slate-800/60 p-4 rounded-xl bg-slate-950/20 print:border-0 print:p-0 print:bg-transparent">
                
                {/* 1열: 기안/결재자 (최대 4칸) */}
                <div className="space-y-1 text-right">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1 tracking-wider print:text-black">1열 [기안/결재선]</span>
                  <div className="flex gap-1.5 justify-end">
                    {draftersAndApprovers.map(renderSignatureBox)}
                  </div>
                </div>

                {/* 2열: 합의자 (최대 4칸) */}
                {agreements.length > 0 && (
                  <div className="space-y-1 text-right">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1 tracking-wider print:text-black">2열 [합의선]</span>
                    <div className="flex gap-1.5 justify-end">
                      {agreements.map(renderSignatureBox)}
                    </div>
                  </div>
                )}
              </div>

              {/* References list */}
              {references.length > 0 && (
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 text-[10px] flex gap-2 items-center print:bg-slate-50 print:border-slate-300">
                  <span className="text-slate-500 font-bold block shrink-0">참조자 명단:</span>
                  <div className="flex flex-wrap gap-1.5 text-slate-300 print:text-black font-semibold">
                    {references.map((r, i) => (
                      <span key={i} className="bg-slate-900 px-2 py-0.5 rounded print:bg-slate-100">
                        {usersList.find(u => u.id === r.approverId)?.name || r.approverId}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Title & Content */}
              <div className="space-y-4">
                <div className="border-b border-slate-800 pb-3 print:border-slate-350">
                  <span className="text-[10px] font-bold text-slate-500 block mb-1">품의 제목</span>
                  <h3 className="text-base font-extrabold text-slate-100 print:text-black">{selectedApproval.title}</h3>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-500 block mb-1.5">품의 내용 및 상세 본문</span>
                  <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-xl text-slate-300 font-sans text-xs min-h-[150px] leading-relaxed print:bg-white print:border-slate-350 print:text-black print:p-2 approval-content">
                    {selectedApproval.content || '(본문 내용 없음)'}
                  </div>
                </div>

                <div className="print:hidden">
                  <span className="text-[10px] font-bold text-slate-500 block mb-1.5">첨부파일</span>
                  <FileUpload groupNo={selectedApproval.fileGroupId} refModule="APR" readOnly />
                </div>
              </div>

              {/* Comments and Steps History */}
              <div className="space-y-3">
                <span className="text-[10px] font-bold text-slate-500 block">결재 처리 단계별 의견 이력</span>
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/20 print:border-slate-300">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-900/60 text-slate-400 border-b border-slate-800 select-none print:bg-slate-100 print:text-black">
                        <th className="p-2 font-semibold">단계</th>
                        <th className="p-2 font-semibold">결재자</th>
                        <th className="p-2 font-semibold">유형</th>
                        <th className="p-2 font-semibold">결과</th>
                        <th className="p-2 font-semibold">의견 (의사 결정 내용)</th>
                        <th className="p-2 font-semibold">처리 시간</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approvalSteps.map((step) => {
                        const approverUser = usersList.find(u => u.id === step.approverId);
                        return (
                          <tr key={step.stepNo} className="border-b border-slate-900 text-slate-300 print:border-slate-200 print:text-black">
                            <td className="p-2 font-semibold text-slate-500">순번 {step.stepNo}</td>
                            <td className="p-2">{approverUser?.name || step.approverId}</td>
                            <td className="p-2 text-slate-400">{getStepTypeLabel(step.approvalType)}</td>
                            <td className="p-2">
                              <span className={step.approvalResult === 'Y' ? 'text-emerald-400 font-semibold' : step.approvalResult === 'N' ? 'text-rose-400 font-semibold' : 'text-slate-500'}>
                                {step.approvalResult === 'Y' ? '승인' : step.approvalResult === 'N' ? '반려' : '대기'}
                              </span>
                            </td>
                            <td className="p-2 text-slate-400 font-sans italic">{step.comments || '-'}</td>
                            <td className="p-2 font-mono text-slate-500">{step.actionAt ? formatDateTime(step.actionAt) : '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Approval Active Action Area */}
              {isMyTurn && (
                <div className="bg-slate-950 border border-blue-900/30 p-5 rounded-2xl space-y-4 print:hidden shadow-lg shadow-blue-950/20">
                  <h4 className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                    <FileSignature size={15} />
                    결재 의사 결정 승인/반려 작성란 (나의 차례)
                  </h4>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1.5">결재 의견 입력 (의무사항 아님)</label>
                    <textarea
                      rows={2}
                      placeholder="의견이 필요한 경우 기재하세요."
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-xs text-slate-200 outline-none resize-none"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => handleAction('REJECT')}
                      disabled={isLoading}
                      className="bg-rose-950 hover:bg-rose-900 text-rose-400 border border-rose-900 rounded-lg px-4 py-2 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                    >
                      <X size={14} />
                      <span>반려 처리</span>
                    </button>
                    <button
                      onClick={() => handleAction('APPROVE')}
                      disabled={isLoading}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-5 py-2 text-xs font-bold transition-all cursor-pointer border-0 disabled:opacity-50 flex items-center gap-1 shadow-md shadow-emerald-900/20"
                    >
                      <Check size={14} />
                      <span>승인 서명</span>
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* 전용 인쇄뷰 (흑백) */}
            <ApprovalDocPrint
              id={selectedApproval.id}
              status={selectedApproval.status}
              title={selectedApproval.title}
              content={selectedApproval.content}
              steps={approvalSteps.map((s) => ({
                stepNo: s.stepNo,
                approverName: usersList.find((u) => u.id === s.approverId)?.name || s.approverId,
                approvalType: s.approvalType,
                approvalResult: s.approvalResult,
                comments: s.comments,
                actionAt: s.actionAt,
              }))}
            />

            {/* Footer */}
            <div className="p-6 border-t border-slate-800 flex justify-between shrink-0 print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-750 px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer size={14} />
                인쇄 / PDF 저장
              </button>

              <button
                type="button"
                onClick={() => setIsDetailOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg py-2 px-5 text-xs font-semibold cursor-pointer border-0"
              >
                닫기
              </button>
            </div>

          </div>
        </div>
      )}

      {/* DRAFT SUBMISSION MODAL */}
      {isDraftModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center shrink-0">
              <h2 className="text-lg font-bold text-slate-200">
                {editingApprovalId ? '결재 기안서 수정' : '일반 결재 기안서 상신'}
              </h2>
              <button onClick={() => setIsDraftModalOpen(false)} className="text-slate-500 hover:text-slate-300 border-0 cursor-pointer bg-transparent"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
              {message && (
                <div className="p-3 rounded-lg border border-slate-800 bg-slate-900 text-xs text-center text-slate-200 flex items-center justify-center gap-2">
                  {message.type === 'success' ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
                  )}
                  <span>{message.text}</span>
                </div>
              )}
              {/* 1행: 품의 제목 */}
              <div>
                <label className="block text-slate-400 mb-1.5 font-semibold">품의 제목 *</label>
                <input
                  type="text"
                  required
                  placeholder="결재 기안서 제목을 입력해주세요."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none"
                />
              </div>

              {/* 2행: 결재선 */}
              <div>
                <label className="block text-slate-400 mb-2 font-semibold">결재선 구성 (기안자 제외 순차 지정)</label>
                <div className="flex gap-2 mb-3">
                  <select
                    value={lineUserId}
                    onChange={(e) => setLineUserId(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none"
                  >
                    <option value="">사용자 선택</option>
                    {usersList.filter(u => u.id !== user?.id && u.useYn === 'Y').map(u => (
                      <option key={u.id} value={u.id}>{u.name}({u.id}) / {u.position || '-'} / {u.title || '-'} / {u.departmentName || '-'}</option>
                    ))}
                  </select>
                  <select
                    value={lineType}
                    onChange={(e) => setLineType(e.target.value as 'A' | 'G' | 'R')}
                    className="w-28 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none"
                  >
                    <option value="A">결재</option>
                    <option value="G">합의</option>
                    <option value="R">참조</option>
                  </select>
                  <button
                    onClick={handleAddLineApprover}
                    disabled={!lineUserId}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg px-3 flex items-center gap-1 border-0 cursor-pointer"
                  >
                    <Plus size={14} /> 추가
                  </button>
                </div>
                {selectedLine.length === 0 ? (
                  <div className="text-center py-3 text-slate-600 bg-slate-950/50 rounded-lg border border-slate-800">
                    결재선을 지정해주세요.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {selectedLine.map((line, idx) => {
                      const u = usersList.find(usr => usr.id === line.approverId);
                      const typeLabel = line.type === 'A' ? '결재' : line.type === 'G' ? '합의' : '참조';
                      const typeColor = line.type === 'A' ? 'text-blue-400' : line.type === 'G' ? 'text-purple-400' : 'text-slate-400';
                      return (
                        <div key={idx} className="flex justify-between items-center bg-slate-950 px-3 py-2 rounded border border-slate-800">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500 font-mono w-5">{idx + 1}</span>
                            <span className={`font-semibold text-[10px] ${typeColor} w-10`}>{typeLabel}</span>
                            <span className="text-slate-200">{u?.name}</span>
                            <span className="text-slate-500 text-[10px]">({u?.position || '-'}) / {u?.departmentName || '-'}</span>
                          </div>
                          <button
                            onClick={() => handleRemoveLineApprover(idx)}
                            className="text-slate-600 hover:text-rose-400 bg-transparent border-0 cursor-pointer text-xs"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 3행: 본문 (Tiptap 에디터) */}
              <div>
                <label className="block text-slate-400 mb-1.5 font-semibold">상세 내용</label>
                <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden">
                  <RichTextEditor
                    key={editingApprovalId || 'new'}
                    content={newContent}
                    onChange={setNewContent}
                    placeholder="품의 내용을 구체적으로 작성하세요."
                    minHeight="200px"
                  />
                </div>
              </div>

              {/* 4행: 첨부파일 */}
              <div>
                <label className="block text-slate-400 mb-1.5 font-semibold">첨부파일</label>
                <FileUpload
                  groupNo={newFileGroupId}
                  refModule="APR"
                  onGroupNoChange={setNewFileGroupId}
                  onUploadingChange={setFileUploading}
                  onError={(msg) => setMessage({ type: 'error', text: msg })}
                />
              </div>

              {/* 연계 참조 (옵션) */}
              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-800">
                <div>
                  <label className="block text-slate-400 mb-1.5">연계 참조 번호</label>
                  <input
                    type="text"
                    placeholder="예: WO-202605-0001"
                    value={newRefNo}
                    onChange={(e) => setNewRefNo(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1.5">연계 참조 모듈</label>
                  <input
                    type="text"
                    placeholder="예: WO, PM"
                    value={newRefModule}
                    onChange={(e) => setNewRefModule(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-800 flex justify-end gap-2 shrink-0">
              <button onClick={() => setIsDraftModalOpen(false)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg py-2 px-4 border-0 cursor-pointer">취소</button>
              <button onClick={handleSaveDraft} disabled={isLoading || fileUploading} className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 px-5 border-0 cursor-pointer disabled:opacity-50">{fileUploading ? '업로드 중…' : (editingApprovalId ? '수정 상신' : '기안 상신')}</button>
            </div>
          </div>
        </div>
      )}

    </div>
    </>
  );
}
