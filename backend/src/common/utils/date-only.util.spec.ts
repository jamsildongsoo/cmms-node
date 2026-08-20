import { addDateOnly, toDateOnly } from './date-only.util';

describe('date-only utilities', () => {
  // 날짜 전용 문자열은 시간대 변환 없이 날짜 부분만 유지해야 한다.
  it('keeps date-only values unchanged', () => {
    expect(toDateOnly('2026-06-10')).toBe('2026-06-10');
  });

  // 주기 계산 결과도 ISO 날짜 변환에 따른 전날/다음날 오차 없이 반환해야 한다.
  it('adds cycle units without ISO conversion', () => {
    // 일 단위 증가는 다음 날짜로 계산된다.
    expect(addDateOnly('2026-06-10', 1, 'D')).toBe('2026-06-11');

    // 월말 날짜에 한 달을 더하면 대상 월의 마지막 날짜로 보정된다.
    expect(addDateOnly('2026-01-31', 1, 'M')).toBe('2026-02-28');

    // 윤년의 2월 29일에 1년을 더하면 평년의 2월 28일로 보정된다.
    expect(addDateOnly('2024-02-29', 1, 'Y')).toBe('2025-02-28');
  });
});
