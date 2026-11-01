import { useEffect, useMemo, useState } from 'react';
import { BriefcaseBusiness, Clock3 } from 'lucide-react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { api } from '@shared/utils/api';
import { PageHeader } from '@shared/components/ui/PageHeader';
import { Card } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';

const PERIODS = [7, 30, 90] as const;
type Period = typeof PERIODS[number];
type Entry = { date: string; totalMs: number };

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function hoursLabel(ms: number) {
  const hours = ms / 3_600_000;
  if (hours < 1) return `${Math.round(ms / 60_000)}m`;
  return `${hours.toFixed(1)}h`;
}

export function OfficeWorkTimeAnalytics() {
  const [period, setPeriod] = useState<Period>(30);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const today = new Date();
    const fromDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    fromDate.setDate(fromDate.getDate() - (period - 1));
    setLoading(true);
    setError('');
    api.officeWorkTime.analytics(dateKey(fromDate), dateKey(today))
      .then((result) => { if (!cancelled) setEntries(result); })
      .catch((err) => { if (!cancelled) setError(err?.message || 'Could not load office time analytics'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [period]);

  const chartData = useMemo(() => {
    const byDate = new Map(entries.map((entry) => [entry.date, entry.totalMs]));
    const today = new Date();
    const first = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    first.setDate(first.getDate() - (period - 1));
    return Array.from({ length: period }, (_, index) => {
      const date = new Date(first);
      date.setDate(first.getDate() + index);
      const key = dateKey(date);
      return {
        date: key,
        day: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        hours: Math.round(((byDate.get(key) || 0) / 3_600_000) * 100) / 100,
      };
    });
  }, [entries, period]);

  const totalMs = chartData.reduce((sum, item) => sum + item.hours * 3_600_000, 0);
  const trackedDays = chartData.filter((item) => item.hours > 0).length;
  const averageMs = trackedDays ? totalMs / trackedDays : 0;

  return (
    <div className="mx-auto w-full max-w-6xl p-4 lg:p-6">
      <PageHeader title="Office Work Time" description="Your daily tracked office hours over time."
        icon={<BriefcaseBusiness size={20} className="text-emerald-400" />} iconColor="#10b981"
        actions={<div className="flex gap-1 rounded-xl border border-surface-800 bg-surface-900 p-1">
          {PERIODS.map((days) => <Button key={days} size="xs" variant={period === days ? 'secondary' : 'ghost'}
            onClick={() => setPeriod(days)} aria-pressed={period === days}>{days} days</Button>)}
        </div>} />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card className="p-4">
          <p className="text-xs font-medium text-surface-400">Total tracked</p>
          <p className="mt-1 font-mono text-2xl font-bold text-surface-100">{hoursLabel(totalMs)}</p>
          <p className="mt-1 text-xs text-surface-500">Across the last {period} days</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-surface-400">Daily average</p>
          <p className="mt-1 flex items-center gap-2 font-mono text-2xl font-bold text-surface-100"><Clock3 size={18} className="text-emerald-400" />{hoursLabel(averageMs)}</p>
          <p className="mt-1 text-xs text-surface-500">On {trackedDays} tracked {trackedDays === 1 ? 'day' : 'days'}</p>
        </Card>
      </div>

      <Card className="p-4 sm:p-6">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-surface-100">Daily office time</h2>
          <p className="mt-1 text-xs text-surface-400">Hours tracked each day</p>
        </div>
        {error ? <p role="alert" className="py-16 text-center text-sm text-red-400">{error}</p> : loading ?
          <div className="h-[300px] animate-pulse rounded-xl bg-surface-800/40" aria-label="Loading chart" /> :
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 2 }}>
                <CartesianGrid stroke="#334155" strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false}
                  interval={period === 7 ? 0 : period === 30 ? 4 : 13} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={38}
                  tickFormatter={(value: number) => `${value}h`} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, color: '#e2e8f0' }}
                  labelStyle={{ color: '#94a3b8' }} formatter={(value) => [`${Number(value).toFixed(2)} hours`, 'Office time']} />
                <Line type="monotone" dataKey="hours" stroke="#34d399" strokeWidth={3} dot={period === 7}
                  activeDot={{ r: 5, fill: '#34d399', stroke: '#0f172a', strokeWidth: 2 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>}
      </Card>
    </div>
  );
}
