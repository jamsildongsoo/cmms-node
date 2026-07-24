interface OpenPrintWindowOptions {
  title: string;
  rootId: string;
  features?: string;
}

/**
 * React 문서 출력을 위한 새 창을 만들고 현재 앱의 스타일을 복사한다.
 * 호출부는 반환된 container에 createRoot(...).render(...)만 수행한다.
 */
export function openPrintWindow({
  title,
  rootId,
  features = 'width=1100,height=850',
}: OpenPrintWindowOptions): { printWindow: Window; container: HTMLElement } | null {
  const printWindow = window.open('', '_blank', features);
  if (!printWindow) return null;

  printWindow.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body><div id="${rootId}"></div></body></html>`,
  );
  printWindow.document.close();
  printWindow.document.documentElement.className = document.documentElement.className;
  document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
    printWindow.document.head.appendChild(node.cloneNode(true));
  });

  const container = printWindow.document.getElementById(rootId);
  if (!container) {
    printWindow.close();
    return null;
  }

  return { printWindow, container };
}
