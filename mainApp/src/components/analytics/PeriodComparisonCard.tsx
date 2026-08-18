import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

export interface PeriodComparisonData {
  label: string;
  current: number;
  previous: number;
  currentLabel?: string;
  previousLabel?: string;
  positiveIsGood?: boolean;
  format?: (v: number) => string;
}

interface PeriodComparisonCardProps {
  title: string;
  current: number;
  previous: number;
  currentLabel?: string;
  previousLabel?: string;
  format?: (v: number) => string;
  positiveIsGood?: boolean;
  icon?: React.ReactNode;
  loading?: boolean;
}

function formatPct(v: number): string {
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
}

function formatDefault(v: number): string {
  return Math.round(v).toLocaleString();
}

export function PeriodComparisonCard({
  title,
  current,
  previous,
  currentLabel = 'This period',
  previousLabel = 'Previous',
  format = formatDefault,
  positiveIsGood = true,
  icon,
  loading = false,
}: PeriodComparisonCardProps) {

  if (loading) {
    return (
      <div className="rounded-2xl border border-surface-800 bg-surface-900 p-4">
        <div className="h-3.5 w-24 bg-surface-800 rounded animate-pulse mb-3" />
        <div className="h-7 w-16 bg-surface-800 rounded animate-pulse mb-3" />
        <div className="h-3 w-28 bg-surface-800 rounded animate-pulse" />
      </div>
    );
  }

  const diff = current - previous;
  const pct = previous > 0 ? ((diff / previous) * 100) : (current > 0 ? 100 : 0);
  const direction = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
  const isPositive = positiveIsGood ? diff >= 0 : diff <= 0;
  const hasPrevious = previous > 0 || current > 0;

  const arrow = direction === 'up'
    ? <ArrowUpRight size={14} className={isPositive ? 'text-emerald-400' : 'text-red-400'} />
    : direction === 'down'
      ? <ArrowDownRight size={14} className={isPositive ? 'text-emerald-400' : 'text-red-400'} />
      : <Minus size={14} className="text-surface-500" />;

  const trendColor = isPositive ? 'text-emerald-400' : 'text-red-400';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl border border-surface-800 bg-surface-900 p-4"
    >
      <div className="flex items-center gap-2 mb-2">
        {icon && <span className="text-surface-400">{icon}</span>}
        <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider">{title}</h3>
      </div>

      <p className="text-2xl font-bold text-surface-50 mb-1">
        {format(current)}
      </p>

      <p className="text-xs text-surface-500 mb-2">
        <span className="text-surface-300">{currentLabel}: {format(current)}</span>
      </p>

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-surface-800/60">
        {arrow}
        <span className={`text-sm font-semibold ${trendColor}`}>{formatPct(pct)}</span>
        <span className="text-xs text-surface-500">
          {direction === 'up' ? 'vs previous' : direction === 'down' ? 'vs previous' : 'no change'}
        </span>
      </div>

      {hasPrevious && (
        <p className="text-[11px] text-surface-500 mt-1">
          {previousLabel}: {format(previous)}
        </p>
      )}
    </motion.div>
  );
}
