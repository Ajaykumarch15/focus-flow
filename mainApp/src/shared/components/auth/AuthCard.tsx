import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';

interface AuthCardProps {
  title: string;
  subtitle: string;
  error?: string | null;
  children: ReactNode;
}

export function AuthCard({ title, subtitle, error, children }: AuthCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className="rounded-3xl border border-surface-800 bg-surface-900 p-7 sm:p-8
                 shadow-[0_10px_30px_-4px_rgba(15,23,42,0.06),0_4px_12px_-2px_rgba(15,23,42,0.03)]
                 dark:shadow-[0_16px_50px_-12px_rgba(0,0,0,0.6),0_0_40px_-18px_var(--color-brand-500)]"
    >
      <div className="mb-6 text-center">
        <h1 className="text-xl sm:text-2xl font-display font-extrabold tracking-tight text-surface-50">
          {title}
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-surface-400">{subtitle}</p>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          role="alert"
          aria-live="assertive"
          className="mb-5 flex items-start gap-2 rounded-xl border border-danger-500/20 bg-danger-500/10 p-3 text-xs font-medium leading-relaxed text-danger-600 dark:text-danger-400"
        >
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </motion.div>
      )}

      {children}
    </motion.div>
  );
}
