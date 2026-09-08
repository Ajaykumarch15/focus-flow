import { forwardRef, useState } from 'react';
import { MessageSquare, Link2, MoreHorizontal, ListTodo, AlertTriangle, BookOpen, FileText, Plus } from 'lucide-react';
import { Avatar } from '@shared/components/ui/Avatar';
import { cn } from '@shared/utils/cn';
import { useNavigate } from 'react-router-dom';
import { useKanbanStore } from './kanbanStore';
import { api } from '@shared/utils/api';
import type { KanbanTask } from './types';

interface KanbanCardProps {
  task: KanbanTask;
  onClick?: () => void;
  onMenuClick?: (e: React.MouseEvent) => void;
  isDragging?: boolean;
  isDragDisabled?: boolean;
}

export const KanbanCard = forwardRef<HTMLDivElement, KanbanCardProps>(
  ({ task, onClick, onMenuClick, isDragging, isDragDisabled }, ref) => {
    const allTasks = useKanbanStore((s) => s.tasks);
    const worklogTaskIds = useKanbanStore((s) => s.worklogTaskIds);
    const navigate = useNavigate();
    const [creating, setCreating] = useState(false);
    const subtasksDone = task.subtasks.filter((s) => s.completed).length;
    const subtasksTotal = task.subtasks.length;
    const progress = subtasksTotal > 0 ? (subtasksDone / subtasksTotal) * 100 : 0;

    const depCount = task.dependencies?.length ?? 0;
    const isBlocked = depCount > 0 && task.dependencies!.some((depId) => {
      const dep = allTasks.find((t) => t.id === depId);
      return dep && dep.status !== 'done';
    });

    const worklogId = worklogTaskIds.get(task.id);
    const hasWorklog = !!worklogId;

    const handleBadgeClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (hasWorklog && worklogId) {
        navigate(`/worklog/logs/${worklogId}`);
      } else {
        onClick?.();
      }
    };

    const handleStartWorklog = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (creating) return;
      setCreating(true);
      try {
        const log = await api.workLogs.create({
          title: task.title,
          taskRef: task.id,
          projectId: task.projectId || undefined,
        });
        if (log?._id) {
          navigate(`/worklog/logs/${log._id}`);
        }
      } catch {
        // Silently fail — user can retry
      } finally {
        setCreating(false);
      }
    };

    return (
      <div
        ref={ref}
        onClick={onClick}
        className={cn(
          'bg-surface-900 border border-surface-800 rounded-xl p-3.5 relative',
          isDragDisabled
            ? 'cursor-default opacity-60'
            : 'cursor-pointer hover:border-surface-700 hover:shadow-sm transition-all duration-200',
          'dark:bg-surface-850 dark:border-surface-800 dark:hover:border-surface-700',
          isDragging && 'opacity-90 shadow-lg border-brand-500/30',
        )}
      >
        {/* Top-right badge: Task / Log / Start Worklog */}
        <div className="absolute top-2 right-2 flex items-center gap-1">
          {hasWorklog ? (
            <button
              type="button"
              onClick={handleBadgeClick}
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium transition-all bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25"
              aria-label="Open work log"
            >
              <FileText size={10} />
              <span className="hidden sm:inline">Log</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleStartWorklog}
                disabled={creating}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium transition-all bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-50"
                aria-label="Start work log"
              >
                <Plus size={10} />
                <span className="hidden sm:inline">{creating ? '...' : 'Log'}</span>
              </button>
              <button
                type="button"
                onClick={handleBadgeClick}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium transition-all bg-brand-500/15 text-brand-400 border border-brand-500/30 hover:bg-brand-500/25"
                aria-label="Open task details"
              >
                <BookOpen size={10} />
                <span className="hidden sm:inline">Task</span>
              </button>
            </>
          )}
        </div>

        {/* Labels + menu */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
            {task.labels.map((label) => (
              <span
                key={label.name}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border border-surface-800 bg-surface-850 dark:bg-surface-800 dark:border-surface-700"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: label.color }}
                />
                <span className="text-surface-300">{label.name}</span>
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onMenuClick?.(e); }}
            className="p-1 rounded-md text-surface-500 hover:text-surface-300 hover:bg-surface-800 transition-colors flex-shrink-0 ml-1"
            aria-label="Task menu"
          >
            <MoreHorizontal size={14} />
          </button>
        </div>

        {/* Title */}
        <h4 className="text-sm font-bold text-surface-50 leading-snug mb-1">
          {task.title}
        </h4>

        {/* Description */}
        <p className="text-[11px] text-surface-400 leading-relaxed line-clamp-2 mb-3">
          {task.description}
        </p>

        {/* Subtask progress */}
        {subtasksTotal > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-1.5 text-[11px] text-surface-400 font-medium">
                <ListTodo size={12} className="text-surface-500" />
                Sub task
              </span>
              <span className="text-[11px] font-bold text-surface-300">
                {subtasksDone}/{subtasksTotal}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-surface-800 dark:bg-surface-700 overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Footer: comments, links, dependencies, avatars */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3 text-surface-500">
            <span className="flex items-center gap-1 text-[11px]">
              <MessageSquare size={12} />
              {task.comments}
            </span>
            <span className="flex items-center gap-1 text-[11px]">
              <Link2 size={12} />
              {task.attachments}
            </span>
            {depCount > 0 && (
              <span className={cn(
                'flex items-center gap-1 text-[11px] font-medium',
                isBlocked ? 'text-warning-400' : 'text-emerald-400',
              )}>
                <Link2 size={12} />
                {depCount}
              </span>
            )}
            {isBlocked && (
              <span className="flex items-center gap-1 text-[11px] font-medium text-warning-400">
                <AlertTriangle size={12} />
              </span>
            )}
          </div>

          {task.assignees.length > 0 && (
            <div className="flex -space-x-1.5">
              {task.assignees.slice(0, 3).map((a, i) => (
                <Avatar
                  key={a.id}
                  name={a.name}
                  src={a.avatar}
                  size="xs"
                  className={cn(
                    'ring-2 ring-surface-900 dark:ring-surface-850',
                    i > 0 && '-ml-1',
                  )}
                />
              ))}
              {task.assignees.length > 3 && (
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-surface-800 border border-surface-700 text-[9px] font-bold text-surface-400 ring-2 ring-surface-900 dark:ring-surface-850 -ml-1">
                  +{task.assignees.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
);

KanbanCard.displayName = 'KanbanCard';
