import type { RichTextNode } from '../types/richText';

const text = (value: unknown, bold = false): RichTextNode => ({
  type: 'text',
  text: value == null || value === '' ? '-' : String(value),
  marks: bold ? [{ type: 'bold' }] : undefined,
});

export const approvalParagraph = (value: unknown): RichTextNode => ({
  type: 'paragraph',
  content: [text(value)],
});

export const approvalHeading = (value: string, level: number): RichTextNode => ({
  type: 'heading',
  attrs: { level },
  content: [text(value)],
});

export const approvalTable = (
  rows: unknown[][],
  headerRow = false,
): RichTextNode => ({
  type: 'table',
  content: rows.map((row, rowIndex) => ({
    type: 'tableRow',
    content: row.map((value) => ({
      type: headerRow && rowIndex === 0 ? 'tableHeader' : 'tableCell',
      content: [{
        type: 'paragraph',
        content: [text(value, headerRow && rowIndex === 0)],
      }],
    })),
  })),
});
