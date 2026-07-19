import { useState, useEffect, useRef } from 'react';
import axiosInstance from '../api/axios';
import { Paperclip, UploadCloud, Trash2, Download, Loader2 } from 'lucide-react';

interface FileItem {
  itemNo: number;
  originalFileName: string;
  fileExtension: string | null;
  mimeType: string | null;
  fileSize: number;
}

interface Props {
  /** 첨부 그룹 번호. 신규(미업로드)면 null. */
  groupNo: number | null;
  /** 업로드 시 서버에 전달할 AppModule 코드(예: BRD, APR) */
  refModule: string;
  /** 첫 업로드로 그룹이 생성되면 상위 폼에 groupNo를 전달한다. */
  onGroupNoChange?: (groupNo: number) => void;
  /** 업로드 진행 상태를 상위 폼에 전달한다(업로드 중 저장 클릭 방지용). */
  onUploadingChange?: (uploading: boolean) => void;
  /** 읽기 전용(상세 조회): 업로드/삭제 없이 목록·다운로드만. */
  readOnly?: boolean;
  /** 에러 메시지를 상위 컴포넌트에 전달(toast 등). */
  onError?: (message: string) => void;
}

export default function FileUpload({ groupNo, refModule, onGroupNoChange, onUploadingChange, readOnly = false, onError }: Props) {
  const [items, setItems] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadItems = async (gno: number) => {
    try {
      const res = await axiosInstance.get(`/files/${gno}`);
      setItems(res.data);
    } catch {
      setItems([]);
    }
  };

  useEffect(() => {
    if (groupNo) loadItems(groupNo);
    else setItems([]);
  }, [groupNo]);

  useEffect(() => {
    onUploadingChange?.(uploading);
  }, [uploading]);

  const handleFiles = async (files: FileList | null) => {
    if (readOnly || !files || files.length === 0) return;
    const form = new FormData();
    Array.from(files).forEach((f) => form.append('files', f));
    if (groupNo) form.append('groupNo', String(groupNo));

    setUploading(true);
    setProgress(0);
    try {
      const params = new URLSearchParams();
      params.set('refModule', refModule);
      if (groupNo) params.set('groupNo', String(groupNo));

      const res = await axiosInstance.post(`/files?${params.toString()}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded * 100) / e.total));
        },
      });
      const newGroupNo: number = res.data.groupNo;
      if (!groupNo && onGroupNoChange) onGroupNoChange(newGroupNo);
      await loadItems(newGroupNo);
    } catch (err: any) {
      const msg = err.response?.data?.message || '파일 업로드에 실패했습니다.';
      onError?.(msg);
    } finally {
      setUploading(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDownload = async (item: FileItem) => {
    if (!groupNo) return;
    try {
      const res = await axiosInstance.get(`/files/${groupNo}/${item.itemNo}/download`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = item.originalFileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      onError?.('다운로드에 실패했습니다.');
    }
  };

  const handleDelete = async (item: FileItem) => {
    if (!groupNo) return;
    if (!confirm(`'${item.originalFileName}' 첨부를 삭제하시겠습니까?`)) return;
    try {
      await axiosInstance.delete(`/files/${groupNo}/${item.itemNo}`);
      loadItems(groupNo);
    } catch {
      onError?.('삭제에 실패했습니다.');
    }
  };

  const fmtSize = (n: number) =>
    n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

  return (
    <div className="space-y-2">
      {!readOnly && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-1 border-2 border-dashed rounded-lg py-4 cursor-pointer transition-colors text-xs ${
            dragOver
              ? 'border-blue-500 bg-blue-950/30 text-blue-300'
              : 'border-slate-700 bg-slate-950/40 text-slate-400 hover:border-slate-600'
          }`}
        >
          {uploading ? (
            <>
              <Loader2 size={18} className="animate-spin text-blue-400" />
              <span>업로드 중… {progress}%</span>
            </>
          ) : (
            <>
              <UploadCloud size={18} />
              <span>파일을 끌어다 놓거나 클릭하여 선택 (다중 가능)</span>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      )}

      {items.length === 0 ? (
        readOnly && (
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <Paperclip size={12} /> 첨부 파일 없음
          </p>
        )
      ) : (
        <ul className="space-y-1">
          {items.map((item) => (
            <li
              key={item.itemNo}
              className="flex items-center justify-between gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs"
            >
              <button
                type="button"
                onClick={() => handleDownload(item)}
                className="flex items-center gap-2 text-slate-200 hover:text-blue-400 transition-colors min-w-0 cursor-pointer bg-transparent border-0 p-0"
                title="다운로드"
              >
                <Paperclip size={12} className="shrink-0 text-slate-500" />
                <span className="truncate">{item.originalFileName}</span>
                <span className="text-slate-500 shrink-0">({fmtSize(item.fileSize)})</span>
              </button>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownload(item)}
                  className="text-slate-400 hover:text-blue-400 p-1 cursor-pointer bg-transparent border-0"
                  title="다운로드"
                >
                  <Download size={14} />
                </button>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    className="text-slate-400 hover:text-rose-400 p-1 cursor-pointer bg-transparent border-0"
                    title="삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
