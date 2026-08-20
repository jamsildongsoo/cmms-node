import type { ReactNode } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
}

export default function Modal({
  title,
  onClose,
  children,
  footer,
  className = 'max-w-4xl',
  contentClassName = 'flex-1 overflow-y-auto p-6',
}: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm print:hidden">
      <div className={`flex max-h-[90vh] w-full flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl ${className}`}>
        <div className="flex shrink-0 items-center justify-between border-b border-slate-800 p-6">
          <h2 className="text-lg font-bold text-slate-200">{title}</h2>
          <button type="button" onClick={onClose} className="cursor-pointer rounded border-0 bg-transparent p-1 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300">
            <X size={20} />
          </button>
        </div>
        <div className={contentClassName}>{children}</div>
        {footer && <div className="flex shrink-0 justify-end gap-2 border-t border-slate-800 p-6">{footer}</div>}
      </div>
    </div>
  );
}
