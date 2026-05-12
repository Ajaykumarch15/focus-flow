import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { useToastStore, Toast, ToastType } from '../../store/useToastStore';

// ── Per-type visual config ────────────────────────────────────────────────────
const CONFIG: Record<ToastType, {
  icon:    React.ElementType;
  iconCls: string;
  bar:     string;
  border:  string;
}> = {
  success: {
    icon:    CheckCircle,
    iconCls: 'text-emerald-400',
    bar:     'bg-emerald-400',
    border:  'border-emerald-400/25',
  },
  error: {
    icon:    AlertCircle,
    iconCls: 'text-red-400',
    bar:     'bg-red-400',
    border:  'border-red-400/25',
  },
  warning: {
    icon:    AlertTriangle,
    iconCls: 'text-yellow-400',
    bar:     'bg-yellow-400',
    border:  'border-yellow-400/25',
  },
  info: {
    icon:    Info,
    iconCls: 'text-brand-400',
    bar:     'bg-brand-400',
    border:  'border-brand-400/25',
  },
};

// ── Single toast card ─────────────────────────────────────────────────────────
function ToastCard({ toast }: { toast: Toast }) {
  const { removeToast } = useToastStore();
  const { icon: Icon, iconCls, bar, border } = CONFIG[toast.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0,  scale: 1    }}
      exit={{    opacity: 0, y: -8, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      className={`
        relative overflow-hidden w-80 max-w-[90vw]
        bg-surface-900 border ${border}
        rounded-xl shadow-2xl shadow-black/40
        flex items-start gap-3 p-4
      `}
    >
      {/* Coloured left accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${bar} rounded-l-xl`} />

      {/* Icon */}
      <Icon size={18} className={`${iconCls} flex-shrink-0 mt-0.5`} />

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white leading-snug">{toast.title}</p>
        {toast.message && (
          <p className="text-xs text-surface-400 mt-0.5 leading-relaxed">{toast.message}</p>
        )}
      </div>

      {/* Dismiss button */}
      <button
        onClick={() => removeToast(toast.id)}
        className="flex-shrink-0 p-1 rounded-lg text-surface-500 hover:text-white hover:bg-surface-700 transition-all"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>

      {/* Progress bar — shrinks over toast.duration ms */}
      <motion.div
        className={`absolute bottom-0 left-0 h-0.5 ${bar} opacity-40`}
        initial={{ width: '100%' }}
        animate={{ width: '0%'   }}
        transition={{ duration: toast.duration / 1000, ease: 'linear' }}
      />
    </motion.div>
  );
}

// ── Container — mount this once in AppLayout ──────────────────────────────────
export function ToastContainer() {
  const { toasts } = useToastStore();

  return (
    // Fixed bottom-right stack; above everything (z-50)
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 items-end pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          // pointer-events-auto re-enables clicks on individual cards
          <div key={t.id} className="pointer-events-auto">
            <ToastCard toast={t} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
