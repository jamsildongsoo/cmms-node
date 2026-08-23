import type { RichTextDocument, RichTextNode } from '../types/richText';
import { formatDateOnly } from './datetime';

interface PmApprovalItem {
  checkName: string;
  checkMethod?: string | null;
  minValue?: number | string | null;
  maxValue?: number | string | null;
  baseValue?: number | string | null;
  checkValue?: number | string | null;
  unit?: string | null;
}

interface PmApprovalContentInput {
  pmNo: string;
  statusLabel: string;
  createdAt?: string | null;
  departmentName: string;
  authorName: string;
  equipmentName: string;
  checkTypeName: string;
  workDate?: string | null;
  judgeName: string;
  remarks?: string | null;
  checkItems: PmApprovalItem[];
}

const text = (value: unknown, bold = false): RichTextNode => ({
  type: 'text',
  text: value == null || value === '' ? '-' : String(value),
  marks: bold ? [{ type: 'bold' }] : undefined,
});

const paragraph = (value: unknown, bold = false): RichTextNode => ({
  type: 'paragraph',
  content: [text(value, bold)],
});

const heading = (value: string, level: number): RichTextNode => ({
  type: 'heading',
  attrs: { level },
  content: [text(value)],
});

const cell = (value: unknown, header = false): RichTextNode => ({
  type: header ? 'tableHeader' : 'tableCell',
  content: [paragraph(value, header)],
});

const table = (rows: unknown[][], headerRow = false): RichTextNode => ({
  type: 'table',
  content: rows.map((row, rowIndex) => ({
    type: 'tableRow',
    content: row.map((value) => cell(value, headerRow && rowIndex === 0)),
  })),
});

const range = (item: PmApprovalItem): string =>
  item.minValue != null || item.maxValue != null
    ? `${item.minValue ?? '-'} ~ ${item.maxValue ?? '-'}${
      item.baseValue != null ? ` (기준 ${item.baseValue})` : ''
    }`
    : '-';

export const createPmApprovalContent = (
  input: PmApprovalContentInput,
): RichTextDocument => {
  const content: RichTextNode[] = [
    heading('문서 정보', 3),
    table([
      ['문서번호', input.pmNo],
      ['작성일자', formatDateOnly(input.createdAt) || '-'],
      ['부서명', input.departmentName || '-'],
      ['작성자', input.authorName || '-'],
    ]),
    heading('점검 정보', 3),
    table([
      ['상태', input.statusLabel, '점검유형', input.checkTypeName],
      ['대상설비 번호/이름', input.equipmentName, '', ''],
      [
        '점검일',
        input.workDate || '-',
        '종합판정',
        input.judgeName,
      ],
    ]),
  ];

  if (input.remarks) {
    content.push(heading('비고', 3), paragraph(input.remarks));
  }

  content.push(
    heading('점검 세부 항목', 3),
    table(
      [
        ['번호', '점검항목', '점검방법', '기준범위', '측정값', '단위'],
        ...input.checkItems.map((item, index) =>
          [index + 1, item.checkName, item.checkMethod || '-', range(item), item.checkValue ?? '-', item.unit || '-']),
      ],
      true,
    ),
  );

  return { type: 'doc', content };
};
