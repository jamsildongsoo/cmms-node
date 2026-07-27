import type { ReactNode } from 'react';
import { X } from 'lucide-react';

export function ProcurementModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm print:hidden">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-800 p-6">
          <h2 className="text-lg font-bold text-slate-200">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded border-0 bg-transparent p-1 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

export function ProcurementField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col ${className || ''}`}>
      <span className="mb-1.5 block text-xs text-slate-400">{label}</span>
      {children}
    </label>
  );
}
