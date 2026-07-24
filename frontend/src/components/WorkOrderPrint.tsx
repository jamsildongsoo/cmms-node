import PrintHeader from './PrintHeader';
import { PrintSection, PrintField, PrintTable } from './PrintDoc';
import { getCommonStatusLabel } from '../constants/status';

interface WoItem {
  itemNo: number;
  workName: string;
  workMethod?: string | null;
  workResult?: string | null;
}

interface WorkOrderPrintProps {
  woNo: string;
  title: string;
  status: string;
  approvalId?: string | null;
  createdAt?: string | null;
  authorName: string;
  deptName: string;
  workDate: string;
  equipmentName: string;
  equipmentId: string;
  woTypeCode: string;
  cost: number | string;
  manHours: number | string;
  manHoursUnit: string;
  remarks?: string;
  workItems: WoItem[];
}

/** 작업지시서 — 전용 문서뷰(흑백). */
export default function WorkOrderPrint(p: WorkOrderPrintProps) {
  return (
    <article className="print-area print-portrait bg-white text-black border border-gray-500 p-5 print:border-0 print:p-0">
      <PrintHeader approvalNo={p.approvalId} />
      <h1 className="text-center text-lg font-bold tracking-widest mb-4">작 업 지 시 서</h1>

      <section className="border-y-2 border-black mb-5 text-[10px]">
        <dl className="p-3 space-y-2">
          <div className="grid grid-cols-[64px_1fr] gap-2"><dt className="font-semibold">문서번호</dt><dd className="font-mono">{p.woNo}</dd></div>
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
            <PrintField label="작업유형" value={p.woTypeCode} />
          </div>
          <div className="grid grid-cols-3 gap-4 py-2">
            <PrintField label="작업일" value={p.workDate} />
            <PrintField label="비용" value={p.cost} />
            <PrintField label="공수" value={`${p.manHours} ${p.manHoursUnit}`} />
          </div>
        </div>
      </PrintSection>

      <PrintSection title="작업 항목">
        <PrintTable
          columns={['번호', '작업/점검 내용', '작업방법', '작업결과']}
          rows={p.workItems.map((it) => [it.itemNo, it.workName, it.workMethod || '-', it.workResult || '-'])}
        />
      </PrintSection>

      {p.remarks && (
        <PrintSection title="비고">
          <div className="text-[10px] whitespace-pre-wrap">{p.remarks}</div>
        </PrintSection>
      )}
    </article>
  );
}
