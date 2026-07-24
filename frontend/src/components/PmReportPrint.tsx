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
  stepStage: 'P' | 'R';
  pmNo: string;
  title?: string;
  status: string;
  approvalId?: string | null;
  createdAt?: string | null;
  deptName: string;
  authorName: string;
  workDate?: string | null;
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

/** 예방점검 계획서/결과보고서 — 전용 문서뷰(흑백). */
export default function PmReportPrint(props: PmReportPrintProps) {
  const isPlan = props.stepStage === 'P';
  const range = (it: PmCheckItem) =>
    it.minValue != null || it.maxValue != null
      ? `${it.minValue ?? '-'} ~ ${it.maxValue ?? '-'}${it.baseValue != null ? ` (기준 ${it.baseValue})` : ''}`
      : '-';

  return (
    <article className="pm-report-print print-area print-portrait bg-white text-black border border-gray-500 p-5 print:border-0 print:p-0">
      <PrintHeader approvalNo={props.approvalId} />
      <h1 className="text-center text-xl font-bold tracking-[0.3em] mb-5">
        {isPlan ? '예 방 점 검 계 획 서' : '예 방 점 검 결 과 보 고 서'}
      </h1>

      {/* ApprovalDocPrint의 좌측 문서정보와 같은 라벨/값 구성. 결재박스는 표시하지 않는다. */}
      <section className="border-y-2 border-black mb-5 text-[10px]">
        <dl className="p-3 space-y-2">
          <div className="grid grid-cols-[64px_1fr] gap-2"><dt className="font-semibold">문서번호</dt><dd className="font-mono">{props.pmNo}</dd></div>
          <div className="grid grid-cols-[64px_1fr] gap-2"><dt className="font-semibold">작성일자</dt><dd className="font-mono">{props.createdAt || '-'}</dd></div>
          <div className="grid grid-cols-[64px_1fr] gap-2"><dt className="font-semibold">부서명</dt><dd>{props.deptName || '-'}</dd></div>
          <div className="grid grid-cols-[64px_1fr] gap-2"><dt className="font-semibold">작성자</dt><dd>{props.authorName || '-'}</dd></div>
        </dl>
      </section>

      <PrintSection title="문서 정보">
        <div className="divide-y divide-gray-300 border-y border-gray-400">
          <div className="grid grid-cols-2 gap-4 py-2">
            <PrintField label="제목" value={props.title || '-'} />
            <PrintField label="상태" value={getCommonStatusLabel(props.status)} />
          </div>
          <div className="grid grid-cols-2 gap-4 py-2">
            <PrintField label="대상설비 번호/이름" value={props.equipmentName} />
            <PrintField label="점검유형" value={props.checkTypeCode} />
            {!isPlan && <PrintField label="종합판정" value={getJudgeLabel(props.judgeCode)} />}
          </div>
          <div className="grid grid-cols-3 gap-4 py-2">
            <PrintField label={isPlan ? '계획일' : '점검일'} value={props.workDate || '-'} />
            {isPlan && <PrintField label="시작일" value={props.cycleFrom || '-'} />}
            {isPlan && <PrintField label="종료일" value={props.cycleEnd || '-'} />}
            {isPlan && (props.cycleFrom || props.cycleEnd) && <div className="col-span-3 text-[10px] font-semibold">(반복작업)</div>}
          </div>
        </div>
      </PrintSection>

      {!isPlan && (props.certNumber || props.certAgency || props.certExpireDate) && (
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
          columns={isPlan
            ? ['번호', '점검항목', '점검방법', '기준범위', '단위']
            : ['번호', '점검항목', '점검방법', '기준범위', '측정값', '단위']}
          rows={props.checkItems.map((it, i) => isPlan
            ? [i + 1, it.checkName, it.checkMethod || '-', range(it), it.unit || '-']
            : [i + 1, it.checkName, it.checkMethod || '-', range(it), it.checkValue ?? '-', it.unit || '-'])}
        />
      </PrintSection>

      {props.remarks && (
        <PrintSection title="비고">
          <div className="text-[10px] whitespace-pre-wrap">{props.remarks}</div>
        </PrintSection>
      )}
    </article>
  );
}
