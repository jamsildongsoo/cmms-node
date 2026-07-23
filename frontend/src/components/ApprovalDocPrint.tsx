import RichTextViewer from './RichTextViewer';
import { formatDateTime } from '../utils/datetime';
import { isRichTextEmpty, type RichTextDocument } from '../types/richText';

export interface ApprovalDocumentStep {
  stepNo: number;
  approverName: string;
  approverTitle: string | null;
  approvalType: string;
  approvalResult: string | null;
  comments?: string | null;
  actionAt?: string | null;
}

export interface ApprovalDocumentAttachment {
  itemNo: number;
  originalFileName: string;
  fileSize: number;
}

interface ApprovalDocPrintProps {
  mode: 'detail' | 'print';
  id: string;
  status: string;
  title: string;
  content?: RichTextDocument | null;
  createdAt: string;
  drafterName: string;
  drafterDepartment: string;
  steps: ApprovalDocumentStep[];
  attachments: ApprovalDocumentAttachment[];
  onDownloadAttachment?: (attachment: ApprovalDocumentAttachment) => void;
}

const formatDateOnly = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
};

const formatSize = (bytes: number) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(1)} KB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function SignatureGrid({
  label,
  steps,
  drafterDate,
}: {
  label: string;
  steps: ApprovalDocumentStep[];
  drafterDate?: string;
}) {
  const slots = Array.from({ length: 4 }, (_, index) => steps[index] ?? null);

  return (
    <div className="grid w-full grid-cols-[42px_1fr] border border-gray-500 border-b-0 last:border-b">
      <div className="flex items-center justify-center border-r border-gray-500 bg-white text-[10px] font-bold text-black">
        {label}
      </div>
      <div className="grid grid-cols-4">
        {slots.map((step, index) => (
          <div key={step?.stepNo ?? `${label}-${index}`} className="min-w-0 border-r border-gray-400 last:border-r-0 text-center text-black">
            <div className="min-h-6 border-b border-gray-300 bg-white px-1 py-1 text-[9px] font-semibold">
              {step?.approverTitle || (step?.approvalType === 'D' ? '기안자' : '')}
            </div>
            <div className="min-h-8 border-b border-gray-300 px-1 py-2 text-[10px] font-bold">
              {step?.approverName || ''}
            </div>
            <div className="min-h-6 px-1 py-1 text-[9px] font-mono">
              {step ? formatDateOnly(step.approvalType === 'D' ? (step.actionAt || drafterDate) : step.actionAt) : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ApprovalDocPrint(props: ApprovalDocPrintProps) {
  const approvals = props.steps.filter((step) => step.approvalType === 'D' || step.approvalType === 'A').slice(0, 4);
  const agreements = props.steps.filter((step) => step.approvalType === 'G').slice(0, 4);
  const references = props.steps.filter((step) => step.approvalType === 'R');

  return (
    <article className="approval-document bg-white text-black border border-gray-500 p-5">
      <style>{`
        .approval-document {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .approval-document .rich-text-content {
          color: #000;
        }
      `}</style>
      <h1 className="text-center text-xl font-bold tracking-[0.35em] mb-5">결 재 품 의 서</h1>

      <section className="grid grid-cols-2 border-y-2 border-black mb-5">
        <dl className="border-r border-gray-500 p-3 text-[10px] space-y-2">
          <div className="grid grid-cols-[64px_1fr] gap-2"><dt className="font-semibold">문서번호</dt><dd className="font-mono">{props.id}</dd></div>
          <div className="grid grid-cols-[64px_1fr] gap-2"><dt className="font-semibold">작성일자</dt><dd className="font-mono">{formatDateOnly(props.createdAt)}</dd></div>
          <div className="grid grid-cols-[64px_1fr] gap-2"><dt className="font-semibold">기안부서</dt><dd>{props.drafterDepartment || '-'}</dd></div>
          <div className="grid grid-cols-[64px_1fr] gap-2"><dt className="font-semibold">기안자</dt><dd>{props.drafterName || '-'}</dd></div>
        </dl>

        <div className="p-3">
          <SignatureGrid label="결재" steps={approvals} drafterDate={props.createdAt} />
          <SignatureGrid label="합의" steps={agreements} />
          <div className="grid grid-cols-[42px_1fr] border border-gray-500 text-[10px]">
            <div className="flex items-center justify-center border-r border-gray-500 bg-white font-bold">참조</div>
            <div className="min-h-8 px-2 py-1.5 leading-relaxed">
              {references.length > 0
                ? references.map((step) => `${step.approverTitle ? `${step.approverTitle} / ` : ''}${step.approverName}`).join(', ')
                : '-'}
            </div>
          </div>
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
                  <td className="border border-gray-300 p-1.5">{step.approvalType === 'D' ? '기안' : step.approvalType === 'G' ? '합의' : step.approvalType === 'R' ? '참조' : '결재'}</td>
                  <td className="border border-gray-300 p-1.5">{step.approverName}</td>
                  <td className="border border-gray-300 p-1.5">{step.approvalResult === 'Y' ? '승인' : step.approvalResult === 'N' ? '반려' : '대기'}</td>
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
