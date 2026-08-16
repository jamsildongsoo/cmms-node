import { lazy, Suspense } from 'react';
import Header from '../components/Header';

const SystemAdmin = lazy(() => import('./SystemAdmin'));

export default function SystemShell() {
  return (
    <div className="flex flex-col bg-slate-950 h-screen text-slate-100 font-sans overflow-hidden">
      <Header />
      <main className="flex-1 overflow-y-auto p-6 md:p-8">
        <Suspense fallback={<div className="text-sm text-slate-400">화면을 불러오는 중입니다.</div>}>
          <SystemAdmin />
        </Suspense>
      </main>
    </div>
  );
}
