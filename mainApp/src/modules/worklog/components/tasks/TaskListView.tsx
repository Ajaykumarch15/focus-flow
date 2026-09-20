import { useMemo, useState } from 'react';
import { Calendar } from 'lucide-react';
import { Badge, type BadgeTone } from '@shared/components/ui/Badge';
import { Pagination } from '@shared/components/ui/Pagination';
import type { Task, Priority, TaskStatus } from '@shared/types';

const PRIORITY_BADGE: Record<Priority, BadgeTone> = {
  low: 'success',
  medium: 'warning',
  high: 'danger',
  urgent: 'danger',
};

const STATUS_BADGE: Record<TaskStatus, BadgeTone> = {
  todo: 'neutral',
  active: 'info',
  paused: 'warning',
  completed: 'success',
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'To Do',
  active: 'In Progress',
  paused: 'Paused',
  completed: 'Completed',
};

interface TaskListViewProps {
  tasks: Task[];
  onTaskClick: (id: string) => void;
  pageSize?: number;
}

export function TaskListView({ tasks, onTaskClick, pageSize = 10 }: TaskListViewProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(tasks.length / pageSize);

  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return tasks.slice(start, start + pageSize);
  }, [tasks, currentPage, pageSize]);

  return (
    <div>
      <div className="rounded-xl border border-surface-800 bg-surface-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-surface-800">
                <th className="px-4 py-3 text-xs font-semibold text-surface-400 uppercase tracking-wider">Task</th>
                <th className="px-4 py-3 text-xs font-semibold text-surface-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-surface-400 uppercase tracking-wider">Priority</th>
                <th className="px-4 py-3 text-xs font-semibold text-surface-400 uppercase tracking-wider hidden md:table-cell">Labels</th>
                <th className="px-4 py-3 text-xs font-semibold text-surface-400 uppercase tracking-wider hidden sm:table-cell">Due Date</th>
                <th className="px-4 py-3 text-xs font-semibold text-surface-400 uppercase tracking-wider">Progress</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTasks.map((task) => {
                const done = task.subtasks.filter((s) => s.completed).length;
                const total = task.subtasks.length;
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;

                return (
                  <tr
                    key={task.id}
                    onClick={() => onTaskClick(task.id)}
                    className="border-b border-surface-800/50 hover:bg-surface-800/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-surface-50 truncate">{task.title}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_BADGE[task.status]} className="text-[10px]">
                        {STATUS_LABEL[task.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={PRIORITY_BADGE[task.priority]} className="text-[10px] capitalize">
                        {task.priority}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {task.category ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-surface-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                          {task.category}
                        </span>
                      ) : (
                        <span className="text-xs text-surface-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {task.deadline ? (
                        <span className="flex items-center gap-1.5 text-xs text-surface-400">
                          <Calendar size={12} />
                          {new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      ) : (
                        <span className="text-xs text-surface-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-surface-800 overflow-hidden">
                          <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-surface-400">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {tasks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-surface-400">No tasks match your filters.</p>
        </div>
      )}

      {tasks.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={tasks.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
}
