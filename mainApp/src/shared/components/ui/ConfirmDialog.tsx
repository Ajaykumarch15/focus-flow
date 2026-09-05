import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { useStore } from '@worklog/services/useStore';
import { Button } from './Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { theme } = useStore();
  const isReducedMotion = theme?.reducedMotion;
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  // Focus trap & Escape key
  useEffect(() => {
    if (!isOpen) return;

    // Focus confirm button when opened
    setTimeout(() => {
      confirmButtonRef.current?.focus();
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

  const animationProps = isReducedMotion
    ? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, scale: 0.95, y: 10 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.95, y: 10 } };

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        onClick={onCancel}
      >
        <motion.div
          {...animationProps}
          transition={{ duration: 0.15 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md bg-surface-900 border border-surface-800 rounded-2xl shadow-2xl p-6 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl flex-shrink-0 ${
                  variant === 'danger'
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    : variant === 'warning'
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-brand-500/10 text-brand-400 border border-brand-500/20'
                }`}
              >
                <AlertTriangle size={20} aria-hidden="true" />
              </div>
              <h3 id="confirm-dialog-title" className="text-base font-bold text-surface-50">
                {title}
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
          <p id="confirm-dialog-desc" className="text-xs text-surface-300 mb-6 leading-relaxed">
            {message}
          </p>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              {cancelLabel}
            </Button>
            <Button
              ref={confirmButtonRef}
              type="button"
              variant={variant === 'danger' ? 'danger' : 'primary'}
              size="sm"
              onClick={onConfirm}
              className="focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              {confirmLabel}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
