import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Database, Download, RefreshCw, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { powerGenerationApi } from '../features/power-generation/power-generation.api';
import type { PowerGenerationMonthly } from '../features/power-generation/power-generation.types';
import { toastApiError } from '../utils/apiError';

function todayText(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return parts.replaceAll('-', '');
}

function formatMwh(value: number): string {
  return value.toLocaleString('ko-KR', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function toIsoDay(compactDay: string): string {
  return `${compactDay.slice(0, 4)}-${compactDay.slice(4, 6)}-${compactDay.slice(6, 8)}`;
}

export default function PowerGeneration() {
  const initialDay = todayText();
  const [tradingDay, setTradingDay] = useState(toIsoDay(initialDay));
  const [viewMonth, setViewMonth] = useState(`${initialDay.slice(0, 4)}-${initialDay.slice(4, 6)}`);
  const [monthly, setMonthly] = useState<PowerGenerationMonthly | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadMonth = async (month = viewMonth) => {
    try {
      setMonthly(await powerGenerationApi.getMonthly(month.replace('-', '')));
    } catch (error) {
      toastApiError(error, '월간 발전량을 불러오지 못했습니다.');
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadMonth(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleImport = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tradingDay)) {
      toast.error('거래일자를 YYYY-MM-DD 형식으로 입력해주세요.');
      return;
    }
    setIsLoading(true);
    try {
      const compactDay = tradingDay.replaceAll('-', '');
      const result = await powerGenerationApi.importDay(compactDay);
      const month = tradingDay.slice(0, 7);
      setViewMonth(month);
      await loadMonth(month);
      toast.success(
        `${result.tradingDay} 발전량 ${result.importedCount}건, ${formatMwh(result.totalMwh)} MWh를 저장했습니다.`,
      );
    } catch (error) {
      toastApiError(error, 'KPX 발전량을 가져오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const dailyAverage = useMemo(
    () => monthly?.dayCount ? monthly.monthlyTotalMwh / monthly.dayCount : 0,
    [monthly],
  );

  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Zap className="text-emerald-400" size={22} />
            <h1 className="text-xl font-bold text-slate-100">발전량 조회</h1>
          </div>
          <p className="text-xs text-slate-400">
            KPX 정산 계량 데이터를 월·일 합계로 조회합니다.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-800 bg-slate-900 p-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-slate-400">조회 기준월 (YYYY-MM)</span>
            <input
              type="month"
              value={viewMonth}
              onChange={(event) => {
                setViewMonth(event.target.value);
                void loadMonth(event.target.value);
              }}
              className="h-10 w-40 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm font-semibold text-slate-100 outline-none focus:border-emerald-500"
            />
          </label>
          <button
            type="button"
            onClick={() => void loadMonth()}
            className="flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-bold text-white transition hover:bg-emerald-500"
          >
            <RefreshCw size={15} />
            조회
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          icon={<Zap size={18} />}
          label={`${viewMonth.slice(0, 4)}년 ${viewMonth.slice(5, 7)}월 발전량`}
          value={`${formatMwh(monthly?.monthlyTotalMwh || 0)} MWh`}
        />
        <SummaryCard
          icon={<CalendarDays size={18} />}
          label="수집 일수 / 일평균"
          value={`${monthly?.dayCount || 0}일 / ${formatMwh(dailyAverage)} MWh`}
        />
        <SummaryCard
          icon={<Database size={18} />}
          label="저장된 시간 원자료"
          value={`${monthly?.daily.reduce((sum, row) => sum + row.hourCount, 0) || 0}건`}
        />
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-bold text-slate-200">일별 발전량 합계</h2>
          <span className="text-xs text-slate-500">{viewMonth}</span>
        </div>
        <div className="max-h-[350px] overflow-auto">
          <table className="w-full min-w-[620px] border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-800 text-slate-400">
              <tr>
                <th className="px-4 py-2.5 text-left">거래일자</th>
                <th className="px-4 py-2.5 text-right">시간 데이터</th>
                <th className="px-4 py-2.5 text-right">일 발전량(MWh)</th>
                <th className="px-4 py-2.5 text-center">상태</th>
              </tr>
            </thead>
            <tbody>
              {monthly?.daily.map((row) => {
                return (
                  <tr
                    key={row.tradingDay}
                    className="border-t border-slate-800 hover:bg-slate-800/60"
                  >
                    <td className="px-4 py-2.5 font-medium text-slate-200">{row.tradingDay}</td>
                    <td className="px-4 py-2.5 text-right text-slate-400">{row.hourCount}건</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-emerald-400">{formatMwh(row.totalMwh)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${row.hourCount === 24 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                        {row.hourCount === 24 ? '완료' : '부분'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!monthly?.daily.length && (
                <tr><td colSpan={4} className="py-12 text-center text-slate-500">해당 월에 저장된 발전량이 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-slate-200">누락·변경분 가져오기</h2>
            <p className="mt-1 text-xs text-slate-500">
              향후 자동 배치에서 누락되거나 KPX 값이 변경된 날짜만 다시 수집합니다. 기존 값은 중복 생성하지 않고 갱신됩니다.
            </p>
          </div>
          <div className="flex items-end gap-2">
            <label>
              <span className="mb-1 block text-[11px] font-semibold text-slate-400">거래일자 (YYYY-MM-DD)</span>
              <input
                type="date"
                value={tradingDay}
                onChange={(event) => setTradingDay(event.target.value)}
                className="h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none focus:border-emerald-500"
              />
            </label>
            <button
              type="button"
              onClick={() => void handleImport()}
              disabled={isLoading}
              className="flex h-10 items-center gap-2 rounded-lg border border-emerald-600 bg-emerald-600/10 px-4 text-xs font-bold text-emerald-400 transition hover:bg-emerald-600/20 disabled:cursor-wait disabled:opacity-60"
            >
              {isLoading ? <RefreshCw className="animate-spin" size={15} /> : <Download size={15} />}
              가져오기
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className="mb-2 flex items-center gap-2 text-emerald-400">
        {icon}
        <span className="text-[11px] font-semibold text-slate-400">{label}</span>
      </div>
      <div className="text-lg font-bold text-slate-100">{value}</div>
    </div>
  );
}
