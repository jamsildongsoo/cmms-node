import type { ReactNode } from 'react';
import PrintWindowLayout from './PrintWindowLayout';

interface ListPrintWindowLayoutProps {
  printWindow: Window;
  title: string;
  companyName: string;
  printerName: string;
  printedAt: string;
  children: ReactNode;
}

/** 목록 출력의 용지, 출력 이력, 제목 영역만 공통화하고 표 내용은 각 기능이 소유한다. */
export default function ListPrintWindowLayout({
  printWindow,
  title,
  companyName,
  printerName,
  printedAt,
  children,
}: ListPrintWindowLayoutProps) {
  return (
    <PrintWindowLayout printWindow={printWindow} contentClassName="max-w-none">
      <style>{`
        @page { size: A4 landscape; margin: 10mm 10mm 14mm; }
        .list-print-content thead tr {
          background-color: #f1f5f9 !important;
          color: #0f172a !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        @media print {
          body { padding: 0 !important; }
          .no-print { display: none !important; }
          thead { display: table-header-group; }
          tr { break-inside: avoid; }
        }
      `}</style>
      <div className="list-print-content">
        <div className="mb-2 flex justify-between border-b border-slate-300 pb-1 text-[8pt] text-slate-500">
          <span>회사: {companyName}</span>
          <span>출력자: {printerName} | 출력일시: {printedAt}</span>
        </div>
        <h1 className="mb-3 border-b-2 border-black pb-2 text-center text-[16pt] font-bold">
          {title}
        </h1>
        {children}
      </div>
    </PrintWindowLayout>
  );
}
