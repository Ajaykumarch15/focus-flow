import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, ArrowDown, Trash2, Clock } from 'lucide-react';
import { useScheduleStore } from '@worklog/services/useScheduleStore';
import { useStore } from '@worklog/services/useStore';
import { Button } from '@shared/components/ui/Button';
import { formatMinutes, getSchedulePlannedMinutes } from '@worklog/services/scheduleAnalytics';
import type { ScheduleItem } from '@shared/types';

interface RecoveryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  scheduledMinutes: number;
  totalWorkingMinutes: number;
}

const PRIORITY_ORDER: Record<string, number> = { low: 0, medium: 1, high: 2, urgent: 3 };

export function RecoveryDrawer({ isOpen, onClose, scheduledMinutes, totalWorkingMinutes }: RecoveryDrawerProps) {
  const { schedules, updateSchedule, deleteSchedule } = useScheduleStore();
  const tasks = useStore((s) => s.tasks);

  const overageMinutes = scheduledMinutes - totalWorkingMinutes;

  const daySchedules = useMemo(() => {
    const todayStr = (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();
    return schedules
      .filter((s) => s.date === todayStr && s.status !== 'cancelled')
      .sort((a, b) => {
        const aPri = PRIORITY_ORDER[getTaskPriority(a, tasks)] || 1;
        const bPri = PRIORITY_ORDER[getTaskPriority(b, tasks)] || 1;
        return aPri - bPri;
      });
  }, [schedules, tasks]);

  const suggestions = useMemo(() => {
    const result: { schedule: ScheduleItem; action: 'postpone' | 'remove'; reason: string; savedMinutes: number }[] = [];
    let recovered = 0;

    for (const schedule of daySchedules) {
      if (recovered >= overageMinutes) break;
      const planned = getSchedulePlannedMinutes(schedule);
      const priority = getTaskPriority(schedule, tasks);
      const taskTitle = getTaskTitle(schedule, tasks);

      if (priority === 'low') {
        result.push({
          schedule,
          action: 'remove',
          reason: `Low priority — remove "${taskTitle}" to free ${formatMinutes(planned)}`,
          savedMinutes: planned,
        });
        recovered += planned;
      } else if (priority === 'medium' && recovered < overageMinutes) {
        result.push({
          schedule,
          action: 'postpone',
          reason: `Medium priority — postpone "${taskTitle}" to tomorrow`,
          savedMinutes: planned,
        });
        recovered += planned;
      }
    }

    return result;
  }, [daySchedules, overageMinutes, tasks]);

  const handlePostpone = async (schedule: ScheduleItem) => {
    const [y, m, d] = schedule.date.split('-').map(Number);
    const dt = new Date(y, m - 1, d + 1);
    const tomorrow = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    await updateSchedule(schedule._id, { date: tomorrow });
  };

  const handleRemove = async (schedule: ScheduleItem) => {
    await deleteSchedule(schedule._id);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-surface-900 border border-surface-700 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 border-b border-surface-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                <AlertTriangle size={16} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-surface-100">Recovery Mode</h3>
                <p className="text-[10px] text-surface-400">
                  Over by {formatMinutes(overageMinutes)} — here's how to fix it
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-surface-400 hover:text-surface-200">
              <X size={18} />
            </button>
          </div>

          {/* Suggestions */}
          <div className="p-4 overflow-y-auto max-h-[60vh] space-y-2">
            {suggestions.length === 0 ? (
              <div className="text-center py-8 text-surface-400 text-xs">
                <Clock size={24} className="mx-auto mb-2 text-surface-500" />
                <p>No automatic suggestions available.</p>
                <p className="mt-1">Try manually postponing or removing lower-priority tasks.</p>
              </div>
            ) : (
              suggestions.map((sug) => (
                <div
                  key={sug.schedule._id}
                  className="p-3 bg-surface-950 border border-surface-800 rounded-xl flex items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-surface-300">{sug.reason}</p>
                    <p className="text-[10px] text-surface-500 mt-0.5">
                      {sug.schedule.startTime} – {sug.schedule.endTime} ({formatMinutes(sug.savedMinutes)})
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {sug.action === 'postpone' ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handlePostpone(sug.schedule)}
                        className="text-[10px] px-2 py-1 h-auto text-amber-400 hover:text-amber-300"
                      >
                        <ArrowDown size={12} className="mr-1" /> Tomorrow
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemove(sug.schedule)}
                        className="text-[10px] px-2 py-1 h-auto text-red-400 hover:text-red-300"
                      >
                        <Trash2 size={12} className="mr-1" /> Remove
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-surface-800 flex items-center justify-between">
            <p className="text-[10px] text-surface-500">
              {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''} available
            </p>
            <Button size="sm" onClick={onClose}>
              Done
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function getTaskPriority(schedule: ScheduleItem, tasks: any[]): string {
  if (typeof schedule.taskId === 'object' && schedule.taskId !== null) {
    return (schedule.taskId as any).priority || 'medium';
  }
  const task = tasks.find((t: any) => t.id === schedule.taskId);
  return task?.priority || 'medium';
}

function getTaskTitle(schedule: ScheduleItem, tasks: any[]): string {
  if (typeof schedule.taskId === 'object' && schedule.taskId !== null) {
    return (schedule.taskId as any).title || 'Untitled';
  }
  const task = tasks.find((t: any) => t.id === schedule.taskId);
  return task?.title || 'Untitled';
}
