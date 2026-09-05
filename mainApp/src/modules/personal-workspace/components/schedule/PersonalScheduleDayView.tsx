import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Clock, Calendar, CheckCircle2, Map as MapIcon } from 'lucide-react';
import { Card } from '@shared/components/ui/Card';
import { Badge } from '@shared/components/ui/Badge';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { usePersonalTaskStore } from '@personal/services/usePersonalTaskStore';
import { useRoadmapStore } from '@personal/services/useRoadmapStore';
import {
  getTodayTasks, getUpcomingTasks, getMissedTasks,
  formatScheduledDate, scheduledStateColor, getScheduledState,
} from '@personal/services/personalTaskSchedule';
import type { Task } from '@shared/types';

const fadeUp = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };

function TaskScheduleCard({ task, onOpen, onUnschedule, roadmapTitle }: { task: Task; onOpen: () => void; onUnschedule: () => void; roadmapTitle?: string }) {
  const state = getScheduledState(task);
  return (
    <motion.div variants={fadeUp}
      className={`p-4 rounded-2xl border transition-colors ${
        state === 'missed' ? 'border-red-500/30 bg-red-500/5 hover:border-red-500/50'
                           : 'border-surface-800 bg-surface-900 hover:border-surface-700'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <button onClick={onOpen} className="flex-1 min-w-0 text-left">
          <p className="font-medium text-surface-50 truncate">{task.title}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {task.scheduledDate && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${scheduledStateColor(state)}`}>
                {formatScheduledDate(task.scheduledDate)}
              </span>
            )}
            {roadmapTitle && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <MapIcon size={9} /> {roadmapTitle}
              </span>
            )}
            {task.priority && (
              <span className="text-[10px] text-surface-500">{task.priority}</span>
            )}
            {task.category && (
              <span className="text-[10px] text-surface-500">{task.category}</span>
            )}
          </div>
        </button>
        <button
          onClick={onUnschedule}
          className="p-1.5 rounded-lg text-surface-500 hover:text-surface-300 hover:bg-surface-800 transition-colors text-[10px]"
          title="Unschedule"
        >
          <Calendar size={13} />
        </button>
      </div>
    </motion.div>
  );
}

interface PersonalScheduleDayViewProps {
  selectedDate: Date;
}

export function PersonalScheduleDayView({ selectedDate }: PersonalScheduleDayViewProps) {
  const navigate = useNavigate();
  const { tasks, updateTask } = usePersonalTaskStore();
  const { roadmaps } = useRoadmapStore();

  const roadmapTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const rm of roadmaps) map.set(rm._id, rm.title);
    return map;
  }, [roadmaps]);

  const getRoadmapTitle = (task: Task) => task.roadmapRef ? roadmapTitleMap.get(task.roadmapRef) : undefined;

  const todayTasks = useMemo(() => getTodayTasks(tasks, selectedDate), [tasks, selectedDate]);
  const missedTasks = useMemo(() => getMissedTasks(tasks, selectedDate), [tasks, selectedDate]);
  const upcomingTasks = useMemo(() => getUpcomingTasks(tasks, selectedDate), [tasks, selectedDate]);
  const unscheduledTasks = useMemo(
    () => tasks.filter(t => !t.scheduledDate && t.status !== 'completed'),
    [tasks],
  );

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="flex items-center gap-4 text-xs text-surface-400">
        <span className="flex items-center gap-1.5"><Clock size={12} className="text-cyan-400" /> {todayTasks.length} today</span>
        <span className="flex items-center gap-1.5"><ArrowRight size={12} className="text-violet-400" /> {upcomingTasks.length} upcoming</span>
        {missedTasks.length > 0 && (
          <span className="flex items-center gap-1.5"><AlertTriangle size={12} className="text-red-400" /> {missedTasks.length} missed</span>
        )}
        <span className="flex items-center gap-1.5"><Calendar size={12} className="text-surface-500" /> {unscheduledTasks.length} unscheduled</span>
      </div>

      {/* Missed */}
      {missedTasks.length > 0 && (
        <motion.section variants={fadeUp} initial="hidden" animate="show" className="space-y-3">
          <h2 className="flex items-center gap-2.5 font-display font-bold text-surface-50 text-lg">
            <span className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <AlertTriangle size={14} />
            </span>
            Missed
            <Badge tone="danger">{missedTasks.length}</Badge>
          </h2>
          <div className="space-y-2">
            {missedTasks.map(task => (
              <TaskScheduleCard
                key={task.id}
                task={task}
                onOpen={() => navigate(`/personal/tasks/${task.id}`)}
                onUnschedule={() => updateTask(task.id, { scheduledDate: undefined })}
                roadmapTitle={getRoadmapTitle(task)}
              />
            ))}
          </div>
        </motion.section>
      )}

      {/* Today */}
      <motion.section variants={fadeUp} initial="hidden" animate="show" className="space-y-3">
        <h2 className="flex items-center gap-2.5 font-display font-bold text-surface-50 text-lg">
          <span className="w-8 h-8 rounded-xl bg-surface-900 border border-surface-800 flex items-center justify-center text-cyan-400">
            <Clock size={14} />
          </span>
          Today
          {todayTasks.length > 0 && <Badge tone="brand">{todayTasks.length}</Badge>}
        </h2>
        {todayTasks.length === 0 ? (
          <Card>
            <EmptyState
              icon={<CheckCircle2 size={26} className="text-cyan-400" />}
              title="Nothing scheduled for today"
              description="Use the + button to schedule tasks for today."
            />
          </Card>
        ) : (
          <div className="space-y-2">
            {todayTasks.map(task => (
              <TaskScheduleCard
                key={task.id}
                task={task}
                onOpen={() => navigate(`/personal/tasks/${task.id}`)}
                onUnschedule={() => updateTask(task.id, { scheduledDate: undefined })}
                roadmapTitle={getRoadmapTitle(task)}
              />
            ))}
          </div>
        )}
      </motion.section>

      {/* Upcoming */}
      <motion.section variants={fadeUp} initial="hidden" animate="show" className="space-y-3">
        <h2 className="flex items-center gap-2.5 font-display font-bold text-surface-50 text-lg">
          <span className="w-8 h-8 rounded-xl bg-surface-900 border border-surface-800 flex items-center justify-center text-violet-400">
            <ArrowRight size={14} />
          </span>
          Upcoming
          {upcomingTasks.length > 0 && <Badge tone="neutral">{upcomingTasks.length}</Badge>}
        </h2>
        {upcomingTasks.length === 0 ? (
          <Card>
            <EmptyState
              icon={<ArrowRight size={26} className="text-violet-400" />}
              title="Nothing upcoming"
              description="Schedule tasks for future dates to see them here."
            />
          </Card>
        ) : (
          <div className="space-y-2">
            {upcomingTasks.map(task => (
              <TaskScheduleCard
                key={task.id}
                task={task}
                onOpen={() => navigate(`/personal/tasks/${task.id}`)}
                onUnschedule={() => updateTask(task.id, { scheduledDate: undefined })}
                roadmapTitle={getRoadmapTitle(task)}
              />
            ))}
          </div>
        )}
      </motion.section>

      {/* Unscheduled */}
      {unscheduledTasks.length > 0 && (
        <motion.section variants={fadeUp} initial="hidden" animate="show" className="space-y-3">
          <h2 className="flex items-center gap-2.5 font-display font-bold text-surface-50 text-lg">
            <span className="w-8 h-8 rounded-xl bg-surface-900 border border-surface-800 flex items-center justify-center text-surface-400">
              <Calendar size={14} />
            </span>
            Unscheduled
            <Badge tone="neutral">{unscheduledTasks.length}</Badge>
          </h2>
          <div className="space-y-2">
            {unscheduledTasks.slice(0, 10).map(task => (
              <motion.div key={task.id} variants={fadeUp}
                className="p-4 rounded-2xl border border-dashed border-surface-800 bg-surface-900/50 hover:border-surface-700 transition-colors"
              >
                <button onClick={() => navigate(`/personal/tasks/${task.id}`)} className="w-full text-left">
                  <p className="font-medium text-surface-300 truncate text-sm">{task.title}</p>
                  {task.priority && <span className="text-[10px] text-surface-500 mt-0.5 block">{task.priority}</span>}
                </button>
              </motion.div>
            ))}
            {unscheduledTasks.length > 10 && (
              <p className="text-xs text-surface-500 text-center">+{unscheduledTasks.length - 10} more</p>
            )}
          </div>
        </motion.section>
      )}
    </div>
  );
}
