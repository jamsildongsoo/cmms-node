import { useState, useEffect, useRef } from 'react';
import { requestConfirmation } from '../utils/userActionDialog';
import axiosInstance from '../api/axios';
import { Paperclip, UploadCloud, Trash2, Download, Loader2 } from 'lucide-react';
import type { AxiosError } from 'axios';

interface FileItem {
  itemNo: number;
  originalFileName: string;
  fileExtension: string | null;
  mimeType: string | null;
  fileSize: number;
}

interface FileUploadPolicy {
  maxFileSizeBytes: number;
  maxFileCount: number;
  allowedMimeTypes: string[];
}

// 여러 화면에서 FileUpload를 사용해도 정책 API는 한 번만 호출한다.
// 실패 시 캐시를 비워 다음 마운트에서 다시 조회할 수 있게 한다.
let policyRequest: Promise<FileUploadPolicy> | null = null;

const loadUploadPolicy = (): Promise<FileUploadPolicy> => {
  if (!policyRequest) {
    policyRequest = axiosInstance
      .get<FileUploadPolicy>('/files/policy')
      .then((response) => response.data)
      .catch((error) => {
        policyRequest = null;
        throw error;
      });
  }
  return policyRequest;
};

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
  const [policy, setPolicy] = useState<FileUploadPolicy | null>(null);
  const [policyLoading, setPolicyLoading] = useState(!readOnly);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reportError = (message: string) => {
    setLocalError(message);
    onError?.(message);
  };

  const loadItems = async (gno: number) => {
    try {
      const res = await axiosInstance.get(`/files/${gno}`);
      setItems(res.data);
    } catch {
      setItems([]);
    }
  };

  useEffect(() => {
    let active = true;
    const request = groupNo
      ? axiosInstance.get<FileItem[]>(`/files/${groupNo}`).then((response) => response.data)
      : Promise.resolve([]);

    request
      .then((loadedItems) => {
        if (active) setItems(loadedItems);
      })
      .catch(() => {
        if (active) setItems([]);
      });

    return () => {
      active = false;
    };
  }, [groupNo]);

  useEffect(() => {
    if (readOnly) return;

    let active = true;
    loadUploadPolicy()
      .then((loadedPolicy) => {
        if (active) setPolicy(loadedPolicy);
      })
      .catch(() => {
        // 정책 조회 실패가 업로드 자체를 막지는 않는다.
        // 최종 크기·개수·MIME 검사는 항상 백엔드가 수행한다.
      })
      .finally(() => {
        if (active) setPolicyLoading(false);
      });

    return () => {
      active = false;
    };
  }, [readOnly]);

  useEffect(() => {
    onUploadingChange?.(uploading);
  }, [onUploadingChange, uploading]);

  const handleFiles = async (files: FileList | null) => {
    if (readOnly || uploading || !files || files.length === 0) return;
    if (policyLoading) {
      reportError('첨부파일 정책을 확인 중입니다. 잠시 후 다시 시도해 주세요.');
      return;
    }

    const selectedFiles = Array.from(files);
    if (policy) {
      if (selectedFiles.length > policy.maxFileCount) {
        reportError(`파일은 한 번에 최대 ${policy.maxFileCount}개까지 선택할 수 있습니다.`);
        return;
      }

      const oversizedFile = selectedFiles.find((file) => file.size > policy.maxFileSizeBytes);
      if (oversizedFile) {
        reportError(
          `'${oversizedFile.name}' 파일은 최대 크기(${fmtSize(policy.maxFileSizeBytes)})를 초과합니다.`,
        );
        return;
      }

      const disallowedFile = selectedFiles.find(
        (file) => file.type && !isMimeAllowed(file.type, policy.allowedMimeTypes),
      );
      if (disallowedFile) {
        reportError(`'${disallowedFile.name}' 파일 형식은 업로드할 수 없습니다.`);
        return;
      }
    }

    setLocalError(null);
    const form = new FormData();
    selectedFiles.forEach((f) => form.append('files', f));
    if (groupNo) form.append('groupNo', String(groupNo));

    setUploading(true);
    setProgress(0);
    try {
      const params = new URLSearchParams();
      params.set('refModule', refModule);
      if (groupNo) params.set('groupNo', String(groupNo));

      const res = await axiosInstance.post(`/files?${params.toString()}`, form, {
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded * 100) / e.total));
        },
      });
      const newGroupNo = Number(res.data.groupNo);
      if (!Number.isSafeInteger(newGroupNo) || newGroupNo <= 0) {
        throw new Error('서버가 유효한 첨부 그룹 번호를 반환하지 않았습니다.');
      }
      if (!groupNo && onGroupNoChange) onGroupNoChange(newGroupNo);
      await loadItems(newGroupNo);
    } catch (err: unknown) {
      // AxiosError로 타입 지정
      const axiosError = err as AxiosError<{ message: string }>;

      const msg = axiosError.response?.data?.message
        || (err instanceof Error ? err.message : '파일 업로드에 실패했습니다.');
      reportError(msg);
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
      reportError('다운로드에 실패했습니다.');
    }
  };

  const handleDelete = async (item: FileItem) => {
    if (!groupNo) return;
    if (!(await requestConfirmation(`'${item.originalFileName}' 첨부를 삭제하시겠습니까?`))) return;
    try {
      await axiosInstance.delete(`/files/${groupNo}/${item.itemNo}`);
      loadItems(groupNo);
    } catch {
      reportError('삭제에 실패했습니다.');
    }
  };

  const fmtSize = (n: number) =>
    n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

  const isMimeAllowed = (mime: string, allowedMimeTypes: string[]) => {
    const normalized = mime.toLowerCase();
    return allowedMimeTypes.some((pattern) => {
      const normalizedPattern = pattern.toLowerCase();
      return normalizedPattern.endsWith('/*')
        ? normalized.startsWith(normalizedPattern.slice(0, -1))
        : normalized === normalizedPattern;
    });
  };

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
          ) : policyLoading ? (
            <>
              <Loader2 size={18} className="animate-spin text-blue-400" />
              <span>첨부파일 정책 확인 중…</span>
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
            accept={policy?.allowedMimeTypes.join(',')}
            disabled={uploading || policyLoading}
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      )}

      {!readOnly && policy && (
        <p className="text-[11px] text-slate-500">
          파일당 최대 {fmtSize(policy.maxFileSizeBytes)} · 한 번에 최대 {policy.maxFileCount}개
        </p>
      )}

      {!readOnly && localError && (
        <p className="text-xs text-rose-400">{localError}</p>
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
