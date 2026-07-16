import Decimal from 'decimal.js';

// BigDecimal 대응 소수점 정밀도 28자리, 반올림 정책 HALF_UP 설정
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

/**
 * 금액/수치를 지정 소수자리 문자열로 안전 정규화.
 * null/빈값/비정상 입력은 0으로 처리(예외 없이) — 바디값 직삽입 방지용.
 */
export function toFixedSafe(value: string | number | null | undefined, dp: number): string {
  if (value === null || value === undefined || value === '') {
    return new Decimal(0).toFixed(dp);
  }
  try {
    return new Decimal(value.toString()).toFixed(dp);
  } catch {
    return new Decimal(0).toFixed(dp);
  }
}

/**
 * 이동평균단가(Moving Average Price) 계산
 * @param currentQty 현재 수량
 * @param currentAmount 현재 금액 (수량 * 단가)
 * @param inQty 입고 수량
 * @param inPrice 입고 단가
 */
export function calcMovingAverage(
  currentQty: string | number,
  currentAmount: string | number,
  inQty: string | number,
  inPrice: string | number,
): { newQty: Decimal; newAmount: Decimal; avgPrice: Decimal } {
  const cQty = new Decimal(currentQty.toString());
  const cAmt = new Decimal(currentAmount.toString());
  
  const addQty = new Decimal(inQty.toString());
  const addPrice = new Decimal(inPrice.toString());
  const addAmt = addQty.mul(addPrice);

  const newQty = cQty.add(addQty);
  const newAmount = cAmt.add(addAmt);
  
  // 수량이 0보다 큰 경우에만 나누기 수행, 그렇지 않으면 0
  const avgPrice = newQty.gt(0)
    ? newAmount.div(newQty).toDecimalPlaces(4)
    : new Decimal(0);

  return { newQty, newAmount, avgPrice };
}
