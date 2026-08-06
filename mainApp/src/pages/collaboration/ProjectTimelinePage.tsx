import { useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertOctagon, ArrowLeft, CalendarClock, ChevronRight, FolderOpen,
  History, Layers, ListChecks, Rocket, UserCheck,
} from 'lucide-react';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import {
  filterTimelineEvents,
  groupTimelineEventsByDay,
  selectProjectTimelineEvents,
} from '../../lib/projectTimelineSelectors';
import {
  selectBlockedTasks,
  selectDueTodayTasks,
  selectOverdueTasks,
  selectTaskStatusCounts,
  selectTasksWithWorklog,
} from '../../lib/taskSelectors';
import type { TimelineEntityType, TimelineFilter } from '../../lib/projectTimelineSelectors';
import type { SprintStatus } from '../../types/collaboration';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Badge, type BadgeTone } from '../../components/ui/Badge';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { dayKey, formatDateShort, formatMs, formatRelativeTime } from '../../utils/time';

const FILTER_OPTIONS: { value: TimelineFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'task', label: 'Tasks' },
  { value: 'feature', label: 'Features' },
  { value: 'sprint', label: 'Sprints' },
  { value: 'release', label: 'Releases' },
  { value: 'blocker', label: 'Blockers' },
];

const VALID_FILTERS = new Set<TimelineFilter>(FILTER_OPTIONS.map((o) => o.value));

const ENTITY_ICON: Record<TimelineEntityType, React.ComponentType<{ size?: string | number; className?: string }>> = {
  task: ListChecks,
  feature: Layers,
  sprint: CalendarClock,
  release: Rocket,
  blocker: AlertOctagon,
  project: FolderOpen,
  session: UserCheck,
};

const ENTITY_TONE: Record<TimelineEntityType, string> = {
  task: 'text-cyan-400',
  feature: 'text-violet-400',
  sprint: 'text-amber-400',
  release: 'text-emerald-400',
  blocker: 'text-rose-400',
  project: 'text-brand-400',
  session: 'text-sky-400',
};

type ProjectView = 'timeline' | 'tasks';

type TaskFilter = 'all' | 'overdue' | 'due' | 'blocked' | 'worklog';

const TASK_FILTER_OPTIONS: { value: TaskFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'due', label: 'Due today' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'worklog', label: 'Logged' },
];

const VALID_TASK_FILTERS = new Set<TaskFilter>(TASK_FILTER_OPTIONS.map((o) => o.value));

const STATUS_FILTER_OPTIONS: { value: SprintStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'backlog', label: 'Backlog' },
  { value: 'ready', label: 'Ready' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Done' },
];

const VALID_STATUS_FILTERS = new Set<SprintStatus | 'all'>(STATUS_FILTER_OPTIONS.map((o) => o.value));

const PRIORITY_TONE: Record<string, BadgeTone> = {
  urgent: 'danger',
  high: 'warning',
  medium: 'brand',
  low: 'info',
};

function timelineDayLabel(dayKeyValue: string): string {
  const today = dayKey(Date.now());
  const yesterday = dayKey(Date.now() - 86400000);
  if (dayKeyValue === today) return 'Today';
  if (dayKeyValue === yesterday) return 'Yesterday';
  return formatDateShort(new Date(`${dayKeyValue}T00:00:00`));
}

export function ProjectTimelinePage() {
  const { workspaceId, projectId } = useParams<{ workspaceId: string; projectId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    projects, tasks, features, sprints, blockers, activities, members,
    activeWorkspaceId, loadWorkspaceActivity, activityLoading,
  } = useCollaborationStore();

  const wsKey = workspaceId ?? activeWorkspaceId;

  const project = useMemo(
    () => projects.find((p) => p.id === projectId && p.workspaceId === wsKey),
    [projects, projectId, wsKey],
  );

  const view: ProjectView = searchParams.get('view') === 'tasks' ? 'tasks' : 'timeline';

  const updateParams = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined || value === 'all' || value === '') next.delete(key);
      else next.set(key, value);
    }
    setSearchParams(next, { replace: true });
  };

  // EEP2-P5.5.1 (P5.5.2 view): strictly project-scoped task list feeding the
  // pure P5.5.1 selectors — never the whole workspace's backlog.
  const projectTasks = useMemo(
    () => tasks.filter((t) => t.projectId === project?.id && t.workspaceId === wsKey),
    [tasks, project, wsKey],
  );

  const counts = useMemo(() => selectTaskStatusCounts(projectTasks), [projectTasks]);

  const taskFilter = VALID_TASK_FILTERS.has(searchParams.get('filter') as TaskFilter)
    ? (searchParams.get('filter') as TaskFilter)
    : 'all';
  const statusFilter = VALID_STATUS_FILTERS.has(searchParams.get('status') as SprintStatus | 'all')
    ? (searchParams.get('status') as SprintStatus | 'all')
    : 'all';

  const memberName = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of members) map.set(m.id, m.name);
    return map;
  }, [members]);

  const now = Date.now();
  const overdueIds = new Set(selectOverdueTasks(projectTasks, now).map((t) => t.id));
  const dueTodayIds = new Set(selectDueTodayTasks(projectTasks, now).map((t) => t.id));
  const blockedIds = new Set(selectBlockedTasks(projectTasks).map((t) => t.id));

  const filteredTasks = useMemo(() => {
    let base = projectTasks;
    if (taskFilter === 'overdue') base = selectOverdueTasks(base, now);
    else if (taskFilter === 'due') base = selectDueTodayTasks(base, now);
    else if (taskFilter === 'blocked') base = selectBlockedTasks(base);
    else if (taskFilter === 'worklog') base = selectTasksWithWorklog(base);
    if (statusFilter !== 'all') base = base.filter((t) => t.sprintStatus === statusFilter);
    return base;
  }, [projectTasks, taskFilter, statusFilter, now]);

  useEffect(() => {
    if (wsKey) loadWorkspaceActivity(wsKey);
  }, [wsKey, loadWorkspaceActivity]);

  const events = useMemo(
    () => (project
      ? selectProjectTimelineEvents({ project, tasks, features, sprints, blockers, activities, members })
      : []),
    [project, tasks, features, sprints, blockers, activities, members],
  );

  const filter = VALID_FILTERS.has(searchParams.get('entity') as TimelineFilter)
    ? (searchParams.get('entity') as TimelineFilter)
    : 'all';

  const filtered = useMemo(() => filterTimelineEvents(events, filter), [events, filter]);
  const days = useMemo(() => groupTimelineEventsByDay(filtered), [filtered]);
  const hasActivity = useMemo(() => events.some((e) => e.kind !== 'project.created'), [events]);

  const setFilter = (value: TimelineFilter) => {
    updateParams({ entity: value === 'all' ? undefined : value });
  };

  const overviewUrl = `/w/${wsKey}/projects/${projectId}`;
  const projectsUrl = `/w/${wsKey}/projects`;

  if (!project) {
    return (
      <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
        <EmptyState
          icon={<History size={26} />}
          title="Project not found"
          description="This project does not exist in the current workspace, or it may have been removed."
          action={
            <Button variant="ghost" size="sm" onClick={() => navigate(projectsUrl)} leftIcon={<ArrowLeft size={14} />}>
              Back to Projects
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <PageHeader
        title={view === 'tasks' ? 'Project Tasks' : 'Project Timeline'}
        description={
          view === 'tasks'
            ? `Every task scoped to ${project.name} — filter by status, deadline, blockers, and logged time.`
            : `What has happened in ${project.name} over time — from the real workspace feed and project history.`
        }
        eyebrow={`${project.key} · ${view === 'tasks' ? 'Tasks' : 'Timeline'}`}
        icon={<History size={18} className="text-amber-400" />}
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate(overviewUrl)} leftIcon={<ArrowLeft size={14} />}>
            Back to Overview
          </Button>
        }
      />

      <div className="flex w-fit items-center rounded-xl border border-surface-800 bg-surface-900 p-1" role="group" aria-label="Project view">
        {(['timeline', 'tasks'] as const).map((option) => {
          const active = view === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => updateParams({ view: option })}
              aria-pressed={active}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-colors ${
                active
                  ? 'bg-brand-500/15 text-brand-300'
                  : 'text-surface-400 hover:text-surface-200'
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>

      {view === 'tasks' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {STATUS_FILTER_OPTIONS.filter((o) => o.value !== 'all').map((option) => (
              <div key={option.value} className="rounded-xl border border-surface-800 bg-surface-900 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-surface-500">{option.label}</p>
                <p data-testid={`task-count-${option.value}`} className="text-xl font-display font-extrabold text-surface-100">{counts[option.value as SprintStatus]}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter tasks">
            {TASK_FILTER_OPTIONS.map((option) => {
              const active = taskFilter === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => updateParams({ filter: option.value })}
                  aria-pressed={active}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors border ${
                    active
                      ? 'bg-brand-500/15 border-brand-500/40 text-brand-300'
                      : 'bg-surface-900 border-surface-800 text-surface-400 hover:text-surface-200'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
            <div className="flex items-center gap-2 ml-auto">
              <label htmlFor="task-status-filter" className="text-xs font-semibold text-surface-400">
                Status
              </label>
              <select
                id="task-status-filter"
                value={statusFilter}
                onChange={(e) => updateParams({ status: e.target.value })}
                className="bg-surface-900 border border-surface-800 text-surface-200 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              >
                {STATUS_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredTasks.length === 0 ? (
            <EmptyState
              icon={<ListChecks size={26} />}
              title={projectTasks.length === 0 ? 'No tasks here' : 'No matching tasks'}
              description={
                projectTasks.length === 0
                  ? 'Tasks created under this project will appear here.'
                  : 'No tasks match the current filter and status selection.'
              }
            />
          ) : (
            <ul className="space-y-2">
              {filteredTasks.map((t) => {
                const loggedMs = t.totalTime ?? 0;
                const logged = loggedMs > 0
                  ? formatMs(loggedMs)
                  : (t.actualHours ?? 0) > 0
                    ? `${t.actualHours} h`
                    : null;
                return (
                  <li key={t.id} data-testid={`task-row-${t.id}`} className="rounded-xl border border-surface-800 bg-surface-900 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-surface-100">{t.title}</p>
                          {blockedIds.has(t.id) && <Badge tone="danger" className="text-[10px] font-extrabold uppercase tracking-wider">Blocked</Badge>}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <StatusBadge status={t.sprintStatus} />
                          <Badge tone={PRIORITY_TONE[t.priority] ?? 'neutral'} className="text-[10px] capitalize">
                            {t.priority}
                          </Badge>
                          {t.deadline && (
                            overdueIds.has(t.id)
                              ? <Badge tone="danger" className="text-[10px] font-extrabold uppercase tracking-wider">Overdue</Badge>
                              : dueTodayIds.has(t.id)
                                ? <Badge tone="warning" className="text-[10px] font-extrabold uppercase tracking-wider">Due today</Badge>
                                : <Badge tone="neutral" className="text-[10px]">{formatDateShort(new Date(t.deadline))}</Badge>
                          )}
                          {logged && <Badge tone="info" className="text-[10px]">{logged} logged</Badge>}
                        </div>
                      </div>
                      {t.assigneeId && memberName.get(t.assigneeId) && (
                        <span className="text-xs text-surface-400 flex-shrink-0">@{memberName.get(t.assigneeId)}</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter timeline by entity type">
        {FILTER_OPTIONS.map((option) => {
          const active = filter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              aria-pressed={active}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors border ${
                active
                  ? 'bg-brand-500/15 border-brand-500/40 text-brand-300'
                  : 'bg-surface-900 border-surface-800 text-surface-400 hover:text-surface-200'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {activityLoading && !hasActivity && (
        <p className="text-xs text-surface-500 italic">Loading timeline…</p>
      )}

      {!activityLoading && !hasActivity && (
        <EmptyState
          icon={<History size={26} />}
          title="No timeline activity yet"
          description="Project events will appear here as work happens — tasks, features, sprints, releases, and blockers."
        />
      )}

      {filter !== 'all' && days.length === 0 && hasActivity && (
        <p className="text-xs text-surface-500 italic">No {filter} events for this project yet.</p>
      )}

      {days.length > 0 && hasActivity && (
        <ol className="space-y-8">
          {days.map((day) => (
            <li key={day.dayKey}>
              <div className="flex items-center gap-3">
                <h2 className="text-xs font-display font-extrabold uppercase tracking-wider text-surface-400">
                  {timelineDayLabel(day.dayKey)}
                </h2>
                <span className="h-px flex-1 bg-surface-800" />
                <span className="text-[11px] font-semibold text-surface-500">{day.events.length}</span>
              </div>
              <ul className="mt-3 space-y-3">
                {day.events.map((event) => {
                  const Icon = ENTITY_ICON[event.entityType];
                  return (
                    <li
                      key={event.id}
                      className="flex items-start gap-3 rounded-xl border border-surface-800 bg-surface-900 p-4"
                    >
                      <div className="w-9 h-9 rounded-xl bg-surface-800 flex items-center justify-center flex-shrink-0">
                        <Icon size={16} className={ENTITY_TONE[event.entityType]} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-surface-100">{event.actionLabel}</p>
                          <span className="text-[11px] text-surface-500 flex-shrink-0">{formatRelativeTime(event.timestamp)}</span>
                        </div>
                        <p className="text-xs text-surface-400 mt-0.5">{event.detail}</p>
                        <div className="flex items-center gap-3 mt-2">
                          {event.actorName && event.actorId && (
                            <Link
                              to={`/w/${wsKey}/members/${event.actorId}`}
                              className="text-[11px] font-semibold text-brand-400 hover:text-brand-300 transition-colors"
                            >
                              {event.actorName}
                            </Link>
                          )}
                          {event.targetTitle && (
                            <span className="text-[11px] text-surface-500 truncate">· {event.targetTitle}</span>
                          )}
                        </div>
                      </div>
                      <Link
                        to={overviewUrl}
                        aria-label={`Jump to ${project.name} overview`}
                        className="p-1.5 rounded-lg text-surface-500 hover:text-surface-200 hover:bg-surface-800 transition-colors flex-shrink-0"
                      >
                        <ChevronRight size={16} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      )}
        </>
      )}
    </div>
  );
}
