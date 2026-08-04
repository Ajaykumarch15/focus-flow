import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'bg-surface-800/70 text-surface-300',
  brand: 'bg-brand-500/10 text-brand-600 dark:text-brand-400',
  success: 'bg-success-500/10 text-success-600 dark:text-success-400',
  warning: 'bg-warning-500/10 text-warning-600 dark:text-warning-400',
  danger: 'bg-danger-500/10 text-danger-600 dark:text-danger-400',
  info: 'bg-info-500/10 text-info-600 dark:text-info-400',
};

interface BadgeProps {
  tone?: BadgeTone;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Badge({ tone = 'neutral', icon, className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
        toneClasses[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
