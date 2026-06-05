import PrintHeader from './PrintHeader';
import PrintSignBox from './PrintSignBox';
import { PrintSection, PrintField, PrintFieldGrid, PrintTable } from './PrintDoc';

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
  items: PrItem[];
}

/** 구매요청서 — 전용 인쇄뷰(흑백). 수기 결재칸 포함. 결재 비연계라 워터마크 결재번호 없음. */
export default function ProcurementRequestPrint(p: ProcurementRequestPrintProps) {
  return (
    <div className="hidden print:block bg-white text-black">
      <PrintHeader />
      <h1 className="text-center text-lg font-bold tracking-widest mb-4">구 매 요 청 서</h1>

      <PrintSection title="일반 정보">
        <PrintFieldGrid cols={3}>
          <PrintField label="번호" value={p.id} />
          <PrintField label="요청유형" value={p.requestType} />
          <PrintField label="요청일" value={p.requestDate} />
          <PrintField label="플랜트" value={p.plantId} />
          <PrintField label="요청자" value={p.requesterId} />
          <PrintField label="입고 저장소" value={p.warehouseId} />
        </PrintFieldGrid>
      </PrintSection>

      <PrintSection title="요청 품목">
        <PrintTable
          columns={['No', '자재', '수량', '단위', '비고']}
          rows={p.items.map((it, i) => [i + 1, it.inventoryId, it.qty, it.unit || '-', it.remarks || ''])}
        />
      </PrintSection>

      <PrintSignBox />
    </div>
  );
}
