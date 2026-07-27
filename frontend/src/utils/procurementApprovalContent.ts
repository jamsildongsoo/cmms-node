import type { RichTextDocument, RichTextNode } from '../types/richText';
import {
  approvalHeading,
  approvalParagraph,
  approvalTable,
} from '../features/approval/approval-content';

interface ProcurementApprovalContentInput {
  requestNo: string;
  createdAt?: string | null;
  departmentName: string;
  authorName: string;
  requestDate?: string | null;
  requestTypeName: string;
  plantName: string;
  warehouseName: string;
  remarks?: string | null;
  items: Array<{
    inventoryId: string;
    inventoryName: string;
    qty: number | string;
    unit?: string | null;
    remarks?: string | null;
  }>;
}

export const createProcurementApprovalContent = (
  input: ProcurementApprovalContentInput,
): RichTextDocument => {
  const content: RichTextNode[] = [
    approvalHeading('문서 정보', 3),
    approvalTable([
      ['문서번호', input.requestNo],
      ['작성일자', input.createdAt || '-'],
      ['부서', input.departmentName || '-'],
      ['작성자', input.authorName || '-'],
    ]),
    approvalHeading('요청 정보', 3),
    approvalTable([
      ['요청일', input.requestDate || '-', '요청유형', input.requestTypeName],
      ['플랜트', input.plantName, '예정 창고', input.warehouseName],
    ]),
    approvalHeading('요청 자재', 3),
    approvalTable([
      ['번호', '자재코드', '자재명', '수량', '단위', '비고'],
      ...input.items.map((item, index) => [
        index + 1,
        item.inventoryId,
        item.inventoryName,
        item.qty,
        item.unit || '-',
        item.remarks || '-',
      ]),
    ], true),
  ];

  if (input.remarks) {
    content.push(approvalHeading('비고', 3), approvalParagraph(input.remarks));
  }

  return { type: 'doc', content };
};
