import PrintHeader from './PrintHeader';
import { PrintSection, PrintField, PrintTable } from './PrintDoc';
import ApprovalSignatureBox, { type ApprovalSignatureStep } from '../features/approval/components/ApprovalSignatureBox';

interface PrItem {
  inventoryId: string;
  qty: number | string;
  unit?: string | null;
  remarks?: string | null;
}

interface ProcurementRequestPrintProps {
  id: string;
  requestDate: string;
  requesterId: string;
  requestType?: string | null;
  plantId: string;
  warehouseId: string;
  title?: string | null;
  remarks?: string | null;
  departmentName?: string | null;
  authorName?: string | null;
  approvalId?: string | null;
  approvalSteps?: ApprovalSignatureStep[];
  items: PrItem[];
}

/** 구매요청서 — 전용 인쇄뷰(흑백), 공통 전자결재란 포함. */
export default function ProcurementRequestPrint(p: ProcurementRequestPrintProps) {
  return (
    <article className="print-area print-portrait bg-white text-black border border-gray-500 p-5 print:border-0 print:p-0">
      <PrintHeader approvalNo={p.approvalId} />
      <h1 className="text-center text-lg font-bold tracking-widest mb-4">구 매 요 청 서</h1>

      <section className="grid grid-cols-2 border-y-2 border-black mb-5 text-[10px]">
        <dl className="border-r border-gray-500 p-3 space-y-2">
          <div className="grid grid-cols-[64px_1fr] gap-2"><dt className="font-semibold">문서번호</dt><dd className="font-mono">{p.id}</dd></div>
          <div className="grid grid-cols-[64px_1fr] gap-2"><dt className="font-semibold">작성일자</dt><dd className="font-mono">{p.requestDate || '-'}</dd></div>
          <div className="grid grid-cols-[64px_1fr] gap-2"><dt className="font-semibold">부서명</dt><dd>{p.departmentName || '-'}</dd></div>
          <div className="grid grid-cols-[64px_1fr] gap-2"><dt className="font-semibold">작성자</dt><dd>{p.authorName || p.requesterId || '-'}</dd></div>
        </dl>
        <div className="p-3">
          <ApprovalSignatureBox steps={p.approvalSteps || []} drafterDate={p.requestDate} />
        </div>
      </section>

      <PrintSection title="문서 정보">
        <div className="divide-y divide-gray-300 border-y border-gray-400">
          <div className="grid grid-cols-2 gap-4 py-2">
            <PrintField label="제목" value={p.title} />
            <PrintField label="유형" value={p.requestType} />
          </div>
          <div className="grid grid-cols-2 gap-4 py-2">
            <PrintField label="플랜트" value={p.plantId} />
            <PrintField label="예정 창고" value={p.warehouseId} />
          </div>
          <div className="py-2">
            <PrintField label="비고" value={p.remarks} />
          </div>
        </div>
      </PrintSection>

      <PrintSection title="요청 품목">
        <PrintTable
          columns={['No', '자재', '수량', '단위']}
          rows={p.items.map((it, i) => [i + 1, it.inventoryId, it.qty, it.unit || '-'])}
        />
      </PrintSection>
    </article>
  );
}
