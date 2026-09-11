import { useState } from 'react';
import { MessageSquare, Link2, Calendar, ListTodo } from 'lucide-react';
import { AvatarGroup } from '@shared/components/ui/Avatar';
import { cn } from '@shared/utils/cn';
import type { KanbanTask, KanbanPriority } from './types';

interface TaskCardProps {
  task: KanbanTask;
  onClick?: () => void;
}

interface Ripple {
  id: number;
  x: number;
  y: number;
  size: number;
}

const PRIORITY_STYLES: Record<KanbanPriority, { bg: string; text: string; dot: string }> = {
  low: { bg: 'bg-warning-500/10', text: 'text-warning-400', dot: 'bg-warning-400' },
  medium: { bg: 'bg-warning-500/10', text: 'text-warning-400', dot: 'bg-warning-400' },
  high: { bg: 'bg-danger-500/10', text: 'text-danger-400', dot: 'bg-danger-400' },
  urgent: { bg: 'bg-danger-500/10', text: 'text-danger-400', dot: 'bg-danger-400' },
};

const LABEL_COLORS: Record<string, string> = {
  review: '#6366f1',
  testing: '#f97316',
  ui: '#8b5cf6',
  wireframe: '#06b6d4',
  design: '#10b981',
  branding: '#ec4899',
};

function getLabelColor(name: string): string {
  const key = name.toLowerCase();
  for (const [k, v] of Object.entries(LABEL_COLORS)) {
    if (key.includes(k)) return v;
  }
  return '#6b7280';
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const subtasksDone = task.subtasks.filter((s) => s.completed).length;
  const subtasksTotal = task.subtasks.length;
  const progress = subtasksTotal > 0 ? Math.round((subtasksDone / subtasksTotal) * 100) : 0;
  const priorityStyle = PRIORITY_STYLES[task.priority];
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done';

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const size = Math.max(rect.width, rect.height) * 2;
    const id = Date.now();

    setRipples((prev) => [...prev, { id, x, y, size }]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 600);

    onClick?.();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="relative w-full flex flex-col bg-surface-900 border border-surface-800 rounded-xl p-4 h-[180px] overflow-hidden text-left cursor-pointer hover:border-brand-500 hover:shadow-lg hover:shadow-brand-500/10 transition-all duration-200 group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 active:scale-[0.98]"
    >
      {/* Ripple effects */}
      {ripples.map((r) => (
        <span
          key={r.id}
          className="ripple-effect"
          style={{
            left: r.x - r.size / 2,
            top: r.y - r.size / 2,
            width: r.size,
            height: r.size,
          }}
        />
      ))}

      {/* Labels + Priority */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
          {task.labels.map((label) => (
            <span
              key={label.name}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border border-surface-800 bg-surface-850"
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: label.color || getLabelColor(label.name) }}
              />
              <span className="text-surface-300">{label.name}</span>
            </span>
          ))}
        </div>
        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 ml-2', priorityStyle.bg, priorityStyle.text)}>
          <span className={cn('w-1.5 h-1.5 rounded-full', priorityStyle.dot)} />
          {task.priority}
        </span>
      </div>

      {/* Title */}
      <h4 className="text-sm font-bold text-surface-50 leading-snug mb-3 line-clamp-1 group-hover:text-surface-50 transition-colors">
        {task.title}
      </h4>

      {/* Due date + Progress */}
      <div className="flex items-center justify-between mb-3">
        {task.dueDate ? (
          <span className={cn(
            'inline-flex items-center gap-1 text-[11px] font-medium',
            isOverdue ? 'text-danger-400' : 'text-surface-400',
          )}>
            <Calendar size={11} />
            {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        ) : (
          <span />
        )}
        {subtasksTotal > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-14 h-1.5 rounded-full bg-surface-800 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  progress === 100 ? 'bg-success-500' : 'bg-brand-500',
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[10px] font-bold text-surface-400">{progress}%</span>
          </div>
        )}
      </div>

      {/* Footer: comments, links, subtasks, avatars */}
      <div className="flex items-center justify-between pt-2.5 mt-auto border-t border-surface-800/60">
        <div className="flex items-center gap-3 text-surface-500">
          <span className="flex items-center gap-1 text-[11px]">
            <MessageSquare size={11} />
            {task.comments}
          </span>
          <span className="flex items-center gap-1 text-[11px]">
            <Link2 size={11} />
            {task.attachments}
          </span>
          {subtasksTotal > 0 && (
            <span className="flex items-center gap-1 text-[11px]">
              <ListTodo size={11} />
              {subtasksDone}/{subtasksTotal}
            </span>
          )}
        </div>

        {task.assignees.length > 0 ? (
          <AvatarGroup
            items={task.assignees.map((a) => ({ name: a.name, src: a.avatar }))}
            max={3}
            size="xs"
          />
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-surface-500 border border-dashed border-surface-700">
            Unassigned
          </span>
        )}
      </div>
    </button>
  );
}
