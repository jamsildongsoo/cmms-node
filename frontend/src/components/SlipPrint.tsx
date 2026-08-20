import PrintHeader from './PrintHeader';
import { PrintSection, PrintTable } from './PrintDoc';
import { formatQuantity } from '../utils/number';

interface SlipPrintItem {
  warehouseName: string;
  inventoryId: string;
  inventoryName: string;
  unit?: string | null;
  qty: number;
}

interface SlipPrintProps {
  txTypeCode: string;
  txReasonCode?: string | null;
  docNo?: string | null;
  refNo?: string | null;
  txDate: string;
  departmentName: string;
  managerName: string;
  items: SlipPrintItem[];
}

/** 재고 입출고·이동·조정 전표 — 업무 문서 공통 A4 세로 출력뷰. */
export default function SlipPrint(p: SlipPrintProps) {
  const title =
    p.txTypeCode === 'IN' ? '입 고 증'
      : p.txTypeCode === 'OUT' ? '출 고 증'
        : p.txTypeCode === 'ADJ' ? '재 고 전 표 (조 정)'
          : '재 고 전 표 (이 동)';

  return (
    <article className="print-area print-portrait bg-white text-black border border-gray-500 p-5 print:border-0 print:p-0">
      <PrintHeader />
      <h1 className="text-center text-lg font-bold tracking-widest mb-4">{title}</h1>

      <section className="border-y-2 border-black mb-5 text-[10px]">
        <dl className="grid grid-cols-2">
          <div className="grid grid-cols-[72px_1fr] gap-2 border-r border-b border-gray-400 p-3">
            <dt className="font-semibold">문서번호</dt>
            <dd className="font-mono">{p.docNo || '-'}</dd>
          </div>
          <div className="grid grid-cols-[72px_1fr] gap-2 border-b border-gray-400 p-3">
            <dt className="font-semibold">처리일자</dt>
            <dd className="font-mono">{p.txDate || '-'}</dd>
          </div>
          <div className="grid grid-cols-[72px_1fr] gap-2 border-r border-gray-400 p-3">
            <dt className="font-semibold">부서명</dt>
            <dd>{p.departmentName || '-'}</dd>
          </div>
          <div className="grid grid-cols-[72px_1fr] gap-2 p-3">
            <dt className="font-semibold">작성자</dt>
            <dd>{p.managerName || '-'}</dd>
          </div>
          <div className="grid grid-cols-[72px_1fr] gap-2 border-r border-gray-400 p-3">
            <dt className="font-semibold">전표 유형</dt>
            <dd>{p.txTypeCode === 'IN' ? '입고' : p.txTypeCode === 'OUT' ? '출고' : p.txTypeCode === 'ADJ' ? '조정' : '이동'}</dd>
          </div>
          <div className="grid grid-cols-[72px_1fr] gap-2 p-3">
            <dt className="font-semibold">처리창고</dt>
            <dd>{Array.from(new Set(p.items.map((item) => item.warehouseName))).join(', ') || '-'}</dd>
          </div>
          <div className="grid grid-cols-[72px_1fr] gap-2 border-t border-r border-gray-400 p-3">
            <dt className="font-semibold">처리사유</dt>
            <dd>{p.txReasonCode || '-'}</dd>
          </div>
          <div className="grid grid-cols-[72px_1fr] gap-2 border-t border-gray-400 p-3">
            <dt className="font-semibold">원본전표</dt>
            <dd className="font-mono">{p.refNo || '-'}</dd>
          </div>
        </dl>
      </section>

      <PrintSection title="자재 목록">
        <PrintTable
          columns={['No', '창고', '자재코드', '자재명', '수량', '단위']}
          rows={p.items.map((item, index) => [
            index + 1,
            item.warehouseName,
            item.inventoryId,
            item.inventoryName,
            formatQuantity(Math.abs(Number(item.qty))),
            item.unit || '-',
          ])}
        />
      </PrintSection>

      <section className="mt-8">
        <div className="grid grid-cols-2 border border-gray-500 text-center text-[10px]">
          <div className="border-r border-gray-500 p-3">
            <span className="block font-semibold text-gray-700 mb-8">공급자</span>
            <div className="mx-8 h-6 border-b border-dashed border-gray-500" />
            <span className="block mt-1 text-[9px] text-gray-500">(서명)</span>
          </div>
          <div className="p-3">
            <span className="block font-semibold text-gray-700 mb-8">인수자</span>
            <div className="mx-8 h-6 border-b border-dashed border-gray-500" />
            <span className="block mt-1 text-[9px] text-gray-500">(서명)</span>
          </div>
        </div>
      </section>
    </article>
  );
}
