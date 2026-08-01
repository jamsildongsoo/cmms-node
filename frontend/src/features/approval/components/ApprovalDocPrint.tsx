import RichTextViewer from '../../../components/RichTextViewer';
import PrintHeader from '../../../components/PrintHeader';
import { formatDateCompact, formatDateTime } from '../../../utils/datetime';
import { isRichTextEmpty, type RichTextDocument } from '../../../types/richText';
import ApprovalSignatureBox, { type ApprovalSignatureStep } from './ApprovalSignatureBox';
import {
  APPROVAL_RESULT,
  getApprovalStepTypeLabel,
} from '../../../constants/approval';
import type { FileItem } from '../../files/file.types';

export type ApprovalDocumentStep = ApprovalSignatureStep;

interface ApprovalDocPrintProps {
  mode: 'detail' | 'print';
  id: string;
  title: string;
  content?: RichTextDocument | null;
  createdAt: string;
  drafterName: string;
  drafterDepartment: string;
  steps: ApprovalDocumentStep[];
  attachments: FileItem[];
  onDownloadAttachment?: (attachment: FileItem) => void;
}

const formatSize = (bytes: number) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(1)} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export default function ApprovalDocPrint(props: ApprovalDocPrintProps) {
  return (
    <article className="approval-document print-area print-portrait bg-white text-black border border-gray-500 p-5 print:border-0 print:p-0 [-webkit-print-color-adjust:exact] [print-color-adjust:exact] [&_.rich-text-content]:text-black">
      <PrintHeader approvalNo={props.id} />
      <h1 className="text-center text-xl font-bold tracking-[0.35em] mb-5">결 재 품 의 서</h1>

      <section className="grid grid-cols-2 border-y-2 border-black mb-5">
        <dl className="border-r border-gray-500 p-3 text-[10px] space-y-2">
          <div className="grid grid-cols-[64px_1fr] gap-2"><dt className="font-semibold">문서번호</dt><dd className="font-mono">{props.id}</dd></div>
          <div className="grid grid-cols-[64px_1fr] gap-2"><dt className="font-semibold">작성일자</dt><dd className="font-mono">{formatDateCompact(props.createdAt)}</dd></div>
          <div className="grid grid-cols-[64px_1fr] gap-2"><dt className="font-semibold">기안부서</dt><dd>{props.drafterDepartment || '-'}</dd></div>
          <div className="grid grid-cols-[64px_1fr] gap-2"><dt className="font-semibold">기안자</dt><dd>{props.drafterName || '-'}</dd></div>
        </dl>

        <div className="p-3">
          <ApprovalSignatureBox steps={props.steps} drafterDate={props.createdAt} />
        </div>
      </section>

      <section className="mb-4">
        <h2 className="border-b border-black pb-1 mb-2 text-[11px] font-bold">제목</h2>
        <div className="min-h-8 px-2 py-1 text-sm font-semibold">{props.title}</div>
      </section>

      <section className="mb-4">
        <h2 className="border-b border-black pb-1 mb-2 text-[11px] font-bold">본문</h2>
        {props.content && !isRichTextEmpty(props.content) ? (
          <RichTextViewer
            content={props.content}
            className="approval-print-content min-h-[180px] px-2 py-1 text-sm"
            preservePrintFormatting
          />
        ) : (
          <div className="min-h-[180px] px-2 py-1 text-[10px] text-gray-500">(본문 없음)</div>
        )}
      </section>

      <section className="mb-4">
        <h2 className="border-b border-black pb-1 mb-2 text-[11px] font-bold">첨부</h2>
        {props.attachments.length === 0 ? (
          <div className="px-2 py-1 text-[10px] text-gray-500">첨부 파일 없음</div>
        ) : (
          <ol className="list-decimal pl-7 text-[10px] space-y-1">
            {props.attachments.map((attachment) => (
              <li key={attachment.itemNo}>
                {props.mode === 'detail' && props.onDownloadAttachment ? (
                  <button
                    type="button"
                    onClick={() => props.onDownloadAttachment?.(attachment)}
                    className="bg-transparent border-0 p-0 text-black underline cursor-pointer"
                  >
                    {attachment.originalFileName}
                  </button>
                ) : attachment.originalFileName}
                <span className="ml-1 text-gray-500">({formatSize(attachment.fileSize)})</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {props.mode === 'detail' && (
        <section className="mt-6">
          <h2 className="border-b border-black pb-1 mb-2 text-[11px] font-bold">결재 의견</h2>
          <table className="w-full border-collapse text-[10px]">
            <thead>
              <tr>
                <th className="border border-gray-400 bg-white p-1.5 text-left">구분</th>
                <th className="border border-gray-400 bg-white p-1.5 text-left">처리자</th>
                <th className="border border-gray-400 bg-white p-1.5 text-left">결과</th>
                <th className="border border-gray-400 bg-white p-1.5 text-left">처리일시</th>
                <th className="border border-gray-400 bg-white p-1.5 text-left">의견</th>
              </tr>
            </thead>
            <tbody>
              {props.steps.map((step) => (
                <tr key={step.stepNo}>
                  <td className="border border-gray-300 p-1.5">{getApprovalStepTypeLabel(step.approvalType)}</td>
                  <td className="border border-gray-300 p-1.5">{step.approverName}</td>
                  <td className="border border-gray-300 p-1.5">
                    {step.approvalResult === APPROVAL_RESULT.APPROVED
                      ? '승인'
                      : step.approvalResult === APPROVAL_RESULT.REJECTED
                        ? '반려'
                        : '대기'}
                  </td>
                  <td className="border border-gray-300 p-1.5 font-mono">{step.actionAt ? formatDateTime(step.actionAt) : '-'}</td>
                  <td className="border border-gray-300 p-1.5">{step.comments || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </article>
  );
}
