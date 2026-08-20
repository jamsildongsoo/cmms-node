import type { ReactNode } from 'react';
import PrintHeader from './PrintHeader';

type DocumentListPanelProps = {
  heading: ReactNode;
  printHeading: ReactNode;
  isFormOpen: boolean;
  landscape?: boolean;
  children: ReactNode;
};

export default function DocumentListPanel({
  heading,
  printHeading,
  isFormOpen,
  landscape = false,
  children,
}: DocumentListPanelProps) {
  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-xl p-6 print:border-0 print:bg-transparent print:p-0 ${landscape ? 'print-landscape' : ''} ${isFormOpen ? 'print:hidden' : ''}`}>
      <div className="space-y-4 print:block">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5 print:hidden">
          {heading}
        </h3>
        <PrintHeader />
        <h1 className="hidden print:block text-center text-xl font-bold tracking-widest text-black border-b-2 border-black pb-2 mb-4">
          {printHeading}
        </h1>
        {children}
      </div>
    </div>
  );
}
