function toFiniteNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

interface NumberFormatOptions {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  fallback?: string;
}

export function formatNumber(
  value: string | number | null | undefined,
  options: NumberFormatOptions = {},
): string {
  const number = toFiniteNumber(value);
  if (number === null) return options.fallback ?? '-';
  return number.toLocaleString('ko-KR', {
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
    maximumFractionDigits: options.maximumFractionDigits ?? 0,
  });
}

export function formatQuantity(value: string | number | null | undefined): string {
  return formatNumber(value, { maximumFractionDigits: 4 });
}

export function formatAmount(value: string | number | null | undefined): string {
  return formatNumber(value, { maximumFractionDigits: 2 });
}

export function formatMoney(value: string | number | null | undefined): string {
  return `${formatAmount(value)} 원`;
}
