import type { ReactNode } from 'react';

interface ListBadgeProps {
  children: ReactNode;
  title?: string;
}

export default function ListBadge({ children, title }: ListBadgeProps) {
  return (
    <span
      title={title}
      className="inline-flex min-h-5 items-center whitespace-nowrap rounded-md border border-slate-700/80 bg-slate-800/70 px-2 py-0.5 text-[11px] font-medium leading-none text-slate-300 print:border-slate-400 print:bg-white print:text-black"
    >
      {children}
    </span>
  );
}
