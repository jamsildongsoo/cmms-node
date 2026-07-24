import type { ReactNode } from 'react';

interface PrintWindowLayoutProps {
  printWindow: Window;
  children: ReactNode;
  contentClassName?: string;
}

/** 새 출력 창에서 공통으로 사용하는 단일 출력 버튼과 문서 영역. */
export default function PrintWindowLayout({
  printWindow,
  children,
  contentClassName = 'max-w-4xl',
}: PrintWindowLayoutProps) {
  return (
    <div className="min-h-screen bg-white p-6 text-black">
      <div className="no-print mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => printWindow.print()}
          className="rounded-md border-0 bg-blue-600 px-5 py-2 text-sm font-semibold text-white cursor-pointer"
        >
          출력
        </button>
      </div>
      <div className={`mx-auto ${contentClassName}`}>{children}</div>
    </div>
  );
}
