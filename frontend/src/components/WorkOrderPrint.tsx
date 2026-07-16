import PrintHeader from './PrintHeader';
import { PrintSection, PrintField, PrintFieldGrid, PrintTable } from './PrintDoc';
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
  deptName: string;
  workerId: string;
  workDate: string;
  equipmentName: string;
  woTypeCode: string;
  stepStage: string;
  cost: number | string;
  manHours: number | string;
  manHoursUnit: string;
  remarks?: string;
  workItems: WoItem[];
}

/** 작업지시서 — 전용 인쇄뷰(흑백). 화면엔 숨김(hidden print:block). */
export default function WorkOrderPrint(p: WorkOrderPrintProps) {
  return (
    <div className="hidden print:block bg-white text-black">
      <PrintHeader approvalNo={p.approvalId} />
      <h1 className="text-center text-lg font-bold tracking-widest mb-4">작 업 지 시 서</h1>

      <PrintSection title="일반 정보">
        <PrintFieldGrid cols={3}>
          <PrintField label="번호" value={p.woNo} />
          <PrintField label="내용" value={p.title} />
          <PrintField label="상태" value={getCommonStatusLabel(p.status)} />
          <PrintField label="부서" value={p.deptName} />
          <PrintField label="담당자(작업자)" value={p.workerId} />
          <PrintField label="지시일자" value={p.workDate} />
        </PrintFieldGrid>
      </PrintSection>

      <PrintSection title="작업 정보">
        <PrintFieldGrid cols={3}>
          <PrintField label="대상설비" value={p.equipmentName} />
          <PrintField label="작업유형" value={p.woTypeCode} />
          <PrintField label="단계" value={p.stepStage} />
          <PrintField label="비용" value={p.cost} />
          <PrintField label="공수" value={`${p.manHours} ${p.manHoursUnit}`} />
        </PrintFieldGrid>
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
    </div>
  );
}
