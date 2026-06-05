import PrintHeader from './PrintHeader';
import { PrintField } from './PrintDoc';

interface SlipPrintProps {
  txTypeCode: string;
  txTypeLabel: string;
  docNo?: string | null;
  historyNo: number | string;
  txDate: string;
  companyId: string;
  warehouseName: string;
  inventoryId: string;
  inventoryName: string;
  qty: number;
  unitPrice: number;
  amount: number;
  userId: string;
  refNo?: string | null;
  refModule?: string | null;
}

/** 입·출고증/조정·이동 전표 — 전용 인쇄뷰(흑백). 인도인/인수인 수기 서명. */
export default function SlipPrint(p: SlipPrintProps) {
  const title =
    p.txTypeCode === 'IN' ? '입 고 증'
      : p.txTypeCode === 'OUT' ? '출 고 증'
        : p.txTypeCode === 'ADJ' ? '재 고 조 정 전 표'
          : '재 고 이 동 전 표';

  return (
    <div className="hidden print:block bg-white text-black">
      <PrintHeader />
      <div className="text-center mb-5 border-b-2 border-black pb-3">
        <h1 className="text-xl font-bold tracking-widest">{title}</h1>
        <div className="text-[10px] mt-1">전표번호: {p.docNo || '-'} · 이력 NO.{p.historyNo}</div>
      </div>

      <div className="border border-gray-400 p-3 space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <PrintField label="발행 테넌트" value={p.companyId} />
          <PrintField label="처리 일자" value={p.txDate} />
        </div>
        <hr className="border-gray-300" />
        <div className="grid grid-cols-2 gap-4">
          <PrintField label="보관/지출 창고" value={p.warehouseName} />
          <PrintField label="자재 (코드 / 자재명)" value={`${p.inventoryId} / ${p.inventoryName}`} />
        </div>
        <hr className="border-gray-300" />
        <div className="grid grid-cols-3 gap-4">
          <PrintField label="수량" value={Math.abs(p.qty).toLocaleString()} />
          <PrintField label="단가 (평균법)" value={`${Math.round(p.unitPrice).toLocaleString()} 원`} />
          <PrintField label="총 거래금액" value={`${Math.round(Math.abs(p.amount)).toLocaleString()} 원`} />
        </div>
        <hr className="border-gray-300" />
        <div className="grid grid-cols-2 gap-4">
          <PrintField label="거래 구분" value={`${p.txTypeLabel} (${p.txTypeCode})`} />
          <PrintField label="승인 담당자" value={`${p.userId} (인)`} />
        </div>
        {p.refNo && (
          <div className="text-[9px] text-gray-600">
            {p.refModule === 'PUR' ? `* 구매요청 출처: ${p.refNo}` : `* 연계 참조: ${p.refNo} (${p.refModule})`}
          </div>
        )}
      </div>

      {/* 인도/인수 수기 서명 */}
      <div className="grid grid-cols-2 border border-gray-400 text-center text-[10px] mt-6">
        <div className="p-3 border-r border-gray-400">
          <span className="block mb-5 text-gray-600">인도인 (지출자)</span>
          <div className="h-5 border-b border-dashed border-gray-400 mx-8" />
        </div>
        <div className="p-3">
          <span className="block mb-5 text-gray-600">인수인 (수령자)</span>
          <div className="h-5 border-b border-dashed border-gray-400 mx-8" />
        </div>
      </div>
    </div>
  );
}
