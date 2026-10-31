import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Clock, Rocket, X, Pause, CheckCircle2, TimerReset, CalendarClock } from 'lucide-react';
import { useScheduleNotificationStore } from '@worklog/services/useScheduleNotificationStore';
import { useScheduleStore } from '@worklog/services/useScheduleStore';
import { useStore } from '@worklog/services/useStore';
import { usePersonalTaskStore } from '@personal/services/usePersonalTaskStore';
import { ScheduleNotification, ScheduleItem } from '@shared/types';
import { Button } from '@shared/components/ui/Button';
import { timeToMinutes, formatMinutes } from '@worklog/services/scheduleAnalytics';
import { parallelTimerEngine } from '@worklog/services/parallelTimerEngine';

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Shared helpers for acting on a schedule notification */
function useScheduleActions() {
  const navigate = useNavigate();
  const { tasks: workTasks, startParallelTimer, pauseParallelTimer, resumeParallelTimer, completeTask: completeWorkTask } = useStore();
  const { tasks: personalTasks, completeTask: completePersonalTask } = usePersonalTaskStore();
  const { schedules } = useScheduleStore();

  const findSchedule = (id: string): ScheduleItem | undefined => schedules.find(s => s._id === id);
  const findTask = (taskId: string) => personalTasks.find(t => t.id === taskId) || workTasks.find(t => t.id === taskId);

  /** Idempotent start: starts the execution timer and stamps the schedule */
  const startSchedule = async (scheduleId: string) => {
    const schedule = useScheduleStore.getState().schedules.find(s => s._id === scheduleId);
    if (!schedule) return;
    const taskId = typeof schedule.taskId === 'object' && schedule.taskId !== null
      ? (schedule.taskId as { id?: string }).id || ''
      : (schedule.taskId as string) || '';
    if (!taskId) return;

    // Duplicate-start guard: repeated notification clicks / stale entries
    const active = parallelTimerEngine.getSnapshot(taskId);
    if (active && active.timerState !== 'idle') {
      // Already executing — just make sure the slot reflects it
      if (schedule.status === 'scheduled' || schedule.status === 'missed') {
        await useScheduleStore.getState().setScheduleExecution(schedule._id, {
          actualStartAt: Date.now(),
          status: 'in-progress',
        });
      }
      return;
    }

    await startParallelTimer(taskId).catch(() => { /* engine refuses duplicate starts — already executing */ });
    await useScheduleStore.getState().setScheduleExecution(schedule._id, {
      actualStartAt: Date.now(),
      status: 'in-progress',
    });
  };

  const snoozeSchedule = async (scheduleId: string, minutes: number) => {
    const target = schedules.find(s => s._id === scheduleId);
    if (!target) return;
    const newStart = timeToMinutes(target.startTime) + minutes;
    const newEnd = timeToMinutes(target.endTime) + minutes;
    await useScheduleStore.getState().updateSchedule(target._id, {
      startTime: minutesToTime(newStart),
      endTime: minutesToTime(newEnd),
    });
  };

  const skipSchedule = async (scheduleId: string) => {
    await useScheduleStore.getState().skipSchedule(scheduleId);
  };

  const completeSchedule = async (scheduleId: string, taskId: string) => {
    const task = findTask(taskId);
    const schedule = findSchedule(scheduleId);
    if (task && task.status !== 'completed') {
      if (task.workspaceContext === 'personal') {
        await completePersonalTask(task.id);
      } else {
        await completeWorkTask(task.id);
      }
    }
    if (schedule && schedule.status !== 'completed') {
      await useScheduleStore.getState().setScheduleExecution(schedule._id, {
        status: 'completed',
        actualEndAt: Date.now(),
      });
    }
  };

  const openExtendDialog = (scheduleId: string) => {
    useScheduleStore.getState().openExtendDialog(scheduleId);
    navigate('/worklog/schedule');
  };

  return {
    navigate,
    findSchedule,
    findTask,
    startSchedule,
    snoozeSchedule,
    skipSchedule,
    completeSchedule,
    openExtendDialog,
    pauseParallelTimer,
    resumeParallelTimer,
  };
}

function ScheduleNotificationItem({ notif, onDismiss, onStart, onSnooze, onSkip, onView, onExtend, onComplete }: {
  notif: ScheduleNotification;
  onDismiss: () => void;
  onStart: () => void;
  onSnooze: (mins: number) => void;
  onSkip: () => void;
  onView: () => void;
  onExtend: () => void;
  onComplete: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const [snoozeOpen, setSnoozeOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(timer);
  }, []);

  if (notif.type === 'overtime') {
    const overtimeMins = Math.max(0, Math.floor((now - (notif.scheduledEndTime ?? notif.scheduledStartTime)) / 60000));
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, x: 100, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="p-3 rounded-xl border border-amber-500/40 bg-amber-500/5 shadow-lg"
        role="alert"
        aria-live="assertive"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
            <TimerReset size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-200">Task Overtime — {notif.taskTitle}</p>
            <p className="text-[11px] text-surface-400 mt-0.5">
              Still running {overtimeMins > 0 ? `· ${overtimeMins} min past its scheduled end` : '· scheduled time reached'}
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Button size="sm" onClick={onExtend} className="text-xs px-2.5 py-1 h-auto">
                Extend Time
              </Button>
              <Button size="sm" variant="ghost" onClick={onComplete} className="text-xs px-2 py-1 h-auto text-emerald-400 hover:text-emerald-300">
                <CheckCircle2 size={12} /> Complete Task
              </Button>
              <Button size="sm" variant="ghost" onClick={onDismiss} className="text-xs px-2 py-1 h-auto text-surface-400">
                Continue without rescheduling
              </Button>
            </div>
          </div>
          <button onClick={onDismiss} className="text-amber-400/70 hover:text-amber-300 p-0.5" aria-label="Dismiss notification">
            <X size={14} />
          </button>
        </div>
      </motion.div>
    );
  }

  const isFiveMin = notif.type === 'five-minute';
  const minutesUntil = Math.max(0, Math.ceil((notif.scheduledStartTime - now) / 60000));
  const timeLabel = isFiveMin ? (minutesUntil > 0 ? `Starts in ${minutesUntil} min` : 'Starting now') : 'Starting now';
  const durationMins = Math.round(((notif.scheduledEndTime ?? notif.scheduledStartTime) - notif.scheduledStartTime) / 60000);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="p-3 rounded-xl border border-surface-800 bg-surface-900/95 shadow-lg"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 p-1.5 rounded-lg ${isFiveMin ? 'bg-amber-500/10 text-amber-400' : 'bg-brand-500/10 text-brand-400'}`}>
          {isFiveMin ? <Clock size={16} /> : <Rocket size={16} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-surface-50">Task Reminder — {notif.taskTitle}</p>
          <p className="text-[11px] text-surface-400 mt-0.5">{timeLabel}</p>
          {durationMins > 0 && (
            <p className="text-[10px] text-surface-500">Duration: {formatMinutes(durationMins)} · Ready to Start</p>
          )}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <Button size="sm" onClick={onStart} className="text-xs px-2.5 py-1 h-auto">
              Start Task
            </Button>
            <div className="relative">
              <Button size="sm" variant="ghost" onClick={() => setSnoozeOpen(!snoozeOpen)} className="text-xs px-2 py-1 h-auto text-amber-400 hover:text-amber-300">
                <Pause size={11} /> Snooze
              </Button>
              {snoozeOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 w-24 bg-surface-900 border border-surface-700 rounded-xl shadow-xl py-1 text-xs text-surface-200">
                  {[5, 10, 15].map(mins => (
                    <button
                      key={mins}
                      onClick={() => { setSnoozeOpen(false); onSnooze(mins); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-surface-800"
                    >
                      {mins} minutes
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button size="sm" variant="ghost" onClick={onSkip} className="text-xs px-2 py-1 h-auto text-surface-400 hover:text-red-400">
              Skip Task
            </Button>
            <Button size="sm" variant="ghost" onClick={onView} className="text-xs px-1.5 py-1 h-auto text-surface-500 hover:text-surface-300" title="View Schedule">
              <CalendarClock size={12} />
            </Button>
          </div>
        </div>
        <button onClick={onDismiss} className="text-surface-500 hover:text-surface-300 p-0.5" aria-label="Dismiss notification">
          <X size={14} />
        </button>
      </div>
    </motion.div>
  );
}

export function ScheduleNotificationPanel() {
  const {
    activeNotifications, dismissNotification, dismissAll,
    browserPermission, requestBrowserPermission,
  } = useScheduleNotificationStore();
  const actions = useScheduleActions();

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
            onStart={async () => {
              await actions.startSchedule(notif.scheduleId);
              dismissNotification(notif.id);
            }}
            onSnooze={async (mins) => {
              await actions.snoozeSchedule(notif.scheduleId, mins);
              dismissNotification(notif.id);
            }}
            onSkip={async () => {
              await actions.skipSchedule(notif.scheduleId);
              dismissNotification(notif.id);
            }}
            onView={() => {
              actions.navigate('/worklog/schedule');
              dismissNotification(notif.id);
            }}
            onExtend={async () => {
              await actions.openExtendDialog(notif.scheduleId);
              dismissNotification(notif.id);
            }}
            onComplete={async () => {
              await actions.completeSchedule(notif.scheduleId, notif.taskId);
              dismissNotification(notif.id);
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
