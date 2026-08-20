import { useCallback, useEffect, useState, type ReactNode } from 'react';

export interface SearchSelectProps<T> {
  value: string;
  onChange: (value: string, item: T) => void;
  search: (keyword: string) => Promise<T[]>;
  getKey: (item: T) => string;
  renderOption: (item: T) => ReactNode;
  placeholder?: string;
  emptyMessage?: string;
  minKeywordLength?: number;
  disabled?: boolean;
  className?: string;
}

const inputClass = 'w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg py-2 px-3 text-slate-200 outline-none disabled:opacity-60';

function useDebouncedValue(value: string, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function SearchSelect<T>({
  value,
  onChange,
  search,
  getKey,
  renderOption,
  placeholder,
  emptyMessage = '검색 결과가 없습니다.',
  minKeywordLength = 2,
  disabled,
  className,
}: SearchSelectProps<T>) {
  const [keyword, setKeyword] = useState(value);
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounced = useDebouncedValue(keyword);

  const loadOptions = useCallback(async () => {
    const trimmed = debounced.trim();
    if (trimmed.length < minKeywordLength) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      setItems(await search(trimmed));
    } finally {
      setLoading(false);
    }
  }, [debounced, minKeywordLength, search]);

  useEffect(() => {
    if (!open) return;
    const run = async () => {
      await loadOptions();
    };
    void run();
  }, [loadOptions, open]);

  return (
    <div className={`relative ${className || ''}`}>
      <input
        value={open ? keyword : value || keyword}
        disabled={disabled}
        placeholder={placeholder}
        className={inputClass}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onChange={(event) => { setKeyword(event.target.value); setOpen(true); }}
        onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}
      />
      {open && !disabled && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-700 bg-slate-900 shadow-xl">
          {loading ? <div className="px-3 py-2 text-xs text-slate-500">검색 중...</div> : items.length === 0 ? <div className="px-3 py-2 text-xs text-slate-500">{emptyMessage}</div> : items.map((item) => (
            <button
              key={getKey(item)}
              type="button"
              className="block w-full border-0 bg-transparent px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => { onChange(getKey(item), item); setKeyword(getKey(item)); setOpen(false); }}
            >
              {renderOption(item)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
