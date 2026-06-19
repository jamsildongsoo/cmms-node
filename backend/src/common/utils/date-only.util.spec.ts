import { addDateOnly, toDateOnly } from './date-only.util';

describe('date-only utilities', () => {
  it('keeps date-only values unchanged', () => {
    expect(toDateOnly('2026-06-10')).toBe('2026-06-10');
  });

  it('adds cycle units without ISO conversion', () => {
    expect(addDateOnly('2026-06-10', 1, 'D')).toBe('2026-06-11');
    expect(addDateOnly('2026-01-31', 1, 'M')).toBe('2026-02-28');
    expect(addDateOnly('2024-02-29', 1, 'Y')).toBe('2025-02-28');
  });
});
