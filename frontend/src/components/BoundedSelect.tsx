import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface BoundedSelectOption {
  value: string;
  label: string;
}

interface BoundedSelectProps {
  value: string;
  options: BoundedSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  renderOption?: (option: BoundedSelectOption) => ReactNode;
}

/** MDM용 목록 선택기. 선택 영역은 한 줄로 제한하고 옵션 목록은 내부 스크롤을 사용한다. */
export default function BoundedSelect({
  value,
  options,
  onChange,
  disabled,
  placeholder = '선택',
  className = '',
  renderOption,
}: BoundedSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-2 overflow-hidden rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-left text-xs text-slate-200 outline-none transition-colors hover:border-slate-700 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="min-w-0 flex-1 truncate">{selected?.label || placeholder}</span>
        <span className="shrink-0 text-[10px] text-slate-500">▾</span>
      </button>
      {open && !disabled && (
        <div className="absolute left-0 top-full z-[100] mt-1 max-h-60 w-full min-w-full overflow-y-auto overscroll-contain rounded-lg border border-slate-700 bg-slate-900 p-1 shadow-2xl">
          {options.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-500">선택 가능한 항목이 없습니다.</div>
          ) : options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => { onChange(option.value); setOpen(false); }}
              className={`block w-full overflow-hidden rounded-md border-0 px-3 py-2 text-left text-xs hover:bg-slate-800 ${option.value === value ? 'bg-slate-800 text-blue-300' : 'bg-transparent text-slate-200'}`}
            >
              <span className="block truncate">{renderOption ? renderOption(option) : option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
