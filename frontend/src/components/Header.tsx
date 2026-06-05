import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useThemeStore } from '../store/useThemeStore';
import axiosInstance from '../api/axios';
import { LogOut, Clock, RefreshCw, UserCheck, Sun, Moon, Building2 } from 'lucide-react';

interface PlantOption { id: string; name: string }

export default function Header() {
  const { user, timeRemaining, extendSession, logout, activePlantId, setActivePlantId } = useAuthStore();
  const isLightMode = useThemeStore((s) => s.isLight);
  const toggleTheme = useThemeStore((s) => s.toggle);

  // 멀티 권한자만 플랜트 셀렉터 — 플랜트 목록 로드
  const [plants, setPlants] = useState<PlantOption[]>([]);
  useEffect(() => {
    if (user?.multiPlant === 'Y') {
      axiosInstance.get('/mdm/plants')
        .then(res => setPlants(res.data || []))
        .catch(() => setPlants([]));
    }
  }, [user?.multiPlant]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 h-14 pr-5 flex items-center justify-between text-slate-300 shrink-0 select-none w-full z-50 print:hidden">
      {/* 좌측: 로고 + 시스템명 + 사용자 정보 */}
      <div className="flex items-center h-full">
        {/* 로고 영역 — 폭을 사이드바(w-56)와 동기화하여 우측 border-r이 사이드바 구분선과 일치 */}
        <div className="flex items-center gap-3 w-56 h-full px-5 border-r border-slate-800 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-extrabold text-sm shadow-md shadow-blue-900/40 shrink-0">
            K
          </div>
          <div className="leading-tight">
            <h1 className="text-sm font-extrabold text-slate-100 tracking-wide">설비관리시스템</h1>
            <span className="text-[10px] text-slate-500 font-semibold">한국플랜트서비스</span>
          </div>
        </div>
        {/* 로그인 사용자 정보 */}
        <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs text-slate-400 ml-5">
          <UserCheck size={13} className="text-blue-500" />
          <span className="font-semibold text-slate-200">[{user?.companyId}]</span>
          <span>{user?.name}</span>
          {user?.position && <span className="text-[10px] text-slate-500 font-medium">({user.position}/{user.title || '직책없음'})</span>}
          <span className="px-1.5 py-0.5 rounded bg-blue-950 text-blue-400 text-[9px] font-bold tracking-wider uppercase">
            {user?.roleId}
          </span>
        </div>

        {/* 플랜트: 멀티는 셀렉터, 비멀티는 라벨 */}
        <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs text-slate-400 ml-3">
          <Building2 size={13} className="text-emerald-500" />
          {user?.multiPlant === 'Y' ? (
            <select
              value={activePlantId || ''}
              onChange={(e) => setActivePlantId(e.target.value || null)}
              className="bg-transparent text-slate-200 outline-none border-0 font-semibold cursor-pointer"
            >
              <option value="">전체총괄</option>
              {plants.map(p => (
                <option key={p.id} value={p.id}>{p.id} — {p.name}</option>
              ))}
            </select>
          ) : (
            <span className="font-semibold text-slate-200">
              {user?.lastLoginPlantId || '전체'}
            </span>
          )}
        </div>
      </div>

      {/* 우측: 세션 + 테마 + 로그아웃 */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
          <Clock size={13} className="text-slate-500" />
          <span className="text-slate-400">세션:</span>
          <span className={`font-mono font-semibold ${timeRemaining < 180 ? 'text-rose-500' : 'text-slate-300'}`}>
            {formatTime(timeRemaining)}
          </span>
          <button
            onClick={extendSession}
            title="세션 시간 연장"
            className="ml-1 p-1 hover:bg-slate-800 rounded text-blue-400 hover:text-blue-300 transition-colors cursor-pointer outline-none border-0 bg-transparent"
          >
            <RefreshCw size={11} />
          </button>
        </div>

        <button
          onClick={toggleTheme}
          title={isLightMode ? "다크 모드로 전환" : "라이트 모드로 전환"}
          className="flex items-center justify-center p-2 bg-slate-950 hover:bg-slate-850 border border-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition-colors cursor-pointer outline-none"
        >
          {isLightMode ? <Moon size={13} /> : <Sun size={13} />}
        </button>

        <button
          onClick={logout}
          className="flex items-center gap-1.5 bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/40 hover:border-rose-900/60 text-rose-400 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors cursor-pointer outline-none"
        >
          <LogOut size={13} />
          로그아웃
        </button>
      </div>
    </header>
  );
}
