import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import ListPrintWindowLayout from '../components/ListPrintWindowLayout';
import { openPrintWindow } from './printWindow';

interface ListPrintColumn<T> {
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface OpenListPrintOptions<T> {
  title: string;
  rows: T[];
  columns: ListPrintColumn<T>[];
  getRowKey: (row: T) => string;
  companyName: string;
  printerName: string;
  printedAt: string;
  emptyMessage?: string;
}

/** 목록별 컬럼 구성은 호출 기능이 소유하고 출력 창과 표 외곽만 공통 처리한다. */
export function openListPrint<T>({
  title,
  rows,
  columns,
  getRowKey,
  companyName,
  printerName,
  printedAt,
  emptyMessage = '출력할 내역이 없습니다.',
}: OpenListPrintOptions<T>): boolean {
  const opened = openPrintWindow({
    title: `${title} - 인쇄`,
    rootId: 'list-print-root',
    features: 'width=1200,height=800',
  });
  if (!opened) return false;

  createRoot(opened.container).render(
    <ListPrintWindowLayout
      printWindow={opened.printWindow}
      title={title}
      companyName={companyName}
      printerName={printerName}
      printedAt={printedAt}
    >
      <table className="w-full border-collapse text-center text-[8pt]">
        <thead>
          <tr className="bg-slate-100">
            {columns.map((column) => (
              <th key={column.header} className="border border-slate-400 px-1.5 py-1 font-semibold">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="border border-slate-400 p-6 text-slate-400">
                {emptyMessage}
              </td>
            </tr>
          ) : rows.map((row) => (
            <tr key={getRowKey(row)}>
              {columns.map((column) => (
                <td key={column.header} className={`border border-slate-400 px-1.5 py-1 ${column.className ?? ''}`}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </ListPrintWindowLayout>,
  );
  opened.printWindow.focus();
  return true;
}
