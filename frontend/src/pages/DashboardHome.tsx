import { LayoutDashboard } from 'lucide-react';

export default function DashboardHome() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-100">
          <LayoutDashboard size={22} className="text-blue-500" />
          대시보드
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          추후 운영 지표, 알림, 요약 카드를 구성할 예정입니다.
        </p>
      </section>
    </div>
  );
}
