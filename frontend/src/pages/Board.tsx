import { useState, useEffect } from 'react';
import axiosInstance from '../api/axios';
import { useAuthStore } from '../store/useAuthStore';
import FileUpload from '../components/FileUpload';
import { formatDateTime, formatDate } from '../utils/datetime';
import { getApiErrorMessage } from '../utils/apiError';
import { 
  Plus, Trash, Download, X, Megaphone, MessageSquare, ChevronRight 
} from 'lucide-react';

interface BoardModel {
  id: number;
  boardTypeCode: string;
  title: string;
  content: string;
  noticeYn: string; // Y, N
  fileGroupId: number | null;
  refNo: string | null;
  refModule: string | null;
  createdAt: string;
  createdBy: string;
}

interface BoardCommentModel {
  boardId: number;
  commentNo: number;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export default function Board() {
  const user = useAuthStore((s) => s.user);

  const [posts, setPosts] = useState<BoardModel[]>([]);
  
  // UI / Popups
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<BoardModel | null>(null);
  const [comments, setComments] = useState<BoardCommentModel[]>([]);

  // Editing/Creating post form
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formId, setFormId] = useState<number | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formNoticeYn, setFormNoticeYn] = useState('N');
  const [formBoardType, setFormBoardType] = useState('FREE'); // Default FREE
  const [formFileGroupId, setFormFileGroupId] = useState<number | null>(null);
  const [fileUploading, setFileUploading] = useState(false);

  // Comment input
  const [newCommentContent, setNewCommentContent] = useState('');

  const [isLoading, setIsLoading] = useState(false);

  const fetchData = async () => {
    try {
      const res = await axiosInstance.get('/board');
      setPosts(res.data);
    } catch (err) {
      console.error(err);
      alert(getApiErrorMessage(err, '목록을 불러오지 못했습니다.'));
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleOpenDetail = async (post: BoardModel) => {
    setIsLoading(true);
    try {
      const res = await axiosInstance.get(`/board/${post.id}/details`);
      setSelectedPost(res.data.board);
      setComments(res.data.comments || []);
      setNewCommentContent('');
      setIsDetailOpen(true);
    } catch (err) {
      alert(getApiErrorMessage(err, '게시글 상세 내역을 불러오는데 실패했습니다.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setFormId(null);
    setFormTitle('');
    setFormContent('');
    setFormNoticeYn('N');
    setFormBoardType('FREE');
    setFormFileGroupId(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (post: BoardModel) => {
    setFormId(post.id);
    setFormTitle(post.title);
    setFormContent(post.content);
    setFormNoticeYn(post.noticeYn);
    setFormBoardType(post.boardTypeCode);
    setFormFileGroupId(post.fileGroupId);
    setIsFormOpen(true);
  };

  const handleSavePost = async () => {
    if (!formTitle.trim() || !formContent.trim()) {
      alert('제목과 내용을 모두 기입해 주세요.');
      return;
    }
    if (fileUploading) {
      alert('첨부파일 업로드가 끝난 뒤 저장해 주세요.');
      return;
    }
    setIsLoading(true);
    try {
      const payload = {
        id: formId,
        boardTypeCode: formBoardType,
        title: formTitle,
        content: formContent,
        noticeYn: formNoticeYn,
        fileGroupId: formFileGroupId
      };
      await axiosInstance.post('/board', payload);
      alert('저장 완료되었습니다.');
      setIsFormOpen(false);
      fetchData();
      if (formId && selectedPost && selectedPost.id === formId) {
        // 상세조회 열려있으면 리로딩
        const updated = await axiosInstance.get(`/board/${formId}/details`);
        setSelectedPost(updated.data.board);
      }
    } catch (err) {
      alert(getApiErrorMessage(err, '저장 오류 발생'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePost = async (post: BoardModel) => {
    if (!confirm('정말 이 게시글을 삭제하시겠습니까?')) return;
    try {
      await axiosInstance.delete(`/board/${post.id}`);
      alert('삭제되었습니다.');
      setIsDetailOpen(false);
      fetchData();
    } catch (err) {
      alert(getApiErrorMessage(err, '삭제 오류 발생'));
    }
  };

  const handleSaveComment = async () => {
    if (!selectedPost || !newCommentContent.trim()) return;
    try {
      const payload = {
        boardId: selectedPost.id,
        authorId: user?.id || 'GUEST',
        content: newCommentContent
      };
      await axiosInstance.post('/board/comment', payload);
      setNewCommentContent('');
      
      // 리로딩
      const res = await axiosInstance.get(`/board/${selectedPost.id}/details`);
      setComments(res.data.comments || []);
    } catch (err) {
      alert(getApiErrorMessage(err, '댓글 등록 중 오류 발생'));
    }
  };

  const handleDeleteComment = async (comment: BoardCommentModel) => {
    if (!confirm('댓글을 삭제하시겠습니까?')) return;
    try {
      await axiosInstance.delete(`/board/comment?boardId=${comment.boardId}&commentNo=${comment.commentNo}`);
      
      // 리로딩
      const res = await axiosInstance.get(`/board/${comment.boardId}/details`);
      setComments(res.data.comments || []);
    } catch (err) {
      alert(getApiErrorMessage(err, '댓글 삭제 오류'));
    }
  };

  const exportCsv = () => {
    if (posts.length === 0) return;
    const headers = ['번호', '구분', '제목', '공지여부', '기안자', '기안일'];
    const rows = posts.map(p => [
      p.id,
      p.boardTypeCode === 'NOTICE' ? '공지사항' : '일반게시',
      p.title,
      p.noticeYn === 'Y' ? '예' : '아니오',
      p.createdBy,
      formatDate(p.createdAt)
    ]);

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(e => e.map(val => `"${val.toString().replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'board_posts.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Megaphone size={24} className="text-blue-500" />
            전사 게시판 & 공지사항
          </h1>
          <p className="text-slate-400 text-sm mt-1">공지사항 및 자유로운 전사 업무 소통 게시글을 공유하고 소통합니다.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={exportCsv}
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
            새 글 작성
          </button>
        </div>
      </div>

      {/* Post List View */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 select-none">
                <th className="p-3 font-semibold w-20 text-center">번호</th>
                <th className="p-3 font-semibold w-24 text-center">구분</th>
                <th className="p-3 font-semibold">게시글 제목</th>
                <th className="p-3 font-semibold w-32">기안자</th>
                <th className="p-3 font-semibold w-36">작성일자</th>
                <th className="p-3 font-semibold w-16 text-right">상세</th>
              </tr>
            </thead>
            <tbody>
              {posts.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-600">등록된 게시물이 없습니다.</td></tr>
              ) : (
                posts.map((post) => {
                  const isNotice = post.noticeYn === 'Y';
                  return (
                    <tr 
                      key={post.id} 
                      className={`border-b border-slate-900 hover:bg-slate-900/30 text-slate-300 transition-all ${
                        isNotice ? 'bg-blue-950/10 font-bold border-l-2 border-l-blue-500' : ''
                      }`}
                    >
                      <td className="p-3 text-center font-mono text-slate-500">
                        {isNotice ? <Megaphone size={13} className="text-amber-500 mx-auto" /> : post.id}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] ${
                          isNotice 
                            ? 'bg-amber-950 text-amber-400 border border-amber-900' 
                            : 'bg-slate-950 text-slate-400 border border-slate-800'
                        }`}>
                          {isNotice ? '공지' : '일반'}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-100 hover:text-blue-400 cursor-pointer" onClick={() => handleOpenDetail(post)}>
                            {post.title}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 text-slate-400">{post.createdBy}</td>
                      <td className="p-3 font-mono text-slate-500">{formatDateTime(post.createdAt)}</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleOpenDetail(post)}
                          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-blue-400 transition-colors border-0 cursor-pointer bg-transparent"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL & COMMENT POPUP */}
      {isDetailOpen && selectedPost && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
            {/* Header */}
            <div className="p-6 border-b border-slate-800 flex justify-between items-center shrink-0">
              <h2 className="text-lg font-bold text-slate-200 flex items-center gap-1.5">
                {selectedPost.noticeYn === 'Y' && <Megaphone size={18} className="text-amber-500" />}
                게시글 상세 조회
              </h2>
              <button onClick={() => setIsDetailOpen(false)} className="text-slate-500 hover:text-slate-300 border-0 cursor-pointer bg-transparent"><X size={20} /></button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-300">
              <div className="border-b border-slate-850 pb-3 flex justify-between items-end">
                <div>
                  <h3 className="text-base font-extrabold text-slate-100">{selectedPost.title}</h3>
                  <div className="flex gap-4 text-slate-500 font-mono text-[10px] mt-1.5">
                    <span>작성자: {selectedPost.createdBy}</span>
                    <span>작성일시: {formatDateTime(selectedPost.createdAt)}</span>
                  </div>
                </div>

                {/* Edit / Delete Buttons if owner (Here we allow any logged user or admin to manage, to keep it simple, or based on ID) */}
                <div className="flex gap-1.5">
                  <button 
                    onClick={() => handleOpenEdit(selectedPost)}
                    className="bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-800 px-2.5 py-1.5 rounded text-[10px] font-bold cursor-pointer"
                  >
                    수정
                  </button>
                  <button 
                    onClick={() => handleDeletePost(selectedPost)}
                    className="bg-rose-950 hover:bg-rose-900 text-rose-400 border border-rose-900 px-2.5 py-1.5 rounded text-[10px] font-bold cursor-pointer"
                  >
                    삭제
                  </button>
                </div>
              </div>

              {/* Main Content body */}
              <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl text-slate-300 font-sans text-xs whitespace-pre-wrap min-h-[120px] leading-relaxed">
                {selectedPost.content}
              </div>

              {/* 첨부파일 (읽기 전용) */}
              <FileUpload groupNo={selectedPost.fileGroupId} refModule="BRD" readOnly />

              {/* Comment Section (Single layer) */}
              <div className="space-y-4">
                <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                  <MessageSquare size={14} className="text-blue-500" />
                  댓글 피드백 ({comments.length}개)
                </span>

                {/* Comment input form */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="업무 피드백 또는 댓글을 한 줄로 입력하세요."
                    value={newCommentContent}
                    onChange={(e) => setNewCommentContent(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveComment()}
                    className="flex-1 bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none text-xs"
                  />
                  <button
                    onClick={handleSaveComment}
                    className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 text-xs font-bold border-0 cursor-pointer"
                  >
                    등록
                  </button>
                </div>

                {/* Comment list */}
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {comments.length === 0 ? (
                    <span className="text-slate-600 block text-center py-4">등록된 댓글 피드백이 없습니다.</span>
                  ) : (
                    comments.map((comment, idx) => (
                      <div key={idx} className="bg-slate-950/20 border border-slate-850 p-3 rounded-lg flex justify-between items-start gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <strong className="text-slate-300 font-semibold">{comment.authorName}</strong>
                            <span className="text-slate-650 font-mono text-[9px]">{formatDateTime(comment.createdAt)}</span>
                          </div>
                          <p className="text-slate-400 font-sans">{comment.content}</p>
                        </div>
                        {/* Only allow deletion for matching author, or simply let anyone clean it */}
                        <button
                          onClick={() => handleDeleteComment(comment)}
                          className="text-slate-600 hover:text-rose-400 bg-transparent border-0 cursor-pointer"
                        >
                          <Trash size={12} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-800 flex justify-end shrink-0">
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

      {/* EDIT / CREATE FORM MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-200">
                {formId ? '게시글 수정' : '새 게시글 작성'}
              </h2>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-500 hover:text-slate-300 border-0 cursor-pointer bg-transparent"><X size={20} /></button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-slate-500 mb-1.5">글 제목 *</label>
                  <input
                    type="text"
                    required
                    placeholder="제목을 입력하세요."
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1.5">공지 여부</label>
                  <select
                    value={formNoticeYn}
                    onChange={(e) => setFormNoticeYn(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-300 outline-none"
                  >
                    <option value="N">일반 (N)</option>
                    <option value="Y">공지글 고정 (Y)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1.5">게시판 유형</label>
                  <select
                    value={formBoardType}
                    onChange={(e) => setFormBoardType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-300 outline-none"
                  >
                    <option value="FREE">자유게시판</option>
                    <option value="NOTICE">공지사항</option>
                    <option value="WORK">업무게시판</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-slate-500 mb-1.5">상세 내용 *</label>
                  <textarea
                    rows={6}
                    placeholder="본문 내용을 입력하세요."
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none resize-none font-sans"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-slate-500 mb-1.5">첨부파일</label>
                  <FileUpload
                    groupNo={formFileGroupId}
                    refModule="BRD"
                    onGroupNoChange={setFormFileGroupId}
                    onUploadingChange={setFileUploading}
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-800 flex justify-end gap-2">
              <button onClick={() => setIsFormOpen(false)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg py-2 px-4 border-0 cursor-pointer">취소</button>
              <button onClick={handleSavePost} disabled={isLoading || fileUploading} className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg py-2 px-4 border-0 cursor-pointer disabled:opacity-50">{fileUploading ? '업로드 중…' : '저장 완료'}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
