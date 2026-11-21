import type { JournalEntry, Task } from '@shared/types';
import type { WorkLog } from '@worklog/services/useWorkLogStore';
import { addDaysToKey, dayKey } from '@shared/utils/time';
import { stripHtml } from '@shared/utils/htmlContent';

// ── S1-T7: Personal Activity Timeline selector (ECIS · DCX) ──────────────────
// Answers "What have I been working on recently?" as a chronological feed of
// ONLY data that already exists in the client stores — personal tasks & their
// timer sessions, journal notes, work-log timeline entries (timer/note/
// snapshot/completed item/decision/blocker), and structured work-log blockers.
// Nothing is invented: task "completed" and review events are intentionally
// omitted because no completion/review timestamp exists in the current model.
// 100% pure — the same inputs always produce the same output; `now` is
// injectable for tests.

export type TimelineEventKind =
  | 'task_created'
  | 'session_start'
  | 'journal'
  | 'timer_start'
  | 'timer_pause'
  | 'timer_resume'
  | 'timer_stop'
  | 'note'
  | 'snapshot'
  | 'completed_item'
  | 'decision'
  | 'blocker'
  | 'worklog_blocker'
  | 'worklog_blocker_resolved';

export type TimelineRange = 'all' | 'today' | 'week';

export const TIMELINE_KIND_LABELS: Record<TimelineEventKind, string> = {
  task_created: 'Task created',
  session_start: 'Focus session',
  journal: 'Journal note',
  timer_start: 'Timer started',
  timer_pause: 'Timer paused',
  timer_resume: 'Timer resumed',
  timer_stop: 'Timer stopped',
  note: 'Work note',
  snapshot: 'Progress snapshot',
  completed_item: 'Completed item',
  decision: 'Decision',
  blocker: 'Work-log blocker',
  worklog_blocker: 'Blocker reported',
  worklog_blocker_resolved: 'Blocker resolved',
};

export interface TimelineEvent {
  id: string;
  kind: TimelineEventKind;
  timestamp: number;
  title: string;
  description?: string;
  category?: string;
  taskId?: string;
  worklogId?: string;
  sessionDurationMs?: number;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export interface TimelineFilter {
  range?: TimelineRange;
  /** Empty array means every kind. */
  types?: TimelineEventKind[];
  /** Cap the returned feed size (applied after sorting, newest first). */
  limit?: number;
}

export interface TimelineInput {
  tasks: Task[];
  journals: JournalEntry[];
  workLogs: WorkLog[];
  now?: number;
}

export type TimelineGroupKey = 'today' | 'yesterday' | 'week' | 'earlier';

export interface TimelineGroup {
  key: TimelineGroupKey;
  label: string;
  events: TimelineEvent[];
}

// ── Internal helpers ──────────────────────────────────────────────────────────

const WORKLOG_TIMER_TITLES: Partial<Record<TimelineEventKind, string>> = {
  timer_start: 'Focus session started',
  timer_pause: 'Focus session paused',
  timer_resume: 'Focus session resumed',
  timer_stop: 'Focus session stopped',
  note: 'Work note',
  snapshot: 'Progress snapshot',
  completed_item: 'Completed item',
  decision: 'Decision',
  blocker: 'Blocker reported',
};

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Sunday-start of the local calendar week a timestamp falls in (mirrors
 *  `getWeekStart`/`isThisWeek` in utils/time, but anchored to the injected
 *  `now` so the selector stays deterministic in tests). */
function weekStartOf(now: number): number {
  const d = new Date(now);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function inWeek(ts: number, now: number): boolean {
  return ts >= weekStartOf(now);
}

// ── Event builders ────────────────────────────────────────────────────────────

function fromPersonalTasks(tasks: Task[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const task of tasks) {
    if (task.createdAt > 0) {
      events.push({
        id: `task:${task.id}:created`,
        kind: 'task_created',
        timestamp: task.createdAt,
        title: task.title || 'Untitled task',
        description: 'Task created',
        category: task.category || 'Work',
        taskId: task.id,
      });
    }
    for (const session of task.sessions ?? []) {
      if (!session.startTime || session.startTime <= 0) continue;
      events.push({
        id: `task:${task.id}:session:${session.id}`,
        kind: 'session_start',
        timestamp: session.startTime,
        title: task.title || 'Untitled task',
        description: 'Focus session started',
        category: task.category || 'Work',
        taskId: task.id,
        sessionDurationMs: session.activeTime > 0 ? session.activeTime : undefined,
      });
    }
  }
  return events;
}

function fromJournals(journals: JournalEntry[]): TimelineEvent[] {
  return journals
    .filter((j) => j.createdAt > 0)
    .map((j) => ({
      id: `journal:${j.id}`,
      kind: 'journal' as const,
      timestamp: j.createdAt,
      title: stripHtml(j.content) || 'Journal note',
      description: 'Journal note',
    }));
}

// A completed item / decision / blocker can surface twice: as a work-log
// timeline entry AND inside its own collection. Dedupe by (log id + title) so
// the feed never shows the same fact twice. The timeline entry wins.

function fromWorkLogs(workLogs: WorkLog[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const log of workLogs) {
    const logId = log._id;
    const logTitle = log.title || 'Work log';

    // ── timeline entries (all nine types) ──
    const timelineCompleted = new Set<string>();
    const timelineDecisions = new Set<string>();
    const timelineBlockers = new Set<string>();

    for (const entry of log.timelineEntries ?? []) {
      if (!entry.timestamp || entry.timestamp <= 0) continue;
      const kind = entry.type as TimelineEventKind;
      if (kind === 'completed_item') timelineCompleted.add(normalizeText(entry.title));
      if (kind === 'decision') timelineDecisions.add(normalizeText(entry.title));
      if (kind === 'blocker') timelineBlockers.add(normalizeText(entry.title));

      events.push({
        id: `${logId}:tl:${entry._id}`,
        kind,
        timestamp: entry.timestamp,
        title: entry.title || WORKLOG_TIMER_TITLES[kind] || logTitle,
        description: entry.description || undefined,
        category: entry.category || undefined,
        worklogId: logId,
      });
    }

    // ── completed items ──
    for (const item of log.completedItems ?? []) {
      if (!item.completedAt || item.completedAt <= 0 || item.done === false) continue;
      if (timelineCompleted.has(normalizeText(item.text))) continue;
      events.push({
        id: `${logId}:ci:${item._id}`,
        kind: 'completed_item',
        timestamp: item.completedAt,
        title: item.text || 'Completed item',
        description: 'Completed item',
        category: item.category || undefined,
        worklogId: logId,
      });
    }

    // ── decisions ──
    for (const decision of log.decisions ?? []) {
      if (!decision.timestamp || decision.timestamp <= 0) continue;
      if (timelineDecisions.has(normalizeText(decision.title))) continue;
      events.push({
        id: `${logId}:dec:${decision._id}`,
        kind: 'decision',
        timestamp: decision.timestamp,
        title: decision.title || 'Decision',
        description: decision.decision || undefined,
        worklogId: logId,
      });
    }

    // ── structured blockers (raised + resolved) ──
    for (const blocker of log.blockerList ?? []) {
      const alreadyTimelined = timelineBlockers.has(normalizeText(blocker.title));
      if (blocker.createdAt > 0 && !alreadyTimelined) {
        events.push({
          id: `${logId}:blk:${blocker._id}`,
          kind: 'worklog_blocker',
          timestamp: blocker.createdAt,
          title: blocker.title || 'Blocker',
          description: blocker.notes || undefined,
          severity: blocker.severity,
          worklogId: logId,
        });
      }
      if (blocker.resolvedAt && blocker.resolvedAt > 0) {
        events.push({
          id: `${logId}:blk-res:${blocker._id}`,
          kind: 'worklog_blocker_resolved',
          timestamp: blocker.resolvedAt,
          title: blocker.title || 'Blocker',
          description: 'Blocker resolved',
          severity: blocker.severity,
          worklogId: logId,
        });
      }
    }
  }

  return events;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function buildTimelineEvents(input: TimelineInput): TimelineEvent[] {
  const events: TimelineEvent[] = [
    ...fromPersonalTasks(input.tasks ?? []),
    ...fromJournals(input.journals ?? []),
    ...fromWorkLogs(input.workLogs ?? []),
  ];

  // Newest first; the index tie-breaker keeps the order stable for events that
  // share a timestamp (e.g. several features created the same day).
  return events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => b.event.timestamp - a.event.timestamp || a.index - b.index)
    .map(({ event }) => event);
}

export function selectPersonalTimeline(input: TimelineInput, filter?: TimelineFilter): TimelineEvent[] {
  const now = input.now ?? Date.now();
  const events = buildTimelineEvents(input);

  const range = filter?.range ?? 'all';
  const types = filter?.types ?? [];

  const filtered = events.filter((event) => {
    if (range === 'today' && dayKey(event.timestamp) !== dayKey(now)) return false;
    if (range === 'week' && !inWeek(event.timestamp, now)) return false;
    if (types.length > 0 && !types.includes(event.kind)) return false;
    return true;
  });

  const limit = filter?.limit ?? 200;
  return filtered.slice(0, limit);
}

export function groupTimelineEvents(events: TimelineEvent[], now: number = Date.now()): TimelineGroup[] {
  const today = dayKey(now);
  const yesterday = addDaysToKey(today, -1);

  const groups: TimelineGroup[] = [
    { key: 'today', label: 'Today', events: [] },
    { key: 'yesterday', label: 'Yesterday', events: [] },
    { key: 'week', label: 'This Week', events: [] },
    { key: 'earlier', label: 'Earlier', events: [] },
  ];

  for (const event of events) {
    const key = dayKey(event.timestamp);
    if (key === today) groups[0].events.push(event);
    else if (key === yesterday) groups[1].events.push(event);
    else if (inWeek(event.timestamp, now)) groups[2].events.push(event);
    else groups[3].events.push(event);
  }

  return groups.filter((group) => group.events.length > 0);
}
