import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, LayoutGrid, List, CheckSquare, Users, AlertCircle } from 'lucide-react';
import { TaskCard } from '@worklog/components/kanban/TaskCard';
import { TaskFilters } from '@worklog/components/kanban/TaskFilters';
import { TaskDetailsPanel } from '@worklog/components/kanban/TaskDetailsPanel';
import { useKanbanStore } from '@worklog/components/kanban/kanbanStore';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { useWorkspaceId } from '@collab/hooks/useWorkspaceId';
import { KANBAN_COLUMNS } from '@worklog/components/kanban/types';
import type { KanbanPriority } from '@worklog/components/kanban/types';
import { Avatar } from '@shared/components/ui/Avatar';
import { Badge, type BadgeTone } from '@shared/components/ui/Badge';
import { Calendar } from 'lucide-react';
import { cn } from '@shared/utils/cn';

const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };
const stagger = { show: { transition: { staggerChildren: 0.06 } } };

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

type TaskView = 'grid' | 'list';

export function ProjectTasksPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const workspaceId = useWorkspaceId();
  const [view, setView] = useState<TaskView>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [labelFilter, setLabelFilter] = useState<string>('');

  const { members, tasks: collabTasks, projects } = useCollaborationStore();
  const { openDetailsPanel, toggleAssigneeFilter, clearAssigneeFilter } = useKanbanStore();
  const filters = useKanbanStore((s) => s.filters);
  const loadFromProject = useKanbanStore((s) => s.loadFromProject);
  const setContext = useKanbanStore((s) => s.setContext);
  const kanbanTasks = useKanbanStore((s) => s.tasks);

  const project = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId],
  );

  const membersMap = useMemo(() => {
    const map: Record<string, { name: string; avatar?: string }> = {};
    for (const m of members) map[m.id] = { name: m.name, avatar: m.avatar };
    return map;
  }, [members]);

  const membersList = useMemo(
    () => Object.entries(membersMap).map(([id, { name, avatar }]) => ({ id, name, avatar })),
    [membersMap],
  );

  useEffect(() => {
    if (!workspaceId || !projectId) return;
    useCollaborationStore.getState().loadWorkspaces().then(() => {
      const { workspaces, activeWorkspaceId } = useCollaborationStore.getState();
      const ws = workspaces.find((w) => w.id === activeWorkspaceId || w.slug === activeWorkspaceId);
      const resolvedId = ws?.id ?? workspaceId;
      const store = useCollaborationStore.getState();
      store.loadProjects(resolvedId);
      store.loadTasks(resolvedId, projectId);
      store.loadMembers(resolvedId);
      setContext(resolvedId, projectId, membersMap);
    });
  }, [workspaceId, projectId, membersMap, setContext]);

  useEffect(() => {
    const projectTasks = collabTasks.filter((t) => t.projectId === projectId);
    loadFromProject(projectTasks, membersMap);
  }, [collabTasks, projectId, membersMap, loadFromProject]);

  const filteredTasks = useMemo(() => {
    return kanbanTasks.filter((t) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesDesc = t.description.toLowerCase().includes(q);
        const matchesLabels = t.labels.some((l) => l.name.toLowerCase().includes(q));
        const matchesAssignees = t.assignees.some((a) => a.name.toLowerCase().includes(q));
        if (!matchesTitle && !matchesDesc && !matchesLabels && !matchesAssignees) return false;
      }
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (priorityFilter && t.priority !== priorityFilter) return false;
      if (labelFilter && !t.labels.some((l) => l.name === labelFilter)) return false;
      if (filters.assignees.length > 0 && !t.assignees.some((a) => filters.assignees.includes(a.id))) return false;
      return true;
    });
  }, [kanbanTasks, searchQuery, statusFilter, priorityFilter, labelFilter, filters.assignees]);

  const stats = useMemo(() => {
    const total = kanbanTasks.length;
    const assigned = kanbanTasks.filter((t) => t.assignees.length > 0).length;
    const unassigned = total - assigned;
    return { total, assigned, unassigned };
  }, [kanbanTasks]);

  const labelPresets = useMemo(() => {
    const seen = new Set<string>();
    const labels: { name: string; color: string }[] = [];
    for (const t of kanbanTasks) {
      for (const l of t.labels) {
        if (!seen.has(l.name)) {
          seen.add(l.name);
          labels.push(l);
        }
      }
    }
    return labels;
  }, [kanbanTasks]);

  return (
    <div className="min-h-screen bg-surface-950 relative overflow-x-hidden overflow-y-auto">
      {/* Background decorative gradients */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-info-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Content */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:p-8 relative z-10">
        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="mb-6"
        >
          <h1 className="text-2xl font-display font-extrabold text-surface-50 tracking-tight">
            {project?.name ?? 'Project'} — Tasks
          </h1>
          <p className="text-sm text-surface-400 mt-0.5">
            Manage and track all project tasks in one place.
          </p>
        </motion.div>

        {/* Stats Bar */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6"
        >
          <motion.div variants={fadeUp} className="bg-surface-900 border border-surface-800 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-brand-500/10 flex items-center justify-center">
                <CheckSquare size={18} className="text-brand-400" />
              </div>
              <span className="text-xs font-medium text-surface-400">Total Tasks</span>
            </div>
            <span className="text-3xl font-display font-extrabold text-surface-50">{stats.total}</span>
          </motion.div>

          <motion.div variants={fadeUp} className="bg-surface-900 border border-surface-800 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-success-500/10 flex items-center justify-center">
                <Users size={18} className="text-success-400" />
              </div>
              <span className="text-xs font-medium text-surface-400">Assigned</span>
            </div>
            <span className="text-3xl font-display font-extrabold text-success-400">{stats.assigned}</span>
          </motion.div>

          <motion.div variants={fadeUp} className="bg-surface-900 border border-surface-800 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-warning-500/10 flex items-center justify-center">
                <AlertCircle size={18} className="text-warning-400" />
              </div>
              <span className="text-xs font-medium text-surface-400">Unassigned</span>
            </div>
            <span className="text-3xl font-display font-extrabold text-warning-400">{stats.unassigned}</span>
          </motion.div>
        </motion.div>

        {/* Toolbar: Search + Filters + View Toggle */}
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-[320px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg text-xs font-medium bg-surface-900 border border-surface-800 text-surface-200 outline-none transition-colors focus:border-surface-700 placeholder:text-surface-500"
            />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="appearance-none bg-surface-900 border border-surface-800 rounded-lg pl-3 pr-8 py-2 text-xs font-medium text-surface-300 outline-none transition-colors cursor-pointer hover:border-surface-700"
          >
            <option value="all">Status: All</option>
            {KANBAN_COLUMNS.map((col) => (
              <option key={col.id} value={col.id}>{col.title}</option>
            ))}
          </select>

          {/* Priority filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="appearance-none bg-surface-900 border border-surface-800 rounded-lg pl-3 pr-8 py-2 text-xs font-medium text-surface-300 outline-none transition-colors cursor-pointer hover:border-surface-700"
          >
            <option value="">Priority: All</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>

          {/* Label filter */}
          <select
            value={labelFilter}
            onChange={(e) => setLabelFilter(e.target.value)}
            className="appearance-none bg-surface-900 border border-surface-800 rounded-lg pl-3 pr-8 py-2 text-xs font-medium text-surface-300 outline-none transition-colors cursor-pointer hover:border-surface-700"
          >
            <option value="">Labels: All</option>
            {labelPresets.map((l) => (
              <option key={l.name} value={l.name}>{l.name}</option>
            ))}
          </select>

          {/* Members multi-select */}
          <TaskFilters
            members={membersList}
            selectedIds={filters.assignees}
            onToggle={toggleAssigneeFilter}
            onClear={clearAssigneeFilter}
          />

          <div className="flex-1" />

          {/* View Toggle */}
          <div className="inline-flex bg-surface-900 border border-surface-800 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setView('grid')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors',
                view === 'grid' ? 'bg-brand-500 text-white' : 'text-surface-400 hover:text-surface-300',
              )}
            >
              <LayoutGrid size={13} />
              Grid
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors',
                view === 'list' ? 'bg-brand-500 text-white' : 'text-surface-400 hover:text-surface-300',
              )}
            >
              <List size={13} />
              List
            </button>
          </div>
        </div>

        {/* Grid View */}
        {view === 'grid' && (
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-start"
          >
            {filteredTasks.map((task) => (
              <motion.div key={task.id} variants={fadeUp} className="w-full">
                <TaskCard task={task} onClick={() => openDetailsPanel(task.id)} />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* List View */}
        {view === 'list' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl border border-surface-800 bg-surface-900 overflow-hidden"
          >
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
                  {filteredTasks.map((task) => {
                    const done = task.subtasks.filter((s) => s.completed).length;
                    const total = task.subtasks.length;
                    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                    const colTitle = KANBAN_COLUMNS.find((c) => c.id === task.status)?.title ?? task.status;

                    return (
                      <tr
                        key={task.id}
                        onClick={() => openDetailsPanel(task.id)}
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
                            {task.assignees.slice(0, 3).map((a) => (
                              <Avatar key={a.id} name={a.name} src={a.avatar} size="xs" className="ring-2 ring-surface-900" />
                            ))}
                            {task.assignees.length > 3 && (
                              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-surface-800 border border-surface-700 text-[9px] font-bold text-surface-400 ring-2 ring-surface-900 -ml-1">
                                +{task.assignees.length - 3}
                              </span>
                            )}
                            {task.assignees.length === 0 && (
                              <span className="text-[10px] text-surface-500 italic">Unassigned</span>
                            )}
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
            </div>
          </motion.div>
        )}

        {/* Empty state */}
        {filteredTasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CheckSquare size={40} className="text-surface-600 mb-3" />
            <p className="text-sm font-medium text-surface-400">No tasks match your filters.</p>
            <p className="text-xs text-surface-500 mt-1">Try adjusting your search or filter criteria.</p>
          </div>
        )}
      </div>

      {/* Task Details Panel */}
      <TaskDetailsPanel />
    </div>
  );
}
