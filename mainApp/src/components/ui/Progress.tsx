import { cn } from '../../lib/cn';

type ProgressTone = 'brand' | 'success' | 'warning' | 'danger';

const toneClasses: Record<ProgressTone, string> = {
  brand: 'bg-brand-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
};

interface ProgressProps {
  value: number;
  max?: number;
  tone?: ProgressTone;
  className?: string;
  barClassName?: string;
  ariaLabel?: string;
}

export function Progress({ value, max = 100, tone = 'brand', className, barClassName, ariaLabel }: ProgressProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-surface-800/70', className)}
    >
      <div
        className={cn('h-full rounded-full transition-all duration-500 ease-snappy', toneClasses[tone], barClassName)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
