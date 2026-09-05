import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckSquare, Users, Star, Bell } from 'lucide-react';
import { useCalendarStore } from '@worklog/services/useCalendarStore';

interface QuickCreatePopoverProps {
  open: boolean;
  date: string;
  startTime: string;
  onClose: () => void;
}

const OPTIONS = [
  { type: 'task' as const, label: 'Task', icon: CheckSquare, color: 'text-brand-400' },
  { type: 'meeting' as const, label: 'Meeting', icon: Users, color: 'text-blue-400' },
  { type: 'event' as const, label: 'Event', icon: Star, color: 'text-purple-400' },
  { type: 'reminder' as const, label: 'Reminder', icon: Bell, color: 'text-emerald-400' },
];

export function QuickCreatePopover({ open, date, startTime, onClose }: QuickCreatePopoverProps) {
  const { openModal } = useCalendarStore();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, onClose]);

  const handleSelect = (type: 'task' | 'meeting' | 'event' | 'reminder') => {
    const endHour = parseInt(startTime.split(':')[0], 10) + 1;
    const endTime = `${String(Math.min(endHour, 23)).padStart(2, '0')}:${startTime.split(':')[1] || '00'}`;
    openModal({ type, date, startTime, endTime });
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          initial={{ opacity: 0, scale: 0.95, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -4 }}
          transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="absolute z-30 bg-surface-900 border border-surface-800 rounded-xl shadow-xl p-2 min-w-[160px]"
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-surface-500 px-2 py-1">
            Create
          </p>
          {OPTIONS.map((opt) => (
            <button
              key={opt.type}
              type="button"
              onClick={() => handleSelect(opt.type)}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-semibold text-surface-200 hover:bg-surface-850 transition-colors text-left"
            >
              <opt.icon size={14} className={opt.color} />
              {opt.label}
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
