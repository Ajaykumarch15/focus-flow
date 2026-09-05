import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play, Pause, Square, FileText, Sparkles, CheckCircle2, AlertTriangle,
  Lightbulb, BookOpen, CheckSquare, History, ArrowRight,
} from 'lucide-react';
import { useStore } from '@worklog/services/useStore';
import { useWorkLogStore } from '@worklog/services/useWorkLogStore';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { useAuthStore } from '@shared/services/useAuthStore';
import {
  selectPersonalTimeline,
  groupTimelineEvents,
  TIMELINE_KIND_LABELS,
  type TimelineEvent,
  type TimelineEventKind,
  type TimelineRange,
} from '@worklog/services/timelineSelectors';
import { PageHeader } from '@shared/components/ui/PageHeader';
import { Badge, type BadgeTone } from '@shared/components/ui/Badge';
import { Skeleton } from '@shared/components/ui/Skeleton';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { Button } from '@shared/components/ui/Button';
import { Select } from '@shared/components/ui/Select';
import { formatTimeOfDay, formatRelativeTime, formatMs } from '@shared/utils/time';

// ── PersonalActivityTimeline (S1-T7) ─────────────────────────────────────────
// Chronological feed of the user's own engineering work, aggregated purely from
// data that already exists in the client stores (see lib/timelineSelectors.ts).
// No backend changes, no invented events. Filters (range + event type) and the
// natural Today / Yesterday / This Week / Earlier grouping all happen client-side.
// Quick actions reuse existing store actions + navigation only.

const EVENT_CONFIG: Record<TimelineEventKind, { icon: typeof Play; bg: string; color: string }> = {
  task_created:              { icon: CheckSquare,    bg: 'bg-sky-500/10',    color: 'text-sky-400' },
  session_start:             { icon: Play,           bg: 'bg-brand-500/10',  color: 'text-brand-400' },
  journal:                   { icon: BookOpen,       bg: 'bg-amber-500/10',  color: 'text-amber-400' },
  timer_start:               { icon: Play,           bg: 'bg-sky-500/10',    color: 'text-sky-400' },
  timer_pause:               { icon: Pause,          bg: 'bg-amber-500/10',  color: 'text-amber-400' },
  timer_resume:              { icon: Play,           bg: 'bg-emerald-500/10',color: 'text-emerald-400' },
  timer_stop:                { icon: Square,         bg: 'bg-purple-500/10', color: 'text-purple-400' },
  note:                      { icon: FileText,       bg: 'bg-blue-500/10',   color: 'text-blue-400' },
  snapshot:                  { icon: Sparkles,       bg: 'bg-indigo-500/10', color: 'text-indigo-400' },
  completed_item:            { icon: CheckCircle2,   bg: 'bg-emerald-500/10',color: 'text-emerald-400' },
  decision:                  { icon: Lightbulb,      bg: 'bg-amber-500/10',  color: 'text-amber-400' },
  blocker:                   { icon: AlertTriangle,  bg: 'bg-red-500/10',    color: 'text-red-400' },
  worklog_blocker:           { icon: AlertTriangle,  bg: 'bg-red-500/10',    color: 'text-red-400' },
  worklog_blocker_resolved:  { icon: CheckCircle2,   bg: 'bg-emerald-500/10',color: 'text-emerald-400' },
  blocker_raised:            { icon: AlertTriangle,  bg: 'bg-red-500/10',    color: 'text-red-400' },
  blocker_resolved:          { icon: CheckCircle2,   bg: 'bg-emerald-500/10',color: 'text-emerald-400' },
  feature_created:           { icon: Sparkles,       bg: 'bg-purple-500/10', color: 'text-purple-400' },
};

const SEVERITY_TONE: Record<string, BadgeTone> = {
  critical: 'danger',
  high: 'danger',
  medium: 'warning',
  low: 'neutral',
};

const RANGE_OPTIONS: { value: TimelineRange; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
];

export function PersonalActivityTimeline() {
  const { tasks, journals, dataLoading, dataError, loadAll, startTimer } = useStore();
  const { activeLogs, closedLogs } = useWorkLogStore();
  const { blockers, features } = useCollaborationStore();
  const currentUserId = useAuthStore((s) => s.user?._id);
  const navigate = useNavigate();

  const [range, setRange] = useState<TimelineRange>('all');
  const [type, setType] = useState<TimelineEventKind | 'all'>('all');

  const workLogs = useMemo(() => [...activeLogs, ...closedLogs], [activeLogs, closedLogs]);

  const input = useMemo(
    () => ({ tasks, journals, workLogs, blockers, features, currentUserId, now: Date.now() }),
    [tasks, journals, workLogs, blockers, features, currentUserId],
  );

  const hasAnyActivity = useMemo(() => selectPersonalTimeline(input, {}).length > 0, [input]);

  const events = useMemo(
    () => selectPersonalTimeline(input, { range, types: type === 'all' ? [] : [type] }),
    [input, range, type],
  );

  const groups = useMemo(() => groupTimelineEvents(events, Date.now()), [events]);

  const resumeTask = (event: TimelineEvent) => {
    if (!event.taskId) return;
    void startTimer(event.taskId);
    navigate(`/personal/tasks/${event.taskId}`);
  };

  const openTask = (event: TimelineEvent) => {
    if (event.taskId) navigate(`/worklog/tasks/${event.taskId}`);
  };

  const clearFilters = () => {
    setRange('all');
    setType('all');
  };

  const renderAction = (event: TimelineEvent) => {
    if (event.taskId) {
      const task = tasks.find((t) => t.id === event.taskId);
      if (event.kind === 'task_created' || event.kind === 'session_start') {
        if (task && task.status !== 'completed') {
          return (
            <Button size="xs" leftIcon={<Play size={12} />} onClick={() => resumeTask(event)}>
              Resume
            </Button>
          );
        }
        return (
          <Button size="xs" variant="secondary" rightIcon={<ArrowRight size={12} />} onClick={() => openTask(event)}>
            Open Task
          </Button>
        );
      }
      return (
        <Button size="xs" variant="ghost" rightIcon={<ArrowRight size={12} />} onClick={() => openTask(event)}>
          Open Task
        </Button>
      );
    }
    if (event.worklogId) {
      return (
        <Button size="xs" variant="secondary" rightIcon={<ArrowRight size={12} />} onClick={() => navigate(`/worklog/logs/${event.worklogId}`)}>
          Open Work Log
        </Button>
      );
    }
    if (event.kind === 'journal') {
      return (
        <Button size="xs" variant="ghost" rightIcon={<ArrowRight size={12} />} onClick={() => navigate('/worklog/journal')}>
          Open Journal
        </Button>
      );
    }
    return null;
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (dataLoading && tasks.length === 0) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-5" aria-busy="true">
        <div className="rounded-3xl border border-surface-800 bg-surface-900 p-8 space-y-4">
          <Skeleton className="h-8 w-56 rounded-lg" />
          <Skeleton className="h-4 w-80 rounded" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (dataError) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-5">
        <PageHeader title="Personal Activity" description="Your recent engineering work" icon={<History size={18} className="text-brand-400" />} />
        <div className="rounded-2xl border border-danger-500/20 bg-danger-500/5 p-4 flex items-center gap-3" role="alert">
          <AlertTriangle size={18} className="text-danger-500 flex-shrink-0" />
          <p className="text-sm text-surface-300 flex-1">{dataError}</p>
          <Button variant="danger" size="xs" onClick={() => loadAll()}>Retry</Button>
        </div>
      </div>
    );
  }

  // ── Brand-new user / no activity at all ────────────────────────────────────
  if (!hasAnyActivity) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-5">
        <PageHeader title="Personal Activity" description="Your recent engineering work" icon={<History size={18} className="text-brand-400" />} />
        <div className="rounded-3xl border border-dashed border-surface-800 bg-surface-900 overflow-hidden">
          <EmptyState
            icon={<History size={32} className="text-surface-600" />}
            title="Nothing here yet"
            description="Start a focus session, add a journal note, or log work in a work log — this timeline will build itself from what you do."
          />
        </div>
      </div>
    );
  }

  // ── Filters active but nothing matches ─────────────────────────────────────
  if (events.length === 0) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-5">
        <PageHeader title="Personal Activity" description="Your recent engineering work" icon={<History size={18} className="text-brand-400" />} />
        <div className="rounded-3xl border border-dashed border-surface-800 bg-surface-900 overflow-hidden">
          <EmptyState
            icon={<History size={32} className="text-surface-600" />}
            title="No activity matches these filters"
            description="Try a wider time range or clear the event-type filter."
            action={
              <Button variant="secondary" size="sm" onClick={clearFilters}>Clear filters</Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-5">
      <PageHeader title="Personal Activity" description="Your recent engineering work" icon={<History size={18} className="text-brand-400" />} />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-surface-800/60 p-1 rounded-xl border border-surface-800 w-fit" role="group" aria-label="Time range">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={range === option.value}
              onClick={() => setRange(option.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                range === option.value ? 'bg-surface-700/80 text-surface-50 shadow-sm' : 'text-surface-400 hover:text-surface-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <Select
          aria-label="Filter by event type"
          value={type}
          onChange={(e) => setType(e.target.value as TimelineEventKind | 'all')}
          className="sm:max-w-xs"
        >
          <option value="all">All activity</option>
          {Object.entries(TIMELINE_KIND_LABELS).map(([kind, label]) => (
            <option key={kind} value={kind}>{label}</option>
          ))}
        </Select>
      </div>

      {/* Groups */}
      {groups.map((group) => (
        <section key={group.key} aria-label={group.label} className="space-y-3">
          <div className="flex items-center gap-2 mt-6">
            <h2 className="text-sm font-display font-bold text-surface-50 tracking-wide">{group.label}</h2>
            <span className="text-xs text-surface-500">({group.events.length})</span>
            <div className="h-px flex-1 bg-surface-800" aria-hidden="true" />
          </div>

          <div className="relative pl-6 space-y-3 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-800">
            {group.events.map((event) => {
              const config = EVENT_CONFIG[event.kind] ?? EVENT_CONFIG.note;
              const Icon = config.icon;
              const action = renderAction(event);

              return (
                <article
                  key={event.id}
                  className="relative group rounded-2xl border border-surface-800 bg-surface-900/60 p-4 transition-colors hover:border-surface-700"
                >
                  <div className={`absolute -left-6 top-4 w-6 h-6 rounded-full ${config.bg} ${config.color} border border-surface-800 flex items-center justify-center flex-shrink-0 z-10 shadow-sm`}>
                    <Icon size={12} />
                  </div>

                  <div className="flex flex-col md:flex-row md:items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <time dateTime={new Date(event.timestamp).toISOString()} className="text-xs font-mono font-semibold text-brand-400">
                          {formatTimeOfDay(event.timestamp)}
                        </time>
                        <span className="text-[11px] text-surface-500">{formatRelativeTime(event.timestamp)}</span>
                        <span className="text-surface-700 select-none" aria-hidden="true">·</span>
                        <span className="text-[11px] font-medium text-surface-400 uppercase tracking-wider">{TIMELINE_KIND_LABELS[event.kind]}</span>
                        {event.category && <Badge tone="neutral" className="text-[10px]">{event.category}</Badge>}
                        {event.severity && <Badge tone={SEVERITY_TONE[event.severity] ?? 'neutral'} className="text-[10px]">{event.severity}</Badge>}
                        {typeof event.sessionDurationMs === 'number' && event.sessionDurationMs > 0 && (
                          <Badge tone="brand" icon={<Play size={10} />} className="text-[10px]">{formatMs(event.sessionDurationMs)}</Badge>
                        )}
                      </div>
                      <h3 className="text-sm font-semibold text-surface-50 mt-1.5 break-words">{event.title}</h3>
                      {event.description && (
                        <p className="text-xs text-surface-300 mt-1 leading-relaxed line-clamp-2">{event.description}</p>
                      )}
                    </div>
                    {action && <div className="flex-shrink-0">{action}</div>}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
