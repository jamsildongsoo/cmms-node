import PrintHeader from './PrintHeader';
import { PrintSection, PrintField, PrintTable } from './PrintDoc';
import { getCommonStatusLabel } from '../constants/status';
import { formatDateTime } from '../utils/datetime';

interface WpCheckItem {
  question: string;
  checked: boolean;
  remarks: string;
}
interface WpChecksheet {
  id: string;
  name: string;
  state: WpCheckItem[];
}

interface WorkPermitPrintProps {
  wpNo: string;
  title: string;
  status: string;
  approvalId?: string | null;
  createdAt?: string | null;
  authorName: string;
  deptName: string;
  supervisorName: string;
  startAt: string;
  endAt: string;
  equipmentName: string;
  equipmentId: string;
  workOrderId: string;
  permitTypeLabel: string;
  workSummary?: string;
  riskFactors?: string;
  safetyMeasures?: string;
  remarks?: string;
  checksheets: WpChecksheet[];
  selectedTypes: string[];
}

/** 작업허가서 — 전용 인쇄뷰(흑백). LOTO 체크시트는 선택된 유형만 페이지 분할로 표기. */
export default function WorkPermitPrint(p: WorkPermitPrintProps) {
  const fmt = (s: string) => formatDateTime(s);
  const activeSheets = p.checksheets.filter((c) => p.selectedTypes.includes(c.id));

  return (
    <article className="print-area print-portrait bg-white text-black border border-gray-500 p-5 print:border-0 print:p-0">
      <PrintHeader approvalNo={p.approvalId} />
      <h1 className="text-center text-lg font-bold tracking-widest mb-4">안 전 작 업 허 가 서</h1>

      <section className="border-y-2 border-black mb-5 text-[10px]">
        <dl className="p-3 space-y-2">
          <div className="grid grid-cols-[64px_1fr] gap-2"><dt className="font-semibold">문서번호</dt><dd className="font-mono">{p.wpNo}</dd></div>
          <div className="grid grid-cols-[64px_1fr] gap-2"><dt className="font-semibold">작성일자</dt><dd className="font-mono">{p.createdAt || '-'}</dd></div>
          <div className="grid grid-cols-[64px_1fr] gap-2"><dt className="font-semibold">부서명</dt><dd>{p.deptName || '-'}</dd></div>
          <div className="grid grid-cols-[64px_1fr] gap-2"><dt className="font-semibold">작성자</dt><dd>{p.authorName || '-'}</dd></div>
        </dl>
      </section>

      <PrintSection title="문서 정보">
        <div className="divide-y divide-gray-300 border-y border-gray-400">
          <div className="grid grid-cols-2 gap-4 py-2">
            <PrintField label="제목" value={p.title} />
            <PrintField label="상태" value={getCommonStatusLabel(p.status)} />
          </div>
          <div className="grid grid-cols-2 gap-4 py-2">
            <PrintField label="대상설비 번호/이름" value={`${p.equipmentId} / ${p.equipmentName}`} />
            <PrintField label="허가유형" value={p.permitTypeLabel} />
          </div>
          <div className="grid grid-cols-3 gap-4 py-2">
            <PrintField label="작업 시작" value={fmt(p.startAt)} />
            <PrintField label="작업 종료" value={fmt(p.endAt)} />
            <PrintField label="감독자" value={p.supervisorName} />
          </div>
        </div>
        <div className="mt-2 space-y-1">
          <PrintField label="연계 작업지시" value={p.workOrderId} />
          <PrintField label="작업개요" value={p.workSummary} />
          <PrintField label="위험요인" value={p.riskFactors} />
          <PrintField label="안전대책" value={p.safetyMeasures} />
        </div>
      </PrintSection>

      {/* LOTO 체크시트 — 선택 유형만, 시트별 페이지 분할 */}
      {activeSheets.map((sheet) => (
        <div key={sheet.id} className="print:break-before-page">
          <PrintSection title={sheet.name}>
            <PrintTable
              columns={['점검 항목', '확인', '비고']}
              rows={sheet.state.map((it) => [it.question, it.checked ? 'O' : '-', it.remarks || '-'])}
            />
          </PrintSection>
        </div>
      ))}

      {p.remarks && (
        <PrintSection title="비고">
          <div className="text-[10px] whitespace-pre-wrap">{p.remarks}</div>
        </PrintSection>
      )}
    </article>
  );
}
