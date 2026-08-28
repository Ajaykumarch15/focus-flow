import { useEffect } from 'react';
import { Calendar, ArrowRight, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useScheduleStore, getTodayDateString } from '../../store/useScheduleStore';
import { useStore } from '../../store/useStore';
import { Button } from '../ui/Button';
import { Task } from '../../types';
import { calculateScheduleMetrics, formatMinutes, getSchedulePlannedMinutes } from '../../utils/scheduleAnalytics';

export function TodayPlanWidget() {
  const navigate = useNavigate();
  const { schedules, fetchSchedules, openModal } = useScheduleStore();
  const { tasks } = useStore();
  const todayStr = getTodayDateString();

  useEffect(() => {
    void fetchSchedules({ date: todayStr });
  }, [todayStr]);

  const todaySchedules = schedules.filter((s) => s.date === todayStr && s.status !== 'cancelled');
  const metrics = calculateScheduleMetrics(todaySchedules);

  return (
    <section
      aria-labelledby="todays-plan-heading"
      className="card p-5 rounded-[22px] bg-surface-900/90 border border-surface-800/80 shadow-sm flex flex-col justify-between"
    >
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-brand-500/10 text-brand-400" aria-hidden="true">
              <Calendar size={16} />
            </div>
            <h3 id="todays-plan-heading" className="font-semibold text-surface-50 text-sm">
              Today&apos;s Plan
            </h3>
          </div>
          {todaySchedules.length > 0 && (
            <span className="text-xs text-surface-400 font-medium" aria-label={`${todaySchedules.length} tasks scheduled, total ${formatMinutes(metrics.plannedMinutes)} planned`}>
              {todaySchedules.length} scheduled · {formatMinutes(metrics.plannedMinutes)}
            </span>
          )}
        </div>

        {/* Content list or Empty state */}
        {todaySchedules.length === 0 ? (
          <div className="py-5 text-center space-y-3">
            <p className="text-xs text-surface-400">Nothing planned for today.</p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => openModal()}
              leftIcon={<Plus size={14} aria-hidden="true" />}
              className="text-xs"
              aria-label="Schedule a task for today"
            >
              Schedule something
            </Button>
          </div>
        ) : (
          <div className="space-y-2 my-2" role="list">
            {todaySchedules.slice(0, 4).map((item) => {
              const taskObj: Task | undefined =
                typeof item.taskId === 'object'
                  ? (item.taskId as Task)
                  : tasks.find((t) => t.id === item.taskId);
              const title = taskObj?.title || 'Scheduled Task';
              const plannedMins = getSchedulePlannedMinutes(item);

              return (
                <div
                  key={item._id}
                  role="listitem"
                  tabIndex={0}
                  onClick={() => navigate('/worklog/schedule')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate('/worklog/schedule');
                    }
                  }}
                  aria-label={`${title} scheduled at ${item.startTime}, planned duration ${formatMinutes(plannedMins)}`}
                  className="flex items-center justify-between p-2 rounded-xl bg-surface-950/60 hover:bg-surface-950 border border-surface-800/50 text-xs transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[11px] font-semibold text-brand-400 flex-shrink-0">
                      {item.startTime}
                    </span>
                    <span className="font-medium text-surface-200 truncate">
                      {title}
                    </span>
                  </div>
                  <span className="text-[11px] text-surface-400 flex-shrink-0 ml-2 font-medium">
                    {formatMinutes(plannedMins)}
                  </span>
                </div>
              );
            })}
            {todaySchedules.length > 4 && (
              <p className="text-[11px] text-center text-surface-400 pt-1">
                + {todaySchedules.length - 4} more scheduled task{todaySchedules.length - 4 > 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer Link */}
      <div className="pt-3 border-t border-surface-800/50 flex items-center justify-between">
        <button
          type="button"
          onClick={() => openModal()}
          aria-label="Schedule new task"
          className="text-xs font-semibold text-surface-400 hover:text-surface-100 flex items-center gap-1 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 rounded px-1"
        >
          <Plus size={14} aria-hidden="true" /> Schedule Task
        </button>
        <button
          type="button"
          onClick={() => navigate('/worklog/schedule')}
          aria-label="View full schedule page"
          className="text-xs font-semibold text-brand-400 hover:text-brand-300 flex items-center gap-1 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 rounded px-1"
        >
          View Schedule <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
