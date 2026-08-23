import PrintHeader from './PrintHeader';
import { PrintSection, PrintField, PrintTable } from './PrintDoc';
import { getCommonStatusLabel, getJudgeLabel } from '../constants/status';
import ApprovalSignatureBox, { type ApprovalSignatureStep } from '../features/approval/components/ApprovalSignatureBox';

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
  createdAt?: string | null;
  deptName: string;
  authorName: string;
  workDate?: string | null;
  equipmentName: string;
  checkTypeCode: string;
  judgeCode: string;
  remarks?: string;
  checkItems: PmCheckItem[];
  approvalSteps?: ApprovalSignatureStep[];
}

/** 예방점검 계획서/결과보고서 — 전용 문서뷰(흑백). */
export default function PmReportPrint(props: PmReportPrintProps) {
  const range = (it: PmCheckItem) =>
    it.minValue != null || it.maxValue != null
      ? `${it.minValue ?? '-'} ~ ${it.maxValue ?? '-'}${it.baseValue != null ? ` (기준 ${it.baseValue})` : ''}`
      : '-';

  return (
    <article className="pm-report-print print-area print-portrait bg-white text-black border border-gray-500 p-5 print:border-0 print:p-0">
      <PrintHeader approvalNo={props.approvalId} />
      <h1 className="text-center text-xl font-bold tracking-[0.3em] mb-5">
        예 방 점 검 결 과 보 고 서
      </h1>

      <section className="grid grid-cols-2 border-y-2 border-black mb-5 text-[10px]">
        <dl className="border-r border-gray-500 p-3 space-y-2">
          <div className="grid grid-cols-[64px_1fr] gap-2"><dt className="font-semibold">문서번호</dt><dd className="font-mono">{props.pmNo}</dd></div>
          <div className="grid grid-cols-[64px_1fr] gap-2"><dt className="font-semibold">작성일자</dt><dd className="font-mono">{props.createdAt || '-'}</dd></div>
          <div className="grid grid-cols-[64px_1fr] gap-2"><dt className="font-semibold">부서명</dt><dd>{props.deptName || '-'}</dd></div>
          <div className="grid grid-cols-[64px_1fr] gap-2"><dt className="font-semibold">작성자</dt><dd>{props.authorName || '-'}</dd></div>
        </dl>
        <div className="p-3">
          <ApprovalSignatureBox steps={props.approvalSteps || []} drafterDate={props.createdAt} />
        </div>
      </section>

      <PrintSection title="문서 정보">
        <div className="divide-y divide-gray-300 border-y border-gray-400">
          <div className="grid grid-cols-2 gap-4 py-2">
            <PrintField label="제목" value={props.title || '-'} />
            <PrintField label="상태" value={getCommonStatusLabel(props.status)} />
          </div>
          <div className="grid grid-cols-2 gap-4 py-2">
            <PrintField label="대상설비" value={props.equipmentName} />
            <PrintField label="유형" value={props.checkTypeCode} />
            <PrintField label="종합판정" value={getJudgeLabel(props.judgeCode)} />
          </div>
          <div className="grid grid-cols-3 gap-4 py-2">
            <PrintField label="점검일" value={props.workDate || '-'} />
          </div>
        </div>
      </PrintSection>


      {props.remarks && (
        <PrintSection title="비고">
          <div className="text-[10px] whitespace-pre-wrap">{props.remarks}</div>
        </PrintSection>
      )}

      <PrintSection title="점검 세부 항목">
        <PrintTable
          columns={['번호', '점검항목', '점검방법', '기준범위', '측정값', '단위']}
          rows={props.checkItems.map((it, i) => [i + 1, it.checkName, it.checkMethod || '-', range(it), it.checkValue ?? '-', it.unit || '-'])}
        />
      </PrintSection>
    </article>
  );
}
