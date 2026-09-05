import { useMemo } from 'react';
import { Calendar } from 'lucide-react';
import { Avatar } from '@shared/components/ui/Avatar';
import { Badge, type BadgeTone } from '@shared/components/ui/Badge';
import { useKanbanStore } from './kanbanStore';
import { KANBAN_COLUMNS } from './types';
import type { KanbanPriority } from './types';

const PRIORITY_BADGE: Record<KanbanPriority, BadgeTone> = {
  low: 'success',
  medium: 'warning',
  high: 'danger',
  urgent: 'danger',
};

const STATUS_BADGE: Record<string, BadgeTone> = {
  todo: 'neutral',
  doing: 'warning',
  review: 'info',
  done: 'success',
};

export function ListView() {
  const { tasks, searchQuery, filters, openDetailsPanel } = useKanbanStore();

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!t.title.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false;
      }
      if (filters.status !== 'all' && t.status !== filters.status) return false;
      if (filters.priority && t.priority !== filters.priority) return false;
      if (filters.label && !t.labels.some((l) => l.name === filters.label)) return false;
      if (filters.assignee && !t.assignees.some((a) => a.id === filters.assignee)) return false;
      return true;
    });
  }, [tasks, searchQuery, filters]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => a.order - b.order);
    return arr;
  }, [filtered]);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-surface-800">
            <th className="px-4 py-3 text-xs font-semibold text-surface-400 uppercase tracking-wider">Task</th>
            <th className="px-4 py-3 text-xs font-semibold text-surface-400 uppercase tracking-wider">Status</th>
            <th className="px-4 py-3 text-xs font-semibold text-surface-400 uppercase tracking-wider">Priority</th>
            <th className="px-4 py-3 text-xs font-semibold text-surface-400 uppercase tracking-wider hidden md:table-cell">Labels</th>
            <th className="px-4 py-3 text-xs font-semibold text-surface-400 uppercase tracking-wider hidden lg:table-cell">Assignee</th>
            <th className="px-4 py-3 text-xs font-semibold text-surface-400 uppercase tracking-wider hidden sm:table-cell">Due Date</th>
            <th className="px-4 py-3 text-xs font-semibold text-surface-400 uppercase tracking-wider">Progress</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((task) => {
            const done = task.subtasks.filter((s) => s.completed).length;
            const total = task.subtasks.length;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            const colTitle = KANBAN_COLUMNS.find((c) => c.id === task.status)?.title ?? task.status;

            return (
              <tr
                key={task.id}
                onClick={() => openDetailsPanel(task.id)}
                className="border-b border-surface-800/50 hover:bg-surface-900/50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-surface-50 truncate">{task.title}</p>
                      <p className="text-xs text-surface-400 truncate mt-0.5">{task.description}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={STATUS_BADGE[task.status]} className="text-[10px]">
                    {colTitle}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={PRIORITY_BADGE[task.priority]} className="text-[10px] capitalize">
                    {task.priority}
                  </Badge>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {task.labels.slice(0, 2).map((l) => (
                      <span key={l.name} className="inline-flex items-center gap-1 text-[10px] text-surface-400">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: l.color }} />
                        {l.name}
                      </span>
                    ))}
                    {task.labels.length > 2 && (
                      <span className="text-[10px] text-surface-500">+{task.labels.length - 2}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <div className="flex -space-x-1">
                    {task.assignees.slice(0, 2).map((a) => (
                      <Avatar key={a.id} name={a.name} src={a.avatar} size="xs" className="ring-2 ring-surface-950" />
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  {task.dueDate ? (
                    <span className="flex items-center gap-1.5 text-xs text-surface-400">
                      <Calendar size={12} />
                      {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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

      {sorted.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-surface-400">No tasks match your filters.</p>
        </div>
      )}
    </div>
  );
}
