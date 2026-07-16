/* =========================================================================
   날짜/시각 단일 처리 모듈 — DB/전송=UTC, 화면=로컬(KST).
   ※ 날짜/시각의 표시·기본값·입력변환은 반드시 이 모듈만 사용한다.
      (raw `toISOString().split` / `replace('T',' ').substring` 직접 사용 금지)
   ========================================================================= */

const pad = (n: number) => String(n).padStart(2, '0');

/** 오늘 날짜 (로컬) — date-only 필드 기본값. 'YYYY-MM-DD' */
export function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 이번 달 (로컬) — 마감 년월 기본값. 'YYYYMM' */
export function thisMonthLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}`;
}

/** 현재 일시 (로컬) — datetime-local 입력 기본값. 'YYYY-MM-DDTHH:mm' */
export function nowLocalInput(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** UTC(또는 date) 값 → 화면 표시 'YYYY-MM-DD HH:mm' (로컬). 시각 포함 표시용. */
export function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** UTC(또는 date) 값 → 화면 표시 'YYYY-MM-DD' (로컬). 날짜만 표시용. */
export function formatDate(value?: string | null): string {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** date-only 값 → 'YYYY-MM-DD'. 시간대 변환 없이 날짜 부분만 사용한다. */
export function formatDateOnly(value?: string | null): string {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** UTC ISO → datetime-local 입력값 'YYYY-MM-DDTHH:mm' (로컬, 편집 로드용) */
export function utcToInput(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local 입력값(로컬) → UTC ISO (제출용) */
export function inputToUtc(localValue?: string | null): string | null {
  if (!localValue) return null;
  const d = new Date(localValue);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}
