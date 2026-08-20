import type { Dispatch, SetStateAction } from 'react';
import Modal from '../../../components/Modal';
import RichTextEditor from '../../../components/RichTextEditor';
import { APP_MODULE } from '../../../constants/module';
import type { RichTextDocument } from '../../../types/richText';
import FileUpload from '../../files/components/FileUpload';
import type { YesNo } from '../board.types';

interface BoardFormModalProps {
  formId: number | null;
  formTitle: string;
  setFormTitle: Dispatch<SetStateAction<string>>;
  formContent: RichTextDocument;
  setFormContent: Dispatch<SetStateAction<RichTextDocument>>;
  formNoticeYn: YesNo;
  setFormNoticeYn: Dispatch<SetStateAction<YesNo>>;
  formBoardType: string;
  formFileGroupId: number | null;
  setFormFileGroupId: Dispatch<SetStateAction<number | null>>;
  setFileUploading: Dispatch<SetStateAction<boolean>>;
  fileUploading: boolean;
  isLoading: boolean;
  onClose: () => void;
  onSave: () => void | Promise<void>;
}

export default function BoardFormModal({
  formId,
  formTitle,
  setFormTitle,
  formContent,
  setFormContent,
  formNoticeYn,
  setFormNoticeYn,
  formBoardType,
  formFileGroupId,
  setFormFileGroupId,
  setFileUploading,
  fileUploading,
  isLoading,
  onClose,
  onSave,
}: BoardFormModalProps) {
  return (
    <Modal
      title={formId ? '게시글 수정' : '새 게시글 작성'}
      onClose={onClose}
      footer={(
        <>
          <button type="button" onClick={onClose} className="cursor-pointer rounded-lg border-0 bg-slate-800 px-4 py-2 text-slate-300 hover:bg-slate-700">취소</button>
          <button type="button" onClick={() => void onSave()} disabled={isLoading || fileUploading} className="cursor-pointer rounded-lg border-0 bg-blue-600 px-4 py-2 text-white hover:bg-blue-500 disabled:opacity-50">{fileUploading ? '업로드 중…' : '저장'}</button>
        </>
      )}
    >
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div className="col-span-2">
          <label htmlFor="board-title" className="mb-1.5 block text-slate-500">글 제목 *</label>
          <div className="flex items-center gap-4">
            <input id="board-title" required placeholder="제목을 입력하세요." value={formTitle} onChange={(event) => setFormTitle(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-slate-200 outline-none focus:border-blue-500" />
            <label className="flex shrink-0 cursor-pointer select-none items-center gap-2 text-slate-400"><input type="checkbox" checked={formNoticeYn === 'Y'} onChange={(event) => setFormNoticeYn(event.target.checked ? 'Y' : 'N')} className="h-4 w-4 cursor-pointer accent-blue-600" />공지</label>
          </div>
          <input type="hidden" name="boardTypeCode" value={formBoardType} />
        </div>
        <div className="col-span-2">
          <label className="mb-1.5 block text-slate-500">상세 내용 *</label>
          <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950"><RichTextEditor key={formId || 'new'} content={formContent} onChange={setFormContent} placeholder="본문 내용을 입력하세요." minHeight="180px" /></div>
        </div>
        <div className="col-span-2">
          <label className="mb-1.5 block text-slate-500">첨부파일</label>
          <FileUpload groupNo={formFileGroupId} refModule={APP_MODULE.BRD} onGroupNoChange={setFormFileGroupId} onUploadingChange={setFileUploading} />
        </div>
      </div>
    </Modal>
  );
}
