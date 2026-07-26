import type { RichTextDocument, RichTextNode } from '../types/richText';
import {
  approvalHeading,
  approvalParagraph,
  approvalTable,
} from './approvalContentBuilder';

interface WorkPermitApprovalContentInput {
  wpNo: string;
  statusLabel: string;
  createdAt?: string | null;
  departmentName: string;
  authorName: string;
  equipmentName: string;
  permitTypeName: string;
  startAt: string;
  endAt: string;
  supervisorName: string;
  workOrderId?: string | null;
  workSummary?: string | null;
  riskFactors?: string | null;
  safetyMeasures?: string | null;
  remarks?: string | null;
  checksheets: Array<{
    name: string;
    items: Array<{ question: string; checked: boolean; remarks: string }>;
  }>;
}

export const createWorkPermitApprovalContent = (
  input: WorkPermitApprovalContentInput,
): RichTextDocument => {
  const content: RichTextNode[] = [
    approvalHeading('문서 정보', 3),
    approvalTable([
      ['문서번호', input.wpNo],
      ['작성일자', input.createdAt || '-'],
      ['부서명', input.departmentName || '-'],
      ['작성자', input.authorName || '-'],
    ]),
    approvalHeading('허가 정보', 3),
    approvalTable([
      ['상태', input.statusLabel, '허가유형', input.permitTypeName],
      ['대상설비 번호/이름', input.equipmentName, '', ''],
      ['작업 시작', input.startAt, '작업 종료', input.endAt],
      ['감독자', input.supervisorName, '연계 작업지시', input.workOrderId || '-'],
      ['작업개요', input.workSummary || '-', '위험요인', input.riskFactors || '-'],
      ['안전대책', input.safetyMeasures || '-', '', ''],
    ]),
  ];

  input.checksheets.forEach((sheet) => {
    content.push(
      approvalHeading(sheet.name, 3),
      approvalTable([
        ['점검 항목', '확인', '비고'],
        ...sheet.items.map((item) => [
          item.question,
          item.checked ? 'O' : '-',
          item.remarks || '-',
        ]),
      ], true),
    );
  });

  if (input.remarks) {
    content.push(approvalHeading('비고', 3), approvalParagraph(input.remarks));
  }
  return { type: 'doc', content };
};
