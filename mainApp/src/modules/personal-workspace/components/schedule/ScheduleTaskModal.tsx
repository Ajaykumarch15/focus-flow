import { useState, useMemo } from 'react';
import { Calendar, X, Map as MapIcon } from 'lucide-react';
import { Dialog } from '@shared/components/ui/Dialog';
import { Button } from '@shared/components/ui/Button';
import { Badge } from '@shared/components/ui/Badge';
import { usePersonalTaskStore } from '@personal/services/usePersonalTaskStore';
import { useRoadmapStore } from '@personal/services/useRoadmapStore';
import { getScheduledState, scheduledStateLabel, todayKey } from '@personal/services/personalTaskSchedule';

interface ScheduleTaskModalProps {
  open: boolean;
  onClose: () => void;
}

export function ScheduleTaskModal({ open, onClose }: ScheduleTaskModalProps) {
  const { tasks, updateTask } = usePersonalTaskStore();
  const { roadmaps } = useRoadmapStore();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [dateValue, setDateValue] = useState(todayKey());
  const [tab, setTab] = useState<'schedule' | 'unschedule'>('schedule');

  const roadmapTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const rm of roadmaps) map.set(rm._id, rm.title);
    return map;
  }, [roadmaps]);

  const unscheduledTasks = useMemo(
    () => tasks.filter(t => !t.scheduledDate && t.status !== 'completed'),
    [tasks],
  );

  const scheduledTasks = useMemo(
    () => tasks.filter(t => t.scheduledDate && t.status !== 'completed'),
    [tasks],
  );

  const handleSchedule = () => {
    if (!selectedTaskId || !dateValue) return;
    const ts = new Date(dateValue + 'T00:00:00').getTime();
    updateTask(selectedTaskId, { scheduledDate: ts });
    setSelectedTaskId(null);
    onClose();
  };

  const handleUnschedule = (taskId: string) => {
    updateTask(taskId, { scheduledDate: undefined });
  };

  const handleUnscheduleAll = () => {
    scheduledTasks.forEach(t => updateTask(t.id, { scheduledDate: undefined }));
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="Manage Schedule" size="sm">
      {/* Tab toggle */}
      <div className="flex gap-1 p-1 bg-surface-800 rounded-xl mb-4">
        <button
          onClick={() => setTab('schedule')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            tab === 'schedule' ? 'bg-brand-500/20 text-brand-400' : 'text-surface-400 hover:text-surface-200'
          }`}
        >
          Schedule Task
        </button>
        <button
          onClick={() => setTab('unschedule')}
          className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            tab === 'unschedule' ? 'bg-brand-500/20 text-brand-400' : 'text-surface-400 hover:text-surface-200'
          }`}
        >
          Unschedule ({scheduledTasks.length})
        </button>
      </div>

      {tab === 'schedule' ? (
        <div className="space-y-3">
          {unscheduledTasks.length === 0 ? (
            <p className="text-sm text-surface-400 text-center py-6">
              All tasks are already scheduled or completed.
            </p>
          ) : (
            <>
              <div className="max-h-48 overflow-y-auto space-y-1.5">
                {unscheduledTasks.map(task => (
                  <button
                    key={task.id}
                    onClick={() => setSelectedTaskId(task.id)}
                    className={`w-full text-left p-3 rounded-xl border text-sm transition-colors ${
                      selectedTaskId === task.id
                        ? 'border-brand-500 bg-brand-500/10 text-surface-50'
                        : 'border-surface-800 bg-surface-900 text-surface-300 hover:border-surface-700'
                    }`}
                  >
                    <p className="font-medium truncate">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {task.roadmapRef && roadmapTitleMap.get(task.roadmapRef) && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-sky-400">
                          <MapIcon size={8} /> {roadmapTitleMap.get(task.roadmapRef)}
                        </span>
                      )}
                      {task.priority && (
                        <span className="text-[10px] text-surface-500">{task.priority}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {selectedTaskId && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-surface-400">Schedule for</label>
                  <input
                    type="date"
                    value={dateValue}
                    onChange={e => setDateValue(e.target.value)}
                    min={todayKey()}
                    className="w-full px-3 py-2 rounded-xl bg-surface-800 border border-surface-700 text-surface-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                  />
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {scheduledTasks.length === 0 ? (
            <p className="text-sm text-surface-400 text-center py-6">
              No scheduled tasks.
            </p>
          ) : (
            <>
              <div className="max-h-64 overflow-y-auto space-y-1.5">
                {scheduledTasks.map(task => {
                  const state = getScheduledState(task);
                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-2 p-3 rounded-xl border border-surface-800 bg-surface-900"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-surface-100 truncate">{task.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {task.roadmapRef && roadmapTitleMap.get(task.roadmapRef) && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-sky-400">
                          <MapIcon size={8} /> {roadmapTitleMap.get(task.roadmapRef)}
                            </span>
                          )}
                          <Badge tone={state === 'missed' ? 'danger' : state === 'today' ? 'brand' : 'info'} className="text-[10px]">
                            {scheduledStateLabel(state)}
                          </Badge>
                        </div>
                      </div>
                      <button
                        onClick={() => handleUnschedule(task.id)}
                        className="p-1.5 rounded-lg text-surface-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Unschedule"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
              {scheduledTasks.length > 1 && (
                <Button variant="ghost" size="sm" className="w-full text-red-400 hover:text-red-300" onClick={handleUnscheduleAll}>
                  Unschedule All
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'schedule' && selectedTaskId && (
        <div className="mt-4 flex justify-end">
          <Button size="sm" onClick={handleSchedule} leftIcon={<Calendar size={14} />}>
            Schedule
          </Button>
        </div>
      )}
    </Dialog>
  );
}
