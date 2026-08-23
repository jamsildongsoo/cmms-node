import { useCallback, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { requestConfirmation } from '../utils/userActionDialog';
import FileUpload from '../features/files/components/FileUpload';
import { APP_MODULE } from '../constants/module';
import { boardApi } from '../features/board/board.api';
import type {
  BoardComment,
  BoardPost,
  YesNo,
} from '../features/board/board.types';
import { useAuthStore } from '../store/useAuthStore';
import RichTextViewer from '../components/RichTextViewer';
import BoardFormModal from '../features/board/components/BoardFormModal';
import Modal from '../components/Modal';
import {
  createEmptyRichTextDocument,
  isRichTextEmpty,
  type RichTextDocument,
} from '../types/richText';
import { formatDateTime } from '../utils/datetime';
import { toastApiError } from '../utils/apiError';
import ListBadge from '../components/ListBadge';
import {
  Plus, Trash, Megaphone, MessageSquare
} from 'lucide-react';

export default function Board() {
  const user = useAuthStore((state) => state.user);

  const [posts, setPosts] = useState<BoardPost[]>([]);
  
  // UI / Popups
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<BoardPost | null>(null);
  const [comments, setComments] = useState<BoardComment[]>([]);

  // Editing/Creating post form
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formId, setFormId] = useState<number | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState<RichTextDocument>(createEmptyRichTextDocument);
  const [formNoticeYn, setFormNoticeYn] = useState<YesNo>('N');
  const [formBoardType, setFormBoardType] = useState('FREE'); // Default FREE
  const [formFileGroupId, setFormFileGroupId] = useState<number | null>(null);
  const [fileUploading, setFileUploading] = useState(false);

  // Comment input
  const [newCommentContent, setNewCommentContent] = useState('');

  const [isLoading, setIsLoading] = useState(false);

  const formatAuthor = (post: BoardPost) =>
    post.createdByName ? `${post.createdBy} / ${post.createdByName}` : post.createdBy;

  const isOwnPost = (post: BoardPost) => post.createdBy === user?.id;
  const isOwnComment = (authorId: string) => authorId === user?.id;

  const loadList = useCallback(async () => {
    try {
      setPosts(await boardApi.getPosts());
    } catch (err) {
      console.error(err);
      toastApiError(err, '목록을 불러오지 못했습니다.');
    }
  }, []);

  useEffect(() => {
    const run = async () => {
      await loadList();
    };
    void run();
  }, [loadList]);

  const loadDetail = async (post: BoardPost) => {
    setIsLoading(true);
    try {
      const detail = await boardApi.getDetail(post.id);
      setSelectedPost(detail.board);
      setComments(detail.comments);
      setNewCommentContent('');
      setIsDetailOpen(true);
    } catch (err) {
      toastApiError(err, '게시글 상세 내역을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setFormId(null);
    setFormTitle('');
    setFormContent(createEmptyRichTextDocument());
    setFormNoticeYn('N');
    setFormBoardType('FREE');
    setFormFileGroupId(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (post: BoardPost) => {
    setFormId(post.id);
    setFormTitle(post.title);
    setFormContent(post.content);
    setFormNoticeYn(post.noticeYn);
    setFormBoardType(post.boardTypeCode);
    setFormFileGroupId(post.fileGroupId);
    setIsFormOpen(true);
  };

  const handleSavePost = async () => {
    if (!formTitle.trim() || isRichTextEmpty(formContent)) {
      toast.error('제목과 내용을 모두 기입해 주세요.');
      return;
    }
    if (fileUploading) {
      toast.error('첨부파일 업로드가 끝난 뒤 저장해 주세요.');
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
      const saved = await boardApi.savePost(payload);
      toast.success('저장 완료되었습니다.');
      setIsFormOpen(false);
      await loadList();
      if (formId && selectedPost && selectedPost.id === formId) {
        setSelectedPost(saved);
      }
    } catch (err) {
      toastApiError(err, '저장 오류 발생');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePost = async (post: BoardPost) => {
    if (!(await requestConfirmation('정말 이 게시글을 삭제하시겠습니까?'))) return;
    try {
      await boardApi.deletePost(post.id);
      toast.success('삭제되었습니다.');
      setIsDetailOpen(false);
      await loadList();
    } catch (err) {
      toastApiError(err, '삭제 오류 발생');
    }
  };

  const handleSaveComment = async () => {
    if (!selectedPost || !newCommentContent.trim()) return;
    try {
      const payload = {
        boardId: selectedPost.id,
        content: newCommentContent
      };
      const saved = await boardApi.saveComment(payload);
      setNewCommentContent('');
      setComments((current) => [...current, saved]);
    } catch (err) {
      toastApiError(err, '댓글 등록 중 오류 발생');
    }
  };

  const handleDeleteComment = async (comment: BoardComment) => {
    if (!(await requestConfirmation('댓글을 삭제하시겠습니까?'))) return;
    try {
      await boardApi.deleteComment(comment.boardId, comment.commentNo);
      setComments((current) =>
        current.filter((item) => item.commentNo !== comment.commentNo),
      );
    } catch (err) {
      toastApiError(err, '댓글 삭제 오류');
    }
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
              </tr>
            </thead>
            <tbody>
              {posts.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-600">등록된 게시물이 없습니다.</td></tr>
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
                        <ListBadge>
                          {isNotice ? '공지' : '일반'}
                        </ListBadge>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            className="bg-transparent border-0 p-0 text-slate-100 hover:text-blue-400 cursor-pointer"
                  onClick={() => loadDetail(post)}
                            disabled={isLoading}
                          >
                            {post.title}
                          </button>
                        </div>
                      </td>
                      <td className="p-3 text-slate-400">{formatAuthor(post)}</td>
                      <td className="p-3 font-mono text-slate-500">{formatDateTime(post.createdAt)}</td>
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
        <Modal
          title="게시글 상세 조회"
          onClose={() => setIsDetailOpen(false)}
          footer={<button type="button" onClick={() => setIsDetailOpen(false)} className="cursor-pointer rounded-lg border-0 bg-slate-800 px-5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700">닫기</button>}
        >
          <div className="space-y-6 text-xs text-slate-300">

              <div className="border-b border-slate-850 pb-3 flex justify-between items-end">
                <div>
                  <h3 className="text-base font-extrabold text-slate-100">{selectedPost.title}</h3>
                  <div className="flex gap-4 text-slate-500 font-mono text-[10px] mt-1.5">
                    <span>작성자: {formatAuthor(selectedPost)}</span>
                    <span>작성일시: {formatDateTime(selectedPost.createdAt)}</span>
                  </div>
                </div>

                <div className="flex gap-1.5">
                  {isOwnPost(selectedPost) && <button
                    onClick={() => handleOpenEdit(selectedPost)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-1.5 rounded-lg text-[10px] font-semibold cursor-pointer"
                  >
                    수정
                  </button>}
                  {isOwnPost(selectedPost) && <button
                    onClick={() => handleDeletePost(selectedPost)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-1.5 rounded-lg text-[10px] font-semibold cursor-pointer"
                  >
                    삭제
                  </button>}
                </div>
              </div>

              {/* Main Content body */}
              <RichTextViewer
                content={selectedPost.content}
                className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl text-slate-300 font-sans text-xs min-h-[120px] leading-relaxed"
              />

              {/* 첨부파일 (읽기 전용) */}
              <FileUpload groupNo={selectedPost.fileGroupId} refModule={APP_MODULE.BRD} readOnly />

              {/* Comment Section (Single layer) */}
              <div className="space-y-4">
                <span className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                  <MessageSquare size={14} className="text-blue-500" />
                  댓글 피드백 ({comments.length}개)
                </span>

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
                    comments.map((comment) => (
                      <div key={`${comment.boardId}-${comment.commentNo}`} className="bg-slate-950/20 border border-slate-850 p-3 rounded-lg flex justify-between items-start gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <strong className="text-slate-300 font-semibold">{comment.authorName}</strong>
                            <span className="text-slate-650 font-mono text-[9px]">{formatDateTime(comment.createdAt)}</span>
                          </div>
                          <p className="text-slate-400 font-sans">{comment.content}</p>
                        </div>
                        {isOwnComment(comment.authorId) && <button
                          onClick={() => handleDeleteComment(comment)}
                          className="text-slate-600 hover:text-rose-400 bg-transparent border-0 cursor-pointer"
                        >
                          <Trash size={12} />
                        </button>}
                      </div>
                    ))
                  )}
                </div>
              </div>


          </div>
        </Modal>
      )}

      {/* EDIT / CREATE FORM MODAL */}
      {isFormOpen && (
        <BoardFormModal
          formId={formId}
          formTitle={formTitle}
          setFormTitle={setFormTitle}
          formContent={formContent}
          setFormContent={setFormContent}
          formNoticeYn={formNoticeYn}
          setFormNoticeYn={setFormNoticeYn}
          formBoardType={formBoardType}
          formFileGroupId={formFileGroupId}
          setFormFileGroupId={setFormFileGroupId}
          setFileUploading={setFileUploading}
          fileUploading={fileUploading}
          isLoading={isLoading}
          onClose={() => setIsFormOpen(false)}
          onSave={handleSavePost}
        />
      )}

    </div>
  );
}
