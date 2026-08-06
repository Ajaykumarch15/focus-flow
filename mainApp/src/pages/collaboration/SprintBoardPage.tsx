import { useState, useMemo } from 'react';
import {
  Layers, Plus, GitBranch, MessageSquare, SlidersHorizontal, Gauge, ListTodo, Link2, AlertTriangle
} from 'lucide-react';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import { SprintStatus, CollaborativeTask } from '../../types/collaboration';
import { selectSprintCapacity, selectSprintFeatures } from '../../lib/sprintSelectors';
import { selectTaskDependencies, selectBlockedTasks } from '../../lib/taskSelectors';
import { DiscussionsModal } from '../../components/collaboration/DiscussionsModal';
import { CreateSprintModal } from '../../components/collaboration/CreateSprintModal';
import { CreateTaskModal } from '../../components/collaboration/CreateTaskModal';
import { SubtaskPanel } from '../../components/collaboration/SubtaskPanel';
import { DependencyPanel } from '../../components/collaboration/DependencyPanel';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

// EEP2-P5.1.3 (s2): each board card exposes an expandable subtask panel —
// add/toggle/delete via the collaboration store (optimistic + rollback).
// EEP2-P5.2.2 (s2): a card blocked by an unfinished dependency gets an amber
// border + "Blocked" badge, and a "Dependencies" toggle expands the
// DependencyPanel (s1). `isBlocked` is derived from selectBlockedTasks in the
// parent so the styling stays a single source of truth.
function SprintTaskCard({ task, planningMode, isBlocked, dependencies, onDiscuss }: {
  task: CollaborativeTask;
  planningMode: boolean;
  isBlocked: boolean;
  dependencies: CollaborativeTask[];
  onDiscuss: () => void;
}) {
  const { updateTaskStatus } = useCollaborationStore();
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [showDependencies, setShowDependencies] = useState(false);
  const done = task.subtasks.filter((s) => s.completed).length;
  const depsDone = dependencies.filter((d) => d.sprintStatus === 'done').length;

  return (
    <div draggable={planningMode}
      onDragStart={(e) => planningMode && e.dataTransfer.setData('text/plain', task.id)}
      data-testid={`task-card-${task.id}`}
      className={`rounded-xl border bg-surface-850 p-3.5 space-y-2 hover:border-surface-700 transition-all group ${planningMode ? 'cursor-grab active:cursor-grabbing' : ''} ${isBlocked ? 'border-warning-500/50' : 'border-surface-800'}`}>
      <div className="flex items-center justify-between text-[10px]">
        <span className="font-bold text-brand-400 uppercase">{task.priority}</span>
        <div className="flex items-center gap-1.5">
          {task.gitContext?.prNumber && (
            <Badge tone="brand" className="font-mono font-bold border border-purple-500/20">
              PR #{task.gitContext.prNumber}
            </Badge>
          )}
          {isBlocked && (
            <Badge tone="warning" icon={<AlertTriangle size={10} />}>
              Blocked
            </Badge>
          )}
        </div>
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
        <Button onClick={onDiscuss}
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

      {/* EEP2-P5.1.3: expandable subtask panel */}
      <button
        type="button"
        onClick={() => setShowSubtasks((s) => !s)}
        aria-expanded={showSubtasks}
        aria-label={`Subtasks for ${task.title}`}
        className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-surface-800 bg-surface-900/60 px-2 py-1.5 text-[10px] font-semibold text-surface-400 hover:text-brand-400 hover:border-surface-700 transition-all">
        <ListTodo size={12} /> Subtasks {done}/{task.subtasks.length}
      </button>
      {showSubtasks && <SubtaskPanel task={task} />}

      {/* EEP2-P5.2.2: expandable dependency panel */}
      <button
        type="button"
        onClick={() => setShowDependencies((s) => !s)}
        aria-expanded={showDependencies}
        aria-label={`Dependencies for ${task.title}`}
        className={`w-full flex items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[10px] font-semibold transition-all ${isBlocked
          ? 'border-warning-500/40 bg-warning-500/5 text-warning-400 hover:text-warning-300 hover:border-warning-500/60'
          : 'border-surface-800 bg-surface-900/60 text-surface-400 hover:text-brand-400 hover:border-surface-700'}`}>
        <Link2 size={12} /> Dependencies {depsDone}/{dependencies.length}
      </button>
      {showDependencies && <DependencyPanel task={task} dependencies={dependencies} />}
    </div>
  );
}

// ECIS B.8: the Sprint page answers "What are we delivering?" — sprint header,
// capacity, and the 5-column Kanban. The Project Backlog is split out to its
// own routed page (`/w/:id/backlog`); the workspace's sprint-less features no
// longer share this surface.
//
// EEP2-P4.3.3: a planning-mode toggle on the board (s1) surfaces the capacity
// bar (s3, DDS §10 via the P4.3.1 selectors) and makes task cards draggable
// between columns so a drag/drop reassignment is verifiable (s2). Planning
// mode is off by default so the read view stays untouched.

export function SprintBoardPage() {
  const { sprints, features, tasks, activeWorkspaceId, updateTaskStatus } = useCollaborationStore();

  const wsTasks = useMemo(
    () => tasks.filter((t) => t.workspaceId === activeWorkspaceId),
    [tasks, activeWorkspaceId],
  );
  const activeSprint = useMemo(
    () => sprints.find((s) => s.workspaceId === activeWorkspaceId && s.status === 'active'),
    [sprints, activeWorkspaceId],
  );

  const [planningMode, setPlanningMode] = useState(false);
  const [showCreateSprint, setShowCreateSprint] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [discModal, setDiscModal] = useState<{
    open: boolean; targetType: 'task' | 'worklog' | 'project' | 'doc'; targetId: string; title: string
  }>({
    open: false, targetType: 'task', targetId: '', title: ''
  });

  // EEP2-P4.3.3 (s3): capacity load = Σ estimatedHours of the sprint's planned
  // Features + Tasks (DDS §10), shared with the planning page via selectors.
  const sprintFeatures = useMemo(
    () => selectSprintFeatures(activeSprint?.id, features),
    [activeSprint?.id, features],
  );
  const sprintTasks = useMemo(
    () => wsTasks.filter((t) => t.sprintId === activeSprint?.id),
    [wsTasks, activeSprint?.id],
  );
  const capacity = useMemo(
    () => selectSprintCapacity(activeSprint, sprintFeatures, sprintTasks),
    [activeSprint, sprintFeatures, sprintTasks],
  );

  // EEP2-P5.2.2 (s2): blocked ids derived once from selectBlockedTasks — the
  // card styling is a pure projection, never a hand-rolled re-check.
  const blockedIds = useMemo(
    () => new Set(selectBlockedTasks(wsTasks).map((t) => t.id)),
    [wsTasks],
  );

  const handleColumnDrop = (colId: SprintStatus, e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) updateTaskStatus(taskId, colId);
  };

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
          <Button
            onClick={() => setPlanningMode((m) => !m)}
            variant={planningMode ? 'secondary' : 'ghost'}
            size="sm"
            aria-pressed={planningMode}
            leftIcon={<SlidersHorizontal size={14} />}>
            {planningMode ? 'Planning mode on' : 'Planning mode'}
          </Button>
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

      {/* EEP2-P4.3.3 (s3): capacity bar surfaced by the planning-mode toggle. */}
      {planningMode && activeSprint && (
        <div data-testid="capacity-panel" className="rounded-2xl border border-surface-800 bg-surface-900 p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-display font-extrabold text-surface-300 uppercase tracking-wider flex items-center gap-2">
              <Gauge size={14} className="text-brand-400" /> Planning Capacity
            </span>
            <span className="text-xs font-semibold text-surface-400">
              {capacity.capacityHours > 0 ? (
                <><span className={capacity.overCapacity ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>{capacity.load}h</span> of {capacity.capacityHours}h loaded ({capacity.loadPct}%)</>
              ) : 'Uncapped capacity'}
            </span>
          </div>
          {capacity.capacityHours > 0 && (
            <div
              className="h-2.5 rounded-full bg-surface-800 overflow-hidden"
              role="progressbar"
              aria-label="Sprint capacity load"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(100, capacity.loadPct)}>
              <div
                data-testid="capacity-bar"
                className={`h-full rounded-full transition-all ${capacity.overCapacity ? 'bg-danger-500' : 'bg-gradient-to-r from-brand-500 to-emerald-400'}`}
                style={{ width: `${Math.min(100, capacity.loadPct)}%` }} />
            </div>
          )}
          <p className="text-[11px] text-surface-500">
            Drag task cards between columns to reassign their status.
            {capacity.capacityHours > 0 && (capacity.overCapacity
              ? ' This sprint is over capacity — trim scope before committing.'
              : ` ${capacity.remainingHours}h of headroom remains.`)}
          </p>
        </div>
      )}

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
            <div key={col.id} data-testid={`column-${col.id}`}
              onDragOver={(e) => planningMode && e.preventDefault()}
              onDrop={(e) => planningMode && handleColumnDrop(col.id, e)}
              className="rounded-2xl border border-surface-800 bg-surface-900 p-4 space-y-3 min-h-[500px]">
              <div className={`pb-2 border-b flex items-center justify-between ${col.color}`}>
                <span className="font-display font-extrabold text-xs uppercase tracking-wider">{col.label}</span>
                <Badge tone="neutral" className="text-xs font-bold">{colTasks.length}</Badge>
              </div>

              <div className="space-y-3">
                {colTasks.map((task) => (
                  <SprintTaskCard
                    key={task.id}
                    task={task}
                    planningMode={planningMode}
                    isBlocked={blockedIds.has(task.id)}
                    dependencies={selectTaskDependencies(task.id, wsTasks)}
                    onDiscuss={() => setDiscModal({ open: true, targetType: 'task', targetId: task.id, title: task.title })}
                  />
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
