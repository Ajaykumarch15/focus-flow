import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Square, Trash2, Edit3, ExternalLink, Clock, CheckCircle2, AlertTriangle, Rocket, Timer, FastForward, Repeat, SkipForward, Flame } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ScheduleItem, Task, DerivedScheduleState } from '@shared/types';
import { useStore } from '@worklog/services/useStore';
import { usePersonalTaskStore } from '@personal/services/usePersonalTaskStore';
import { useScheduleStore } from '@worklog/services/useScheduleStore';
import { useActiveTimer } from '@shared/hooks/useActiveTimer';
import { Button } from '@shared/components/ui/Button';
import { PRIORITY_CONFIG } from '@shared/utils/colors';
import { formatMinutes, getSchedulePlannedMinutes, timeToMinutes } from '@worklog/services/scheduleAnalytics';
import { deriveScheduleState, getScheduleStartTimeMs, getScheduleEndTimeMs } from '@shared/hooks/useScheduleEvaluator';

interface ScheduleCardProps {
  schedule: ScheduleItem;
  derivedState?: DerivedScheduleState;
}

/**
 * Execution-aware visual state. Extends the time-derived state with the live
 * timer: Ready (start available), Running, Paused, Running Overtime, Skipped.
 */
export type ScheduleExecutionState =
  | DerivedScheduleState | 'ready' | 'running' | 'paused' | 'running-overtime' | 'skipped';

/** State badge configuration (accessible text label + icon + color) */
const STATE_CONFIG: Record<ScheduleExecutionState, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  'upcoming':        { label: 'Scheduled',     icon: <Clock size={12} />,             color: 'text-sky-400',    bg: 'bg-sky-500/10' },
  'starting-soon':   { label: 'Starting Soon', icon: <Timer size={12} />,             color: 'text-amber-400',  bg: 'bg-amber-500/10' },
  'ready':           { label: 'Ready',         icon: <Play size={12} />,              color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  'running':         { label: 'Running',       icon: <Play size={12} />,              color: 'text-brand-400',  bg: 'bg-brand-500/10' },
  'paused':          { label: 'Paused',        icon: <Pause size={12} />,             color: 'text-amber-400',  bg: 'bg-amber-500/10' },
  'running-overtime':{ label: 'Overtime',      icon: <Flame size={12} />,             color: 'text-red-400',    bg: 'bg-red-500/10' },
  'completed':       { label: 'Completed',     icon: <CheckCircle2 size={12} />,      color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  'skipped':         { label: 'Skipped',       icon: <SkipForward size={12} />,       color: 'text-surface-500', bg: 'bg-surface-800' },
  'missed':          { label: 'Missed',        icon: <AlertTriangle size={12} />,     color: 'text-red-400',    bg: 'bg-red-500/10' },
  'ongoing':         { label: 'Ongoing',       icon: <Play size={12} />,              color: 'text-brand-400',  bg: 'bg-brand-500/10' },
};

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatClock(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function ScheduleCard({ schedule, derivedState: derivedProp }: ScheduleCardProps) {
  const navigate = useNavigate();
  const { startParallelTimer, pauseParallelTimer, resumeParallelTimer, stopParallelTimer, tasks: workTasks } = useStore();
  const { completeTask: completeWorkTask } = useStore();
  const { tasks: personalTasks, completeTask: completePersonalTask } = usePersonalTaskStore();
  const {
    openModal,
    deleteSchedule,
    updateSchedule,
    setScheduleExecution,
    openExtendDialog,
    skipSchedule,
  } = useScheduleStore();
  const { activeTaskId, activeTimerState, elapsedMs, display: activeDisplay } = useActiveTimer();
  const [now, setNow] = useState(Date.now());
  const [showPostponeMenu, setShowPostponeMenu] = useState(false);

  // Resolve task (check personal tasks first, then work tasks)
  const taskObj: Task | undefined =
    typeof schedule.taskId === 'object'
      ? (schedule.taskId as Task)
      : personalTasks.find((t) => t.id === schedule.taskId) || workTasks.find((t) => t.id === schedule.taskId);

  const isPersonalTask = taskObj?.workspaceContext === 'personal';
  const taskId = taskObj?.id || (typeof schedule.taskId === 'string' ? schedule.taskId : '');
  const taskTitle = taskObj?.title || 'Untitled Task';
  const taskColor = taskObj?.color || '#0ea5e9';
  const taskPriority = taskObj?.priority || 'medium';

  const isActive = activeTaskId === taskId && activeTimerState !== 'idle' && activeTimerState !== undefined;
  const isRunning = isActive && activeTimerState === 'running';
  const isPaused = isActive && activeTimerState === 'paused';

  // Live clock: 1s while executing (live remaining/progress), otherwise 30s/60s
  useEffect(() => {
    const interval = isActive ? 1000 : derivedProp === 'starting-soon' ? 30_000 : 60_000;
    const timer = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(timer);
  }, [isActive, derivedProp, schedule._id]);

  // Derive state
  const derived = derivedProp || deriveScheduleState(schedule, taskObj, now);
  const startMs = getScheduleStartTimeMs(schedule);
  const endMs = getScheduleEndTimeMs(schedule);
  const isPastEnd = now > endMs;

  // Execution-aware visual state
  let execState: ScheduleExecutionState = derived;
  if (schedule.status === 'skipped') {
    execState = 'skipped';
  } else if (isActive) {
    execState = isRunning && isPastEnd ? 'running-overtime' : isPaused ? 'paused' : 'running';
  } else if (derived === 'ongoing') {
    execState = 'ready';
  }

  const stateConfig = STATE_CONFIG[execState];
  const priority = PRIORITY_CONFIG[taskPriority];

  // Time info
  const plannedMins = getSchedulePlannedMinutes(schedule);
  const isFinished = execState === 'completed';
  const activeMs = isActive ? Math.max(0, elapsedMs) : 0;
  const overtimeMs = Math.max(0, now - endMs);
  const remainingMins = Math.max(0, Math.ceil((endMs - now) / 60000));
  const progressPct = plannedMins > 0
    ? Math.min(100, Math.round((activeMs / (plannedMins * 60_000)) * 100))
    : 0;

  const showProgressBar = isActive || (schedule.actualTimeMs ?? 0) > 0;
  const barPct = isActive ? progressPct
    : scheduledBarPct(schedule);

  function scheduledBarPct(s: ScheduleItem): number {
    const total = getSchedulePlannedMinutes(s);
    if (total <= 0) return 0;
    const worked = Math.round((s.actualTimeMs || 0) / 60000);
    return Math.min(100, Math.round((worked / total) * 100));
  }

  // Countdown label
  let countdownLabel = '';
  switch (execState) {
    case 'starting-soon':
      countdownLabel = now < startMs ? `Starts in ${Math.ceil((startMs - now) / 60000)} min` : 'Starting now';
      break;
    case 'ready':
      countdownLabel = 'Ready to start';
      break;
    case 'running':
      countdownLabel = `Remaining scheduled ${remainingMins} min`;
      break;
    case 'paused':
      countdownLabel = 'Paused';
      break;
    case 'running-overtime':
      countdownLabel = `Overtime ${Math.floor(overtimeMs / 60000)} min`;
      break;
    case 'completed':
      countdownLabel = 'Completed';
      break;
    case 'skipped':
      countdownLabel = 'Skipped';
      break;
    case 'missed':
      countdownLabel = `Missed by ${Math.floor((now - endMs) / 60000)} min`;
      break;
    default:
      countdownLabel = '';
  }

  // Handlers
  const handleStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/worklog/tasks/${taskId}`);
  };

  const handleStartExecution = async () => {
    if (!taskId) return;
    await startParallelTimer(taskId).catch(() => { /* already running elsewhere */ });
    await setScheduleExecution(schedule._id, { actualStartAt: Date.now(), status: 'in-progress' });
  };

  const handleTimerAction = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRunning) { pauseParallelTimer(taskId); }
    else if (isPaused) { await resumeParallelTimer(taskId); }
    else { await handleStartExecution(); }
  };

  const handleStopTimer = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Stop working on "${taskTitle}"? Worked time will be preserved.`)) {
      await stopParallelTimer(taskId);
    }
  };

  const handleSkip = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Skip "${taskTitle}" for ${schedule.date}?`)) {
      await skipSchedule(schedule._id);
    }
  };

  const handleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    // 1) Stop the execution timer (persists the session + actual worked time)
    if (isActive) {
      await stopParallelTimer(taskId);
    }
    // 2) Complete task + schedule, stamping the completion timestamp
    if (taskObj && taskObj.status !== 'completed') {
      if (isPersonalTask) {
        await completePersonalTask(taskId);
      } else {
        await completeWorkTask(taskId);
      }
    }
    if (schedule.status !== 'completed') {
      await setScheduleExecution(schedule._id, {
        status: 'completed',
        actualEndAt: Date.now(),
      });
    }
  };

  const handleReschedule = (e: React.MouseEvent) => {
    e.stopPropagation();
    openModal(taskId, schedule);
  };

  const handleExtend = (e: React.MouseEvent) => {
    e.stopPropagation();
    openExtendDialog(schedule._id);
  };

  const handlePostponeMinutes = async (minsToAdd: number) => {
    setShowPostponeMenu(false);
    const startMins = timeToMinutes(schedule.startTime);
    const endMins = timeToMinutes(schedule.endTime);
    const duration = endMins > startMins ? endMins - startMins : 60;

    const newStart = startMins + minsToAdd;
    const newEnd = newStart + duration;

    await updateSchedule(schedule._id, {
      startTime: minutesToTime(newStart),
      endTime: minutesToTime(newEnd),
    });
  };

  const handlePostponeTomorrow = async () => {
    setShowPostponeMenu(false);
    const [y, m, d] = schedule.date.split('-').map(Number);
    const dt = new Date(y, m - 1, d + 1);
    const tomorrowStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

    await updateSchedule(schedule._id, {
      date: tomorrowStr,
    });
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to remove the schedule for "${taskTitle}"?`)) {
      await deleteSchedule(schedule._id);
    }
  };

  // Pulsing animation for starting-soon / running / overtime
  const pulseClass = (execState === 'starting-soon' || execState === 'running' || execState === 'running-overtime') ? 'animate-pulse' : '';

  // Card styling per execution state
  const cardTone =
    execState === 'starting-soon' ? 'border-amber-400/40 bg-amber-500/5 shadow-amber-500/5'
    : execState === 'running' ? 'border-brand-400/40 bg-brand-500/5 shadow-brand-500/10'
    : execState === 'running-overtime' ? 'border-red-500/40 bg-red-500/5 shadow-red-500/10'
    : execState === 'paused' ? 'border-amber-400/30 bg-amber-500/5'
    : execState === 'ready' ? 'border-emerald-500/30 bg-emerald-500/5'
    : execState === 'completed' ? 'border-emerald-500/20 bg-emerald-500/5 opacity-70'
    : execState === 'skipped' ? 'border-surface-800 bg-surface-900/40 opacity-60'
    : execState === 'missed' ? 'border-red-500/30 bg-red-500/5'
    : 'border-surface-800 bg-surface-900/60';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className={`group relative flex items-center gap-3 p-3 rounded-xl border transition-all ${cardTone}`}
    >
      {/* Left accent bar */}
      <div className="w-1 h-full rounded-full flex-shrink-0 self-stretch transition-colors" style={{ backgroundColor: taskColor }} />

      {/* Time column */}
      <div className="flex-shrink-0 w-16 text-center">
        <p className="text-sm font-bold text-surface-200">{schedule.startTime}</p>
        <p className="text-[10px] text-surface-500">{schedule.endTime}</p>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 bg-current ${priority.color}`} />
          <h4 className="text-sm font-semibold text-surface-100 truncate">{taskTitle}</h4>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* State badge (icon + accessible text label) */}
          <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${stateConfig.color} ${stateConfig.bg} ${pulseClass}`}>
            {stateConfig.icon}
            {stateConfig.label}
          </span>

          {/* Priority badge */}
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${priority.color} ${priority.bg}`}>
            {priority.label}
          </span>

          {/* Recurrence badge */}
          {schedule.recurrence && schedule.recurrence !== 'none' && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400">
              <Repeat size={10} />
              {schedule.recurrence === 'daily' ? 'Daily' : schedule.recurrence === 'weekly' ? 'Weekly' : 'Custom'}
            </span>
          )}

          {/* Countdown / execution info */}
          <span className="text-[10px] text-surface-400">{countdownLabel}</span>

          {/* Planned duration */}
          <span className="text-[10px] text-surface-500">Planned {formatMinutes(plannedMins)}</span>

          {/* Actual started time */}
          {schedule.actualStartAt && !isFinished && (
            <span className="text-[10px] text-surface-500">Started {formatClock(schedule.actualStartAt)}</span>
          )}

          {/* Running: live elapsed + remaining + progress */}
          {isActive && (
            <>
              <span className="text-[10px] font-semibold text-brand-400 tabular-nums">
                Elapsed {activeDisplay}
              </span>
              {execState === 'running' && (
                <span className="text-[10px] text-surface-400 tabular-nums">
                  Left {remainingMins}m
                </span>
              )}
              {execState === 'running-overtime' && (
                <span className="text-[10px] font-semibold text-red-400 tabular-nums">
                  +{Math.floor(overtimeMs / 60000)}m over
                </span>
              )}
            </>
          )}

          {/* Actual vs planned variance for finished slots */}
          {!isActive && (schedule.actualTimeMs ?? 0) > 0 && (() => {
            const workedMins = Math.round((schedule.actualTimeMs || 0) / 60000);
            const diffMins = workedMins - plannedMins;
            if (diffMins === 0) return <span className="text-[10px] text-emerald-400">On plan</span>;
            return (
              <span className={`text-[10px] font-semibold ${diffMins > 0 ? 'text-amber-400' : 'text-sky-400'}`}>
                {diffMins > 0 ? `+${diffMins}m over` : `${diffMins}m under`}
              </span>
            );
          })()}

          {/* Lock indicator */}
          {schedule.locked && (
            <span className="text-[10px] font-medium text-amber-300/80" title="Locked slot — rescheduling will not move it">🔒 Fixed</span>
          )}
        </div>

        {/* Animated progress bar (execution + worked time) */}
        {showProgressBar && (
          <div className="mt-1.5 flex items-center gap-2" aria-label={`Progress ${barPct}%`}>
            <div className="flex-1 h-1.5 rounded-full bg-surface-800 overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${execState === 'running-overtime' ? 'bg-red-400' : execState === 'completed' ? 'bg-emerald-400' : 'bg-brand-400'}`}
                initial={{ width: 0 }}
                animate={{ width: `${barPct}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
            <span className="text-[9px] text-surface-500 tabular-nums">{barPct}%</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity" data-no-nav>
        {(execState === 'ready' || execState === 'missed') && taskId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleStartExecution}
            className="p-1.5 text-emerald-400 hover:text-emerald-300"
            title="Start working on this task"
          >
            <Play size={14} />
          </Button>
        )}

        {(execState === 'ready' || execState === 'missed') && taskId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            className="p-1.5 text-surface-500 hover:text-red-400"
            title="Skip this task"
          >
            <SkipForward size={13} />
          </Button>
        )}

        {(execState === 'ready' || execState === 'upcoming' || execState === 'missed' || execState === 'skipped') && taskId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleStart}
            className="p-1.5 text-brand-400 hover:text-brand-300"
            title="Open in focus mode"
          >
            <Rocket size={14} />
          </Button>
        )}

        {/* Live pause/resume for executable states */}
        {(execState === 'running' || execState === 'paused' || execState === 'running-overtime') && taskId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={execState === 'paused' ? handleTimerAction : (e) => { e.stopPropagation(); pauseParallelTimer(taskId); }}
            className={`p-1.5 ${execState === 'paused' ? 'text-emerald-400' : 'text-amber-400'}`}
            title={execState === 'paused' ? 'Resume' : 'Pause'}
          >
            {execState === 'paused' ? <Play size={14} /> : <Pause size={14} />}
          </Button>
        )}

        {/* Complete */}
        {execState !== 'completed' && execState !== 'skipped' && taskId && (
          <Button variant="ghost" size="sm" onClick={handleComplete}
            className="p-1.5 text-surface-400 hover:text-emerald-400" title="Complete task">
            <CheckCircle2 size={14} />
          </Button>
        )}

        {/* Extend time (running / overtime / paused) */}
        {(execState === 'running' || execState === 'running-overtime' || execState === 'paused') && (
          <Button variant="ghost" size="sm" onClick={handleExtend}
            className="p-1.5 text-amber-400 hover:text-amber-300" title="Extend time slot">
            <FastForward size={14} />
          </Button>
        )}

        {/* Stop timer (running only) */}
        {isRunning && taskId && (
          <Button variant="ghost" size="sm" onClick={handleStopTimer} className="p-1.5 text-surface-400 hover:text-red-400" title="Stop timer">
            <Square size={14} />
          </Button>
        )}

        {!isFinished && execState !== 'skipped' && (
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.stopPropagation(); setShowPostponeMenu(!showPostponeMenu); }}
              className="p-1.5 text-surface-400 hover:text-amber-400"
              title="Postpone"
            >
              <FastForward size={14} />
            </Button>

            {showPostponeMenu && (
              <div className="absolute right-0 top-full mt-1 z-30 w-36 bg-surface-900 border border-surface-700 rounded-xl shadow-xl py-1 text-xs text-surface-200">
                <button onClick={() => handlePostponeMinutes(15)} className="w-full text-left px-3 py-1.5 hover:bg-surface-800 flex items-center justify-between">
                  +15 min
                </button>
                <button onClick={() => handlePostponeMinutes(30)} className="w-full text-left px-3 py-1.5 hover:bg-surface-800 flex items-center justify-between">
                  +30 min
                </button>
                <button onClick={() => handlePostponeMinutes(60)} className="w-full text-left px-3 py-1.5 hover:bg-surface-800 flex items-center justify-between">
                  +1 hour
                </button>
                <button onClick={handlePostponeTomorrow} className="w-full text-left px-3 py-1.5 hover:bg-surface-800 flex items-center justify-between border-t border-surface-800">
                  Tomorrow
                </button>
              </div>
            )}
          </div>
        )}

        {(execState === 'missed' || execState === 'skipped') && (
          <Button variant="ghost" size="sm" onClick={handleReschedule}
            className="p-1.5 text-surface-400 hover:text-sky-400" title="Reschedule">
            <Clock size={14} />
          </Button>
        )}

        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openModal(taskId, schedule); }}
          className="p-1.5 text-surface-400 hover:text-surface-200" title="Edit schedule">
          <Edit3 size={14} />
        </Button>

        {taskId && (
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/worklog/tasks/${taskId}`); }}
            className="p-1.5 text-surface-500 hover:text-surface-300" title="View task">
            <ExternalLink size={14} />
          </Button>
        )}

        <Button variant="ghost" size="sm" onClick={handleDelete}
          className="p-1.5 text-surface-500 hover:text-red-400" title="Delete schedule">
          <Trash2 size={14} />
        </Button>
      </div>
    </motion.div>
  );
}
