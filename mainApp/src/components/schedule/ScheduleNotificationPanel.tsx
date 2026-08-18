import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Clock, Rocket, X } from 'lucide-react';
import { useScheduleNotificationStore } from '../../store/useScheduleNotificationStore';
import { useScheduleStore } from '../../store/useScheduleStore';
import { useStore } from '../../store/useStore';
import { ScheduleNotification } from '../../types';
import { Button } from '../ui/Button';

function ScheduleNotificationItem({ notif, onDismiss, onStart, onPostpone }: {
  notif: ScheduleNotification;
  onDismiss: () => void;
  onStart: () => void;
  onPostpone: () => void;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(timer);
  }, []);

  const isFiveMin = notif.type === 'five-minute';
  const minutesUntil = Math.max(0, Math.ceil((notif.scheduledStartTime - now) / 60000));
  const timeLabel = isFiveMin ? (minutesUntil > 0 ? `Starts in ${minutesUntil} min` : 'Starting now') : 'Starting now';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="flex items-start gap-3 p-3 rounded-xl border border-surface-800 bg-surface-900/95 shadow-lg"
      role="alert"
      aria-live="assertive"
    >
      <div className={`mt-0.5 p-1.5 rounded-lg ${isFiveMin ? 'bg-amber-500/10 text-amber-400' : 'bg-brand-500/10 text-brand-400'}`}>
        {isFiveMin ? <Clock size={16} /> : <Rocket size={16} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-surface-50">{notif.taskTitle}</p>
        <p className="text-[11px] text-surface-400 mt-0.5">{timeLabel}</p>
        <div className="flex items-center gap-2 mt-2">
          <Button size="sm" onClick={onStart} className="text-xs px-2.5 py-1 h-auto">
            {isFiveMin ? 'Start Task' : 'Start Now'}
          </Button>
          <Button size="sm" variant="ghost" onClick={onPostpone} className="text-xs px-2 py-1 h-auto text-amber-400 hover:text-amber-300">
            Postpone 15m
          </Button>
          <Button size="sm" variant="ghost" onClick={onDismiss} className="text-xs px-2 py-1 h-auto text-surface-400">
            Dismiss
          </Button>
        </div>
      </div>
      <button onClick={onDismiss} className="text-surface-500 hover:text-surface-300 p-0.5" aria-label="Dismiss notification">
        <X size={14} />
      </button>
    </motion.div>
  );
}

export function ScheduleNotificationPanel() {
  const navigate = useNavigate();
  const { activeNotifications, dismissNotification, dismissAll, browserPermission, requestBrowserPermission } = useScheduleNotificationStore();
  const { tasks } = useStore();

  const handleStart = (notif: ScheduleNotification) => {
    // Find the task and navigate to focus mode with it
    const task = tasks.find(t => t.id === notif.taskId);
    if (task) {
      navigate('/focus', { state: { taskId: task.id } });
    } else {
      navigate('/schedule');
    }
    dismissNotification(notif.id);
  };

  const handlePostpone = async (notif: ScheduleNotification) => {
    const { updateSchedule, schedules } = useScheduleStore.getState();
    const target = schedules.find(s => s._id === notif.scheduleId);
    if (target) {
      const [h, m] = target.startTime.split(':').map(Number);
      const [eh, em] = target.endTime.split(':').map(Number);
      const startMins = h * 60 + m + 15;
      const endMins = eh * 60 + em + 15;

      const formatTime = (mins: number) => {
        const fh = Math.floor(mins / 60) % 24;
        const fm = mins % 60;
        return `${String(fh).padStart(2, '0')}:${String(fm).padStart(2, '0')}`;
      };

      await updateSchedule(target._id, {
        startTime: formatTime(startMins),
        endTime: formatTime(endMins),
      });
    }
    dismissNotification(notif.id);
  };

  if (activeNotifications.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] space-y-2" aria-label="Schedule notifications">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <Bell size={14} className="text-brand-400" />
          <span className="text-xs font-semibold text-surface-300">Notifications</span>
        </div>
        <div className="flex items-center gap-1">
          {browserPermission !== 'granted' && (
            <Button size="sm" variant="ghost" onClick={requestBrowserPermission} className="text-[10px] px-1.5 py-0.5 h-auto text-surface-500">
              Enable browser alerts
            </Button>
          )}
          {activeNotifications.length > 1 && (
            <Button size="sm" variant="ghost" onClick={dismissAll} className="text-[10px] px-1.5 py-0.5 h-auto text-surface-500">
              Clear all
            </Button>
          )}
        </div>
      </div>
      <AnimatePresence mode="popLayout">
        {activeNotifications.map((notif) => (
          <ScheduleNotificationItem
            key={notif.id}
            notif={notif}
            onDismiss={() => dismissNotification(notif.id)}
            onStart={() => handleStart(notif)}
            onPostpone={() => handlePostpone(notif)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
