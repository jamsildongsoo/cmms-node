export interface ApprovalSignatureStep {
  stepNo: number;
  approverName: string;
  approverTitle: string | null;
  approvalType: string;
  approvalResult: string | null;
  comments?: string | null;
  actionAt?: string | null;
}

const formatDateOnly = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
};

const getResultSuffix = (result?: string | null) => {
  if (result === 'Y') return '/결재';
  if (result === 'N') return '/반려';
  return '';
};

function SignatureGrid({
  label,
  steps,
  drafterDate,
}: {
  label: string;
  steps: ApprovalSignatureStep[];
  drafterDate?: string | null;
}) {
  const slots = Array.from({ length: 4 }, (_, index) => steps[index] ?? null);

  return (
    <div className="grid w-full grid-cols-[42px_1fr] border border-gray-500 border-b-0 last:border-b">
      <div className="flex items-center justify-center border-r border-gray-500 bg-white text-[10px] font-bold text-black">
        {label}
      </div>
      <div className="grid grid-cols-4">
        {slots.map((step, index) => (
          <div key={step?.stepNo ?? `${label}-${index}`} className="min-w-0 border-r border-gray-400 text-center text-black last:border-r-0">
            <div className="min-h-6 border-b border-gray-300 bg-white px-1 py-1 text-[9px] font-semibold">
              {step?.approverTitle || (step?.approvalType === 'D' ? '기안자' : '')}
            </div>
            <div className="min-h-8 border-b border-gray-300 px-1 py-2 text-[10px] font-bold">
              {step ? `${step.approverName}${getResultSuffix(step.approvalResult)}` : ''}
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

interface ApprovalSignatureBoxProps {
  steps: ApprovalSignatureStep[];
  drafterDate?: string | null;
}

export default function ApprovalSignatureBox({ steps, drafterDate }: ApprovalSignatureBoxProps) {
  const approvals = steps.filter((step) => step.approvalType === 'D' || step.approvalType === 'A').slice(0, 4);
  const agreements = steps.filter((step) => step.approvalType === 'G').slice(0, 4);
  const references = steps.filter((step) => step.approvalType === 'R');

  return (
    <div>
      <SignatureGrid label="결재" steps={approvals} drafterDate={drafterDate} />
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
  );
}
