import PrintHeader from './PrintHeader';
import { PrintSection, PrintField, PrintFieldGrid, PrintTable } from './PrintDoc';
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
  deptName: string;
  supervisorName: string;
  startAt: string;
  endAt: string;
  equipmentName: string;
  workOrderId: string;
  permitTypeLabel: string;
  stepStage: string;
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
    <div className="hidden print:block bg-white text-black">
      <PrintHeader approvalNo={p.approvalId} />
      <h1 className="text-center text-lg font-bold tracking-widest mb-4">안 전 작 업 허 가 서</h1>

      <PrintSection title="일반 정보">
        <PrintFieldGrid cols={3}>
          <PrintField label="번호" value={p.wpNo} />
          <PrintField label="내용" value={p.title} />
          <PrintField label="상태" value={getCommonStatusLabel(p.status)} />
          <PrintField label="부서" value={p.deptName} />
          <PrintField label="감독자" value={p.supervisorName} />
          <PrintField label="작업기간" value={`${fmt(p.startAt)} ~ ${fmt(p.endAt)}`} />
        </PrintFieldGrid>
      </PrintSection>

      <PrintSection title="작업 정보">
        <PrintFieldGrid cols={3}>
          <PrintField label="대상설비" value={p.equipmentName} />
          <PrintField label="허가유형" value={p.permitTypeLabel} />
          <PrintField label="단계" value={p.stepStage} />
          <PrintField label="연계 작업지시" value={p.workOrderId} />
        </PrintFieldGrid>
        <div className="mt-2 space-y-1">
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
    </div>
  );
}
