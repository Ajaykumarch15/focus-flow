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
import type { TimelineEntityType, TimelineFilter } from '../../lib/projectTimelineSelectors';
import { PageHeader } from '../../components/ui/PageHeader';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { dayKey, formatDateShort, formatRelativeTime } from '../../utils/time';

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
    if (value === 'all') {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ entity: value }, { replace: true });
    }
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
        title="Project Timeline"
        description={`What has happened in ${project.name} over time — from the real workspace feed and project history.`}
        eyebrow={`${project.key} · Timeline`}
        icon={<History size={18} className="text-amber-400" />}
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate(overviewUrl)} leftIcon={<ArrowLeft size={14} />}>
            Back to Overview
          </Button>
        }
      />

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
    </div>
  );
}
