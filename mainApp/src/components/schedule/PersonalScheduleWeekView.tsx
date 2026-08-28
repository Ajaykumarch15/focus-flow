import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Map as MapIcon } from 'lucide-react';
import { getTasksForDate, isSameDay, formatDayHeader } from '../../utils/personalTaskSchedule';
import { usePersonalTaskStore } from '../../store/usePersonalTaskStore';
import { useRoadmapStore } from '../../store/useRoadmapStore';
import type { Task } from '../../types';

const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };

function MiniTaskCard({ task, onOpen, roadmapTitle }: { task: Task; onOpen: () => void; roadmapTitle?: string }) {
  const priorityColor: Record<string, string> = {
    critical: 'bg-red-500',
    high: 'bg-orange-400',
    medium: 'bg-yellow-400',
    low: 'bg-emerald-400',
  };
  return (
    <button
      onClick={onOpen}
      className="w-full text-left p-2 rounded-lg bg-surface-800/60 hover:bg-surface-800 border border-surface-800 hover:border-surface-700 transition-colors group"
    >
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${priorityColor[task.priority] ?? 'bg-surface-500'}`} />
        <p className="text-xs font-medium text-surface-200 truncate group-hover:text-surface-50 transition-colors">{task.title}</p>
      </div>
      {roadmapTitle && (
        <div className="flex items-center gap-1 mt-1 ml-3.5">
          <MapIcon size={8} className="text-sky-400 flex-shrink-0" />
          <span className="text-[9px] text-sky-400/70 truncate">{roadmapTitle}</span>
        </div>
      )}
    </button>
  );
}

interface PersonalScheduleWeekViewProps {
  weekDates: Date[];
}

export function PersonalScheduleWeekView({ weekDates }: PersonalScheduleWeekViewProps) {
  const navigate = useNavigate();
  const { tasks } = usePersonalTaskStore();
  const { roadmaps } = useRoadmapStore();
  const today = useMemo(() => new Date(), []);

  const roadmapTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const rm of roadmaps) map.set(rm._id, rm.title);
    return map;
  }, [roadmaps]);

  const tasksByDate = useMemo(() => {
    const map = new Map<number, Task[]>();
    for (const d of weekDates) {
      map.set(d.getTime(), getTasksForDate(tasks, d));
    }
    return map;
  }, [tasks, weekDates]);

  return (
    <div className="grid grid-cols-7 gap-2">
      {weekDates.map((date) => {
        const dayTasks = tasksByDate.get(date.getTime()) ?? [];
        const isToday = isSameDay(date, today);
        const isPast = date < today && !isToday;

        return (
          <motion.div
            key={date.getTime()}
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className={`rounded-2xl border transition-colors min-h-[200px] flex flex-col ${
              isToday
                ? 'border-brand-500/40 bg-brand-500/5'
                : isPast
                  ? 'border-surface-800/50 bg-surface-900/30'
                  : 'border-surface-800 bg-surface-900'
            }`}
          >
            {/* Day header */}
            <div className={`px-3 py-2 border-b ${isToday ? 'border-brand-500/20' : 'border-surface-800'}`}>
              <p className={`text-xs font-semibold ${isToday ? 'text-brand-400' : isPast ? 'text-surface-500' : 'text-surface-300'}`}>
                {formatDayHeader(date)}
              </p>
              {isToday && (
                <span className="text-[9px] font-bold uppercase tracking-wider text-brand-400">Today</span>
              )}
            </div>

            {/* Tasks */}
            <div className="flex-1 p-2 space-y-1.5 overflow-y-auto">
              {dayTasks.length === 0 ? (
                <p className="text-[10px] text-surface-600 text-center mt-4">No tasks</p>
              ) : (
                dayTasks.map(task => (
                  <MiniTaskCard
                    key={task.id}
                    task={task}
                    onOpen={() => navigate(`/personal/tasks/${task.id}`)}
                    roadmapTitle={task.roadmapRef ? roadmapTitleMap.get(task.roadmapRef) : undefined}
                  />
                ))
              )}
            </div>

            {/* Task count */}
            {dayTasks.length > 0 && (
              <div className="px-3 py-1.5 border-t border-surface-800">
                <p className="text-[10px] text-surface-500 text-center">{dayTasks.length} task{dayTasks.length !== 1 ? 's' : ''}</p>
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
