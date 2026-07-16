import PrintHeader from './PrintHeader';
import { PrintSection, PrintField, PrintFieldGrid, PrintTable } from './PrintDoc';
import { getCommonStatusLabel } from '../constants/status';
import { formatDateTime } from '../utils/datetime';

interface ApprovalStep {
  stepNo: number;
  approverName: string;
  approvalType: string; // D 기안 / A 결재 / G 합의 / R 참조
  approvalResult: string | null; // null 대기 / Y 승인 / N 반려
  comments?: string | null;
  actionAt?: string | null;
}

interface ApprovalDocPrintProps {
  id: string;
  status: string;
  title: string;
  content?: string | null;
  steps: ApprovalStep[];
}

const roleLabel = (t: string) => (t === 'D' ? '기안' : t === 'G' ? '합의' : t === 'R' ? '참조' : '결재');
const resultLabel = (r: string | null) => (r === 'Y' ? '승인' : r === 'N' ? '반려' : '대기');
const fmtAt = (s?: string | null) => formatDateTime(s);

/** 결재 품의서 — 전용 인쇄뷰(흑백). 결재선 서명박스 + 처리 이력. 결과는 Y/N/대기. */
export default function ApprovalDocPrint(p: ApprovalDocPrintProps) {
  const signSteps = p.steps.filter((s) => s.approvalType !== 'R'); // 기안/결재/합의
  const refs = p.steps.filter((s) => s.approvalType === 'R');

  return (
    <div className="hidden print:block bg-white text-black">
      <PrintHeader />
      <h1 className="text-center text-lg font-bold tracking-widest mb-4">결 재 품 의 서</h1>

      <PrintSection title="일반 정보">
        <PrintFieldGrid cols={3}>
          <PrintField label="번호" value={p.id} />
          <PrintField label="상태" value={getCommonStatusLabel(p.status)} />
          <PrintField label="제목" value={p.title} />
        </PrintFieldGrid>
      </PrintSection>

      {/* 결재선 서명박스 */}
      <div className="flex justify-end gap-1 mb-4">
        {signSteps.map((s) => (
          <div key={s.stepNo} className="border border-gray-500 w-20 text-center text-[9px]">
            <div className="border-b border-gray-400 bg-gray-100 py-0.5 font-semibold">{roleLabel(s.approvalType)}</div>
            <div className="py-2 font-bold min-h-[28px]">{s.approverName}</div>
            <div className="border-t border-gray-300 py-0.5">{resultLabel(s.approvalResult)}</div>
          </div>
        ))}
      </div>

      {refs.length > 0 && (
        <div className="mb-3">
          <PrintField label="참조자" value={refs.map((r) => r.approverName).join(', ')} />
        </div>
      )}

      <PrintSection title="품의 내용">
        <div className="text-[10px] whitespace-pre-wrap min-h-[120px]">{p.content || '(본문 없음)'}</div>
      </PrintSection>

      <PrintSection title="결재 처리 이력">
        <PrintTable
          columns={['순번', '결재자', '유형', '결과', '의견', '처리시간']}
          rows={p.steps.map((s) => [
            s.stepNo,
            s.approverName,
            roleLabel(s.approvalType),
            resultLabel(s.approvalResult),
            s.comments || '-',
            fmtAt(s.actionAt),
          ])}
        />
      </PrintSection>
    </div>
  );
}
