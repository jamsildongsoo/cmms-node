import type { ReactNode } from 'react';

/**
 * 전용 인쇄뷰 공통 헬퍼 (흑백 plain — 흰 배경·검정 텍스트, 색/테마 없음).
 * 화면엔 안 보이고, 부모 전용뷰가 `hidden print:block`으로 인쇄 시에만 노출한다.
 * 모양만 담당 — 어떤 필드/섹션을 넣을지는 각 문서 전용뷰가 인라인 조합.
 */

/** 라벨 섹션 (제목 + 하단 구분선) */
export function PrintSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="print-section mb-4">
      <h2 className="text-[11px] font-bold text-black border-b border-black pb-1 mb-2">{title}</h2>
      {children}
    </section>
  );
}

/** 라벨 + 값 1쌍 */
export function PrintField({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="text-[10px] leading-snug">
      <span className="text-gray-500">{label}</span>
      <div className="text-black">{value === null || value === undefined || value === '' ? '-' : value}</div>
    </div>
  );
}

/** 필드 그리드 (기본 3열) */
export function PrintFieldGrid({ cols = 3, children }: { cols?: number; children: ReactNode }) {
  return <div className="grid gap-x-4 gap-y-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>{children}</div>;
}

/** 표 (얇은 검정/회색 테두리, 회색 헤더) */
export function PrintTable({ columns, rows }: { columns: string[]; rows: ReactNode[][] }) {
  return (
    <table className="print-table w-full border-collapse text-[10px]">
      <thead>
        <tr>
          {columns.map((c, i) => (
            <th key={i} className="border border-gray-400 bg-gray-100 text-black p-1 text-left font-semibold">{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan={columns.length} className="border border-gray-300 text-gray-500 p-2 text-center">항목 없음</td></tr>
        ) : (
          rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((cell, ci) => (
                <td key={ci} className="border border-gray-300 text-black p-1 align-top">{cell}</td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
