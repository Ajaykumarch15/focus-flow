import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Square, Trash2, Edit3, ExternalLink, Clock, CheckCircle2, AlertTriangle, Rocket, Timer, FastForward } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ScheduleItem, Task, DerivedScheduleState } from '../../types';
import { useStore } from '../../store/useStore';
import { useScheduleStore } from '../../store/useScheduleStore';
import { useActiveTimer } from '../../hooks/useActiveTimer';
import { Button } from '../ui/Button';
import { PRIORITY_CONFIG } from '../../utils/colors';
import { formatMinutes, getSchedulePlannedMinutes, timeToMinutes } from '../../utils/scheduleAnalytics';
import { deriveScheduleState, getMinutesUntilStart, getMinutesSinceStart } from '../../hooks/useScheduleEvaluator';

interface ScheduleCardProps {
  schedule: ScheduleItem;
  derivedState?: DerivedScheduleState;
}

/** State badge configuration */
const STATE_CONFIG: Record<DerivedScheduleState, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  'upcoming':        { label: 'Upcoming',    icon: <Clock size={12} />,          color: 'text-sky-400',    bg: 'bg-sky-500/10' },
  'starting-soon':   { label: 'Starting Soon', icon: <Timer size={12} />,         color: 'text-amber-400',  bg: 'bg-amber-500/10' },
  'ongoing':         { label: 'Ongoing',      icon: <Play size={12} />,           color: 'text-brand-400',  bg: 'bg-brand-500/10' },
  'completed':       { label: 'Completed',    icon: <CheckCircle2 size={12} />,   color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  'missed':          { label: 'Missed',       icon: <AlertTriangle size={12} />,  color: 'text-red-400',    bg: 'bg-red-500/10' },
};

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function ScheduleCard({ schedule, derivedState: derivedProp }: ScheduleCardProps) {
  const navigate = useNavigate();
  const { startTimer, pauseTimer, resumeTimer, stopTimer, completeTask, tasks } = useStore();
  const { openModal, deleteSchedule, updateSchedule } = useScheduleStore();
  const { activeTaskId, activeTimerState } = useActiveTimer();
  const [now, setNow] = useState(Date.now());
  const [showPostponeMenu, setShowPostponeMenu] = useState(false);

  // Live clock for countdown (every 30s for starting-soon, every 60s otherwise)
  useEffect(() => {
    const derived = derivedProp || deriveScheduleState(schedule, undefined, now);
    const interval = derived === 'starting-soon' ? 30_000 : 60_000;
    const timer = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(timer);
  }, [derivedProp, schedule._id]);

  // Resolve task
  const taskObj: Task | undefined =
    typeof schedule.taskId === 'object'
      ? (schedule.taskId as Task)
      : tasks.find((t) => t.id === schedule.taskId);

  const taskId = taskObj?.id || (typeof schedule.taskId === 'string' ? schedule.taskId : '');
  const taskTitle = taskObj?.title || 'Untitled Task';
  const taskColor = taskObj?.color || '#0ea5e9';
  const taskPriority = taskObj?.priority || 'medium';

  const isActive = activeTaskId === taskId;
  const isRunning = isActive && activeTimerState === 'running';
  const isPaused = isActive && activeTimerState === 'paused';

  // Derive state
  const derived = derivedProp || deriveScheduleState(schedule, taskObj, now);
  const stateConfig = STATE_CONFIG[derived];
  const priority = PRIORITY_CONFIG[taskPriority];

  // Time info
  const minutesUntil = getMinutesUntilStart(schedule, now);
  const minutesSince = getMinutesSinceStart(schedule, now);
  const plannedMins = getSchedulePlannedMinutes(schedule);
  const isStartingSoon = derived === 'starting-soon';
  const isOngoing = derived === 'ongoing';
  const isMissed = derived === 'missed';
  const isCompleted = derived === 'completed';

  // Countdown label
  let countdownLabel = '';
  if (isStartingSoon && minutesUntil > 0) {
    countdownLabel = `Starts in ${minutesUntil} min`;
  } else if (isStartingSoon && minutesUntil === 0) {
    countdownLabel = 'Starting now';
  } else if (isOngoing) {
    countdownLabel = `Started ${minutesSince} min ago`;
  } else if (isCompleted) {
    countdownLabel = 'Completed';
  } else if (isMissed) {
    countdownLabel = `Missed by ${minutesSince} min`;
  }

  // Handlers
  const handleTimerAction = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRunning) { await pauseTimer(taskId); }
    else if (isPaused) { await resumeTimer(taskId); }
    else { await startTimer(taskId); }
  };

  const handleStopTimer = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Stop working on "${taskTitle}"? Worked time will be preserved.`)) {
      await stopTimer(taskId);
    }
  };

  const handleStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/worklog/tasks/${taskId}`);
  };

  const handleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (taskObj && taskObj.status !== 'completed') {
      await completeTask(taskId);
    }
    if (schedule.status !== 'completed') {
      await updateSchedule(schedule._id, { status: 'completed' });
    }
  };

  const handleReschedule = (e: React.MouseEvent) => {
    e.stopPropagation();
    openModal(taskId, schedule);
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

  // Pulsing animation for starting-soon
  const pulseClass = isStartingSoon ? 'animate-pulse' : '';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className={`group relative flex items-center gap-3 p-3 rounded-xl border transition-all
        ${isStartingSoon ? 'border-amber-400/40 bg-amber-500/5 shadow-amber-500/5' : ''}
        ${isOngoing ? 'border-brand-400/30 bg-brand-500/5' : ''}
        ${isCompleted ? 'border-emerald-500/20 bg-emerald-500/5 opacity-70' : ''}
        ${isMissed ? 'border-red-500/30 bg-red-500/5' : ''}
        ${derived === 'upcoming' ? 'border-surface-800 bg-surface-900/60' : ''}
      `}
    >
      {/* Left accent bar */}
      <div className="w-1 h-full rounded-full flex-shrink-0 self-stretch" style={{ backgroundColor: taskColor }} />

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
          {/* State badge */}
          <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${stateConfig.color} ${stateConfig.bg} ${pulseClass}`}>
            {stateConfig.icon}
            {stateConfig.label}
          </span>

          {/* Priority badge */}
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${priority.color} ${priority.bg}`}>
            {priority.label}
          </span>

          {/* Countdown */}
          <span className="text-[10px] text-surface-400">{countdownLabel}</span>

          {/* Planned duration */}
          <span className="text-[10px] text-surface-500">Planned {formatMinutes(plannedMins)}</span>

          {/* Actual time when worked */}
          {schedule.actualTimeMs && schedule.actualTimeMs > 0 && (
            <span className="text-[10px] font-medium text-emerald-400/90">
              Worked {formatMinutes(Math.round(schedule.actualTimeMs / 60000))}
            </span>
          )}

          {/* Planned vs Actual Variance comparison */}
          {schedule.actualTimeMs && schedule.actualTimeMs > 0 && (
            (() => {
              const workedMins = Math.round(schedule.actualTimeMs / 60000);
              const diffMins = workedMins - plannedMins;
              if (diffMins === 0) return <span className="text-[10px] text-emerald-400">On plan</span>;
              return (
                <span className={`text-[10px] font-semibold ${diffMins > 0 ? 'text-amber-400' : 'text-sky-400'}`}>
                  {diffMins > 0 ? `+${diffMins}m over` : `${diffMins}m under`}
                </span>
              );
            })()
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity" data-no-nav>
        {(isStartingSoon || isOngoing || isMissed) && taskId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleStart}
            className="p-1.5 text-brand-400 hover:text-brand-300"
            title="Start task"
          >
            <Rocket size={14} />
          </Button>
        )}

        {isOngoing && taskId && (
          <>
            <Button variant="ghost" size="sm" onClick={handleTimerAction}
              className={`p-1.5 ${isRunning ? 'text-amber-400' : isPaused ? 'text-emerald-400' : 'text-surface-400'}`}
              title={isRunning ? 'Pause' : isPaused ? 'Resume' : 'Start timer'}>
              {isRunning ? <Pause size={14} /> : isPaused ? <Play size={14} /> : <Play size={14} />}
            </Button>
            {isRunning && (
              <Button variant="ghost" size="sm" onClick={handleStopTimer} className="p-1.5 text-surface-400 hover:text-red-400" title="Stop timer">
                <Square size={14} />
              </Button>
            )}
          </>
        )}

        {!isCompleted && (
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

        {!isCompleted && !isMissed && taskId && (
          <Button variant="ghost" size="sm" onClick={handleComplete}
            className="p-1.5 text-surface-400 hover:text-emerald-400" title="Mark complete">
            <CheckCircle2 size={14} />
          </Button>
        )}

        {isMissed && (
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
