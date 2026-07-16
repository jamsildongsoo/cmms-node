import PrintHeader from './PrintHeader';
import { PrintSection, PrintField, PrintFieldGrid, PrintTable } from './PrintDoc';
import { getCommonStatusLabel, getJudgeLabel } from '../constants/status';

interface PmCheckItem {
  checkName: string;
  checkMethod?: string | null;
  minValue?: number | string | null;
  maxValue?: number | string | null;
  baseValue?: number | string | null;
  checkValue?: number | string | null;
  unit?: string | null;
}

interface PmReportPrintProps {
  pmNo: string;
  title?: string;
  status: string;
  approvalId?: string | null;
  deptName: string;
  workerId: string;
  workDate: string;
  cycleFrom?: string | null;
  cycleEnd?: string | null;
  equipmentName: string;
  checkTypeCode: string;
  judgeCode: string;
  certNumber?: string;
  certAgency?: string;
  certExpireDate?: string;
  remarks?: string;
  checkItems: PmCheckItem[];
}

/** 예방점검 보고서 — 전용 인쇄뷰(흑백). 화면엔 숨김(hidden print:block). */
export default function PmReportPrint(props: PmReportPrintProps) {
  const range = (it: PmCheckItem) =>
    it.minValue != null || it.maxValue != null
      ? `${it.minValue ?? '-'} ~ ${it.maxValue ?? '-'}${it.baseValue != null ? ` (기준 ${it.baseValue})` : ''}`
      : '-';

  return (
    <div className="hidden print:block bg-white text-black">
      <PrintHeader approvalNo={props.approvalId} />
      <h1 className="text-center text-lg font-bold tracking-widest mb-4">예 방 점 검 보 고 서</h1>

      <PrintSection title="일반 정보">
        <PrintFieldGrid cols={3}>
          <PrintField label="번호" value={props.pmNo} />
          <PrintField label="상태" value={getCommonStatusLabel(props.status)} />
          <PrintField label="제목" value={props.title || '-'} />
          <div />
          <PrintField label="부서" value={props.deptName} />
          <PrintField label="담당자(점검자)" value={props.workerId} />
          <PrintField label="점검일자" value={props.workDate} />
          {(props.cycleFrom || props.cycleEnd) && (
            <>
              <PrintField label="계획기간" value={`${props.cycleFrom || '-'} ~ ${props.cycleEnd || '-'}`} />
              <div />
              <div />
            </>
          )}
        </PrintFieldGrid>
      </PrintSection>

      <PrintSection title="작업 정보">
        <PrintFieldGrid cols={3}>
          <PrintField label="대상설비" value={props.equipmentName} />
          <PrintField label="점검유형" value={props.checkTypeCode} />
          <PrintField label="종합판정" value={getJudgeLabel(props.judgeCode)} />
        </PrintFieldGrid>
      </PrintSection>

      {(props.certNumber || props.certAgency || props.certExpireDate) && (
        <PrintSection title="법정 인증 정보">
          <PrintFieldGrid cols={3}>
            <PrintField label="인증번호" value={props.certNumber} />
            <PrintField label="인증기관" value={props.certAgency} />
            <PrintField label="유효만료일" value={props.certExpireDate} />
          </PrintFieldGrid>
        </PrintSection>
      )}

      <PrintSection title="점검 세부 항목">
        <PrintTable
          columns={['번호', '점검항목', '점검방법', '기준범위', '측정값', '단위']}
          rows={props.checkItems.map((it, i) => [
            i + 1,
            it.checkName,
            it.checkMethod || '-',
            range(it),
            it.checkValue ?? '-',
            it.unit || '-',
          ])}
        />
      </PrintSection>

      {props.remarks && (
        <PrintSection title="비고">
          <div className="text-[10px] whitespace-pre-wrap">{props.remarks}</div>
        </PrintSection>
      )}
    </div>
  );
}
