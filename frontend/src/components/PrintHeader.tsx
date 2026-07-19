import { useAuthStore } from '../store/useAuthStore';

/**
 * 인쇄 전용 공통 헤더 — 보안 워터마크(출처 추적). 모든 출력물 **필수**.
 * 회사·출력자·출력일시(YYYYMMDDhhmmss)를 상단 모서리에 고정(position:fixed)하여
 * **모든 페이지에 반복** 표기한다(작은 글씨 + 옅은 회색). 제목·양식은 각 문서가 담당.
 * 페이지마다 반복되도록 본문 상단 여백은 index.css @page margin-top으로 확보.
 */

interface PrintHeaderProps {
  /** 결재 연계 문서만 전달 — 좌측 끝에 업무참조로 표기(있을 때만). 보안 워터마크(우측)와 구분. */
  approvalNo?: string | null;
}

/** 출력일시: YYYYMMDD HH:MM:SS (로컬/KST 기준) */
function formatStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export default function PrintHeader({ approvalNo }: PrintHeaderProps) {
  const user = useAuthStore((s) => s.user);
  const stamp = formatStamp(new Date());

  // 첫 페이지만 상단에 출력 로그 표시 (브라우저 페이지 분할에 맡김)
  return (
    <div className="hidden print:flex print:justify-between print:items-center print:mb-2 print:text-[9px] print:text-slate-500 print:border-b print:border-slate-300 print:pb-1">
      <span>{approvalNo ? `결재: ${approvalNo}` : ''}</span>
      <div className="flex gap-4">
        <span>회사: {user?.companyName || user?.companyId || 'CMMS'}</span>
        <span>출력자: {user?.name || '-'}</span>
        <span>출력일시: {stamp}</span>
      </div>
    </div>
  );
}
