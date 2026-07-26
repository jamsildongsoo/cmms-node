import type { RichTextDocument, RichTextNode } from '../types/richText';

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
  stepStage: 'P' | 'R';
  pmNo: string;
  statusLabel: string;
  createdAt?: string | null;
  departmentName: string;
  authorName: string;
  equipmentName: string;
  checkTypeName: string;
  workDate?: string | null;
  cycleFrom?: string | null;
  cycleEnd?: string | null;
  judgeName: string;
  certNumber?: string | null;
  certAgency?: string | null;
  certExpireDate?: string | null;
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
  const isPlan = input.stepStage === 'P';
  const content: RichTextNode[] = [
    heading('문서 정보', 3),
    table([
      ['문서번호', input.pmNo],
      ['작성일자', input.createdAt || '-'],
      ['부서명', input.departmentName || '-'],
      ['작성자', input.authorName || '-'],
    ]),
    heading('점검 정보', 3),
    table([
      ['상태', input.statusLabel, '점검유형', input.checkTypeName],
      ['대상설비 번호/이름', input.equipmentName, '', ''],
      [
        isPlan ? '계획일' : '점검일',
        input.workDate || '-',
        isPlan ? '시작일' : '종합판정',
        isPlan ? input.cycleFrom || '-' : input.judgeName,
      ],
      ...(isPlan ? [['종료일', input.cycleEnd || '-', '', '']] : []),
    ]),
  ];

  if (!isPlan && (input.certNumber || input.certAgency || input.certExpireDate)) {
    content.push(
      heading('법정 인증 정보', 3),
      table([
        ['인증번호', input.certNumber || '-'],
        ['인증기관', input.certAgency || '-'],
        ['유효만료일', input.certExpireDate || '-'],
      ]),
    );
  }

  if (input.remarks) {
    content.push(heading('비고', 3), paragraph(input.remarks));
  }

  content.push(
    heading('점검 세부 항목', 3),
    table(
      [
        isPlan
          ? ['번호', '점검항목', '점검방법', '기준범위', '단위']
          : ['번호', '점검항목', '점검방법', '기준범위', '측정값', '단위'],
        ...input.checkItems.map((item, index) =>
          isPlan
            ? [
              index + 1,
              item.checkName,
              item.checkMethod || '-',
              range(item),
              item.unit || '-',
            ]
            : [
              index + 1,
              item.checkName,
              item.checkMethod || '-',
              range(item),
              item.checkValue ?? '-',
              item.unit || '-',
            ]),
      ],
      true,
    ),
  );

  return { type: 'doc', content };
};
