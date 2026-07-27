import type { RichTextDocument, RichTextNode } from '../types/richText';
import { formatDateOnly } from './datetime';
import {
  approvalHeading,
  approvalParagraph,
  approvalTable,
} from '../features/approval/approval-content';

interface WorkOrderApprovalContentInput {
  woNo: string;
  statusLabel: string;
  createdAt?: string | null;
  departmentName: string;
  authorName: string;
  equipmentName: string;
  workTypeName: string;
  workDate?: string | null;
  cost: number | string;
  manHours: number | string;
  manHoursUnit: string;
  remarks?: string | null;
  workItems: Array<{
    itemNo: number;
    workName: string;
    workMethod?: string | null;
    workResult?: string | null;
  }>;
}

export const createWorkOrderApprovalContent = (
  input: WorkOrderApprovalContentInput,
): RichTextDocument => {
  const content: RichTextNode[] = [
    approvalHeading('문서 정보', 3),
    approvalTable([
      ['문서번호', input.woNo],
      ['작성일자', formatDateOnly(input.createdAt) || '-'],
      ['부서명', input.departmentName || '-'],
      ['작성자', input.authorName || '-'],
    ]),
    approvalHeading('작업 정보', 3),
    approvalTable([
      ['상태', input.statusLabel, '작업유형', input.workTypeName],
      ['대상설비 번호/이름', input.equipmentName, '', ''],
      ['작업일', input.workDate || '-', '비용', input.cost],
      ['공수', `${input.manHours} ${input.manHoursUnit}`, '', ''],
    ]),
    approvalHeading('작업 항목', 3),
    approvalTable([
      ['번호', '작업/점검 내용', '작업방법', '작업결과'],
      ...input.workItems.map((item) => [
        item.itemNo,
        item.workName,
        item.workMethod || '-',
        item.workResult || '-',
      ]),
    ], true),
  ];

  if (input.remarks) {
    content.push(approvalHeading('비고', 3), approvalParagraph(input.remarks));
  }
  return { type: 'doc', content };
};
