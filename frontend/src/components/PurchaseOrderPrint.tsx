import PrintHeader from './PrintHeader';
import { PrintField, PrintSection, PrintTable } from './PrintDoc';

interface PurchaseOrderItem {
  inventoryId: string;
  inventoryName?: string | null;
  qty: number | string;
  unit?: string | null;
  remarks?: string | null;
}

interface PurchaseOrderPrintProps {
  id: string;
  title?: string | null;
  orderDate?: string | null;
  etaDate?: string | null;
  shipStartDate?: string | null;
  plantName: string;
  warehouseName: string;
  vendorId?: string | null;
  vendorName?: string | null;
  vendorBizNo?: string | null;
  vendorContact?: string | null;
  vendorManager?: string | null;
  purchaseManager: string;
  purchaseManagerContact?: string | null;
  remarks?: string | null;
  items: PurchaseOrderItem[];
}

/** 구매관리용 발주서 — 결재란 없이 공급업체·납품·품목 정보를 출력한다. */
export default function PurchaseOrderPrint(p: PurchaseOrderPrintProps) {
  return (
    <article className="print-area print-portrait bg-white text-black border border-gray-500 p-5 print:border-0 print:p-0">
      <PrintHeader />
      <h1 className="text-center text-lg font-bold tracking-widest mb-5">발 주 서</h1>

      <PrintSection title="발주 정보">
        <div className="divide-y divide-gray-300 border-y border-gray-400">
          <div className="grid grid-cols-2 gap-4 py-2">
            <PrintField label="발주번호" value={p.id} />
            <PrintField label="발주일" value={p.orderDate} />
          </div>
          <div className="py-2">
            <PrintField label="제목" value={p.title} />
          </div>
          <div className="grid grid-cols-2 gap-4 py-2">
            <PrintField label="구매담당자" value={p.purchaseManager} />
            <PrintField label="담당자 연락처" value={p.purchaseManagerContact} />
          </div>
          <div className="grid grid-cols-2 gap-4 py-2">
            <PrintField label="플랜트" value={p.plantName} />
            <PrintField label="납품 창고" value={p.warehouseName} />
          </div>
          <div className="grid grid-cols-2 gap-4 py-2">
            <PrintField label="예정도착일" value={p.etaDate} />
            <PrintField label="배송시작일" value={p.shipStartDate} />
          </div>
        </div>
      </PrintSection>

      <PrintSection title="공급업체 정보">
        <div className="divide-y divide-gray-300 border-y border-gray-400">
          <div className="grid grid-cols-2 gap-4 py-2">
            <PrintField label="공급업체" value={p.vendorId ? (p.vendorName ? `${p.vendorId} / ${p.vendorName}` : p.vendorId) : '-'} />
            <PrintField label="사업자번호" value={p.vendorBizNo} />
          </div>
          <div className="grid grid-cols-2 gap-4 py-2">
            <PrintField label="담당자" value={p.vendorManager} />
            <PrintField label="연락처" value={p.vendorContact} />
          </div>
        </div>
      </PrintSection>

      <PrintSection title="발주 품목">
        <PrintTable
          columns={['No', '자재코드', '자재명', '수량', '단위', '비고']}
          rows={p.items.map((item, index) => [
            index + 1,
            item.inventoryId,
            item.inventoryName || '-',
            item.qty,
            item.unit || '-',
            item.remarks || '-',
          ])}
        />
      </PrintSection>

      {p.remarks && (
        <PrintSection title="비고">
          <div className="min-h-12 border-y border-gray-400 py-2 text-[10px] whitespace-pre-wrap">
            {p.remarks}
          </div>
        </PrintSection>
      )}
    </article>
  );
}
