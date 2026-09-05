import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@shared/utils/cn';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  hint?: string;
  className?: string;
}

export function EmptyState({ icon, title, description, action, hint, className }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}
    >
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-3xl bg-brand-500/10 blur-xl" aria-hidden="true" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-surface-800 bg-surface-900 text-surface-400 shadow-lg">
          {icon}
        </div>
      </div>
      <h3 className="mb-1.5 font-display text-base font-bold text-surface-50">{title}</h3>
      <p className="mb-6 max-w-sm text-sm leading-relaxed text-surface-400">{description}</p>
      {action && <div className="flex flex-col items-center gap-3 sm:flex-row">{action}</div>}
      {hint && <p className="mt-4 text-xs text-surface-500">{hint}</p>}
    </motion.div>
  );
}
