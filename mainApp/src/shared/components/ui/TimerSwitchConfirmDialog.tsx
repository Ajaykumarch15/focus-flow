import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Pause, Play, Layers } from 'lucide-react';
import { Button } from './Button';

interface TimerSwitchConfirmDialogProps {
  isOpen: boolean;
  currentTaskTitle: string;
  newTaskTitle: string;
  onSwitchAndPause: () => void;   // Pause current, start new
  onRunParallel: () => void;      // Keep current running, also start new
  onCancel: () => void;
}

export function TimerSwitchConfirmDialog({
  isOpen,
  currentTaskTitle,
  newTaskTitle,
  onSwitchAndPause,
  onRunParallel,
  onCancel,
}: TimerSwitchConfirmDialogProps) {
  const parallelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Focus parallel button when opened (safer default)
    setTimeout(() => {
      parallelButtonRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="timer-switch-dialog-title"
        aria-describedby="timer-switch-dialog-desc"
        onClick={onCancel}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg bg-surface-900 border border-surface-800 rounded-2xl shadow-2xl p-6 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl flex-shrink-0 bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <AlertTriangle size={20} aria-hidden="true" />
              </div>
              <h3 id="timer-switch-dialog-title" className="text-base font-bold text-surface-50">
                Timer Already Running
              </h3>
            </div>
            <button
              type="button"
              onClick={onCancel}
              aria-label="Close dialog"
              className="p-1 rounded-lg text-surface-400 hover:text-surface-100 hover:bg-surface-800 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          {/* Description */}
          <p id="timer-switch-dialog-desc" className="text-xs text-surface-300 mb-6 leading-relaxed">
            You have a timer running on <span className="font-semibold text-surface-100">"{currentTaskTitle}"</span>.
            Would you like to start tracking <span className="font-semibold text-surface-100">"{newTaskTitle}"</span>?
          </p>

          {/* Timer Info */}
          <div className="bg-surface-800/50 rounded-xl p-3 mb-6 border border-surface-700">
            <div className="flex items-center gap-2 text-xs text-surface-400">
              <Layers size={14} />
              <span>You can run multiple timers in parallel</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={onSwitchAndPause}
              leftIcon={<Pause size={14} />}
              className="focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              Pause "{currentTaskTitle}"
            </Button>
            <Button
              ref={parallelButtonRef}
              type="button"
              variant="primary"
              size="sm"
              onClick={onRunParallel}
              leftIcon={<Play size={14} />}
              className="focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              Run in Parallel
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
