import { useState, useMemo } from 'react';
import {
  Layers, Plus, GitBranch, MessageSquare
} from 'lucide-react';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import { SprintStatus } from '../../types/collaboration';
import { DiscussionsModal } from '../../components/collaboration/DiscussionsModal';
import { CreateSprintModal } from '../../components/collaboration/CreateSprintModal';
import { CreateTaskModal } from '../../components/collaboration/CreateTaskModal';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

// ECIS B.8: the Sprint page answers "What are we delivering?" — sprint header,
// capacity, and the 5-column Kanban. The Project Backlog is split out to its
// own routed page (`/w/:id/backlog`); the workspace's sprint-less features no
// longer share this surface.

export function SprintBoardPage() {
  const { sprints, tasks, activeWorkspaceId, updateTaskStatus } = useCollaborationStore();

  const wsTasks = useMemo(
    () => tasks.filter((t) => t.workspaceId === activeWorkspaceId),
    [tasks, activeWorkspaceId],
  );
  const activeSprint = useMemo(
    () => sprints.find((s) => s.workspaceId === activeWorkspaceId && s.status === 'active'),
    [sprints, activeWorkspaceId],
  );

  const [showCreateSprint, setShowCreateSprint] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [discModal, setDiscModal] = useState<{
    open: boolean; targetType: 'task' | 'worklog' | 'project' | 'doc'; targetId: string; title: string
  }>({
    open: false, targetType: 'task', targetId: '', title: ''
  });

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">

      {/* Sprint Board Actions — real member/feature-aware creation (P6-T4) */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-display font-extrabold text-surface-50 flex items-center gap-2">
            <Layers size={20} className="text-brand-400" /> Sprint Planning
          </h1>
          <p className="text-xs text-surface-400 mt-0.5">What are we delivering this iteration?</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowCreateTask(true)}
            size="sm" leftIcon={<Plus size={14} />}>
            New Task
          </Button>
          <Button onClick={() => setShowCreateSprint(true)}
            size="sm" leftIcon={<Plus size={14} />}>
            New Sprint
          </Button>
        </div>
      </div>

      {/* Sprint Details & Capacity Header */}
      {activeSprint && (
        <div className="rounded-2xl border border-surface-800 bg-surface-900 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-display font-extrabold text-surface-50 flex items-center gap-2">
              <Layers size={18} className="text-brand-400" /> {activeSprint.name}
            </h2>
            <p className="text-xs text-surface-400 mt-1">Goal: {activeSprint.goal}</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <div className="p-3 rounded-xl bg-surface-850 border border-surface-800 text-center">
              <p className="text-brand-400 font-bold">{activeSprint.capacityHours}h</p>
              <p className="text-[10px] text-surface-500">Capacity</p>
            </div>
            <div className="p-3 rounded-xl bg-surface-850 border border-surface-800 text-center">
              <p className="text-emerald-400 font-bold">{wsTasks.filter(t => t.sprintStatus === 'done').length} / {wsTasks.length}</p>
              <p className="text-[10px] text-surface-500 font-bold uppercase">Tasks Done</p>
            </div>
          </div>
        </div>
      )}

      {/* P6-T1: no active sprint — keep the board usable, explain the missing header */}
      {!activeSprint && wsTasks.length > 0 && (
        <div className="rounded-2xl border border-dashed border-surface-700 bg-surface-900/60 p-5 flex items-center gap-3 text-xs text-surface-400 italic">
          <Layers size={14} className="text-surface-500" />
          No active sprint — sprint goal, capacity, and velocity appear here once a sprint is active. The board below shows the workspace task backlog.
        </div>
      )}

      {/* 5-Column Kanban Board */}
      {wsTasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-surface-700 bg-surface-900/60 p-12 text-center text-xs text-surface-400 italic">
          No tasks yet in this workspace. Tasks you create will appear on the sprint board.
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {(
          [
            { id: 'backlog', label: 'Backlog', color: 'border-surface-700 text-surface-400' },
            { id: 'ready', label: 'Ready', color: 'border-blue-500/40 text-blue-400' },
            { id: 'in_progress', label: 'In Progress', color: 'border-sky-500/40 text-sky-400' },
            { id: 'review', label: 'Code Review', color: 'border-purple-500/40 text-purple-400' },
            { id: 'done', label: 'Done', color: 'border-emerald-500/40 text-emerald-400' },
          ] as const
        ).map((col) => {
          const colTasks = wsTasks.filter((t) => t.sprintStatus === col.id);
          return (
            <div key={col.id} className="rounded-2xl border border-surface-800 bg-surface-900 p-4 space-y-3 min-h-[500px]">
              <div className={`pb-2 border-b flex items-center justify-between ${col.color}`}>
                <span className="font-display font-extrabold text-xs uppercase tracking-wider">{col.label}</span>
                <Badge tone="neutral" className="text-xs font-bold">{colTasks.length}</Badge>
              </div>

              <div className="space-y-3">
                {colTasks.map((task) => (
                  <div key={task.id} className="rounded-xl border border-surface-800 bg-surface-850 p-3.5 space-y-2 hover:border-surface-700 transition-all group">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-brand-400 uppercase">{task.priority}</span>
                      {task.gitContext?.prNumber && (
                        <Badge tone="brand" className="font-mono font-bold border border-purple-500/20">
                          PR #{task.gitContext.prNumber}
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs font-bold text-surface-100 leading-snug">{task.title}</p>
                    <p className="text-[11px] text-surface-400 line-clamp-2">{task.description}</p>

                    {/* Git Context Badges */}
                    {task.gitContext?.branch && (
                      <Badge tone="success" icon={<GitBranch size={10} />} className="text-[10px] font-mono py-1 truncate max-w-full overflow-hidden">
                        {task.gitContext.branch}
                      </Badge>
                    )}

                    {/* Action Bar */}
                    <div className="pt-2 border-t border-surface-800 flex items-center justify-between text-[11px]">
                      <Button onClick={() => setDiscModal({ open: true, targetType: 'task', targetId: task.id, title: task.title })}
                        variant="ghost" size="xs" leftIcon={<MessageSquare size={12} />}
                        className="text-surface-400 hover:text-brand-400 hover:bg-transparent">
                        Discuss
                      </Button>

                      {/* Quick Status Move */}
                      <select aria-label="Task status" className="bg-surface-800 text-surface-300 text-[10px] rounded border border-surface-700 px-1 py-0.5"
                        value={task.sprintStatus} onChange={(e) => updateTaskStatus(task.id, e.target.value as SprintStatus)}>
                        <option value="backlog">Backlog</option>
                        <option value="ready">Ready</option>
                        <option value="in_progress">In Progress</option>
                        <option value="review">Review</option>
                        <option value="done">Done</option>
                      </select>
                    </div>
                  </div>
                ))}
                {colTasks.length === 0 && (
                  <p className="text-[11px] text-surface-500 italic py-6 text-center">No tasks</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Modals */}
      <DiscussionsModal
        isOpen={discModal.open}
        onClose={() => setDiscModal({ ...discModal, open: false })}
        targetType={discModal.targetType}
        targetId={discModal.targetId}
        title={discModal.title}
      />
      <CreateSprintModal isOpen={showCreateSprint} onClose={() => setShowCreateSprint(false)} />
      <CreateTaskModal isOpen={showCreateTask} onClose={() => setShowCreateTask(false)} />
    </div>
  );
}
