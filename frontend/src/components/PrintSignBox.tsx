/**
 * 빈 수기 결재칸 (구매요청서·입고증·출고증 공통).
 * Approval.tsx 결재박스(`renderSignatureBox`)와 형식 통일(칸당 ~96px) — 단 라벨 없는 빈칸.
 * 2열 × 4행 = 8칸 고정. 화면에선 숨김(print:block).
 */
export default function PrintSignBox() {
  // 2열 × 4행 = 8칸
  const cells = Array.from({ length: 8 });
  return (
    <div className="hidden print:block mt-8 ml-auto" style={{ width: 'fit-content' }}>
      <div className="grid grid-cols-2 gap-0 border border-slate-700">
        {cells.map((_, i) => (
          <div
            key={i}
            className="w-24 h-16 border border-slate-400 bg-white"
          />
        ))}
      </div>
    </div>
  );
}
