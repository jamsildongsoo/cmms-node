import { addDays, addMonths, addWeeks, addYears } from 'date-fns';

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;

export function toDateOnly(value: Date | string): string {
  if (typeof value === 'string') {
    const match = DATE_ONLY_PATTERN.exec(value);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`유효하지 않은 날짜입니다: ${String(value)}`);
  }
  return formatLocalDate(date);
}

export function addDateOnly(value: Date | string, amount: number, unit: string): string {
  const [year, month, day] = toDateOnly(value).split('-').map(Number);
  const base = new Date(year, month - 1, day, 12);
  const normalizedUnit = unit.toUpperCase();

  let result: Date;
  switch (normalizedUnit) {
    case 'D': result = addDays(base, amount); break;
    case 'W': result = addWeeks(base, amount); break;
    case 'Y': result = addYears(base, amount); break;
    default: result = addMonths(base, amount); break;
  }

  return formatLocalDate(result);
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
