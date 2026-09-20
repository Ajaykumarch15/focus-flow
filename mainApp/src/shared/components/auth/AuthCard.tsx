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
      className="rounded-2xl border border-surface-800/60 bg-surface-900/80 backdrop-blur-sm p-5 sm:p-6
                 shadow-[0_8px_24px_-6px_rgba(15,23,42,0.08)]"
                 
    >
      <div className="mb-5 text-center">
        <h1 className="text-lg sm:text-xl font-display font-extrabold tracking-tight text-surface-50">
          {title}
        </h1>
        <p className="mt-1 text-xs text-surface-400">{subtitle}</p>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          role="alert"
          aria-live="assertive"
          className="mb-4 flex items-start gap-2 rounded-xl border border-danger-500/20 bg-danger-500/10 p-3 text-xs font-medium leading-relaxed text-danger-600 dark:text-danger-400"
        >
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </motion.div>
      )}

      {children}
    </motion.div>
  );
}
