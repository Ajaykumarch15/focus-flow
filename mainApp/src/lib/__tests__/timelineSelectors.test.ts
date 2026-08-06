import { describe, it, expect } from 'vitest';
import {
  buildTimelineEvents,
  selectPersonalTimeline,
  groupTimelineEvents,
  TIMELINE_KIND_LABELS,
} from '../timelineSelectors';
import type { TimelineEvent, TimelineGroupKey } from '../timelineSelectors';
import type { Task, JournalEntry } from '../../types';
import type { WorkLog } from '../../store/useWorkLogStore';
import type { CentralBlocker, Feature } from '../../types/collaboration';

const NOW = Date.now();

function atLocalDaysAgo(days: number): number {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.getTime() + 60_000; // just after that day's local midnight
}

function mkTask(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title: `Task ${id}`,
    description: '',
    priority: 'medium',
    status: 'todo',
    category: 'Work',
    color: '#0ea5e9',
    tags: [],
    subtasks: [],
    sessions: [],
    totalTime: 0,
    createdAt: atLocalDaysAgo(5),
    updatedAt: atLocalDaysAgo(5),
    ...overrides,
  };
}

function mkJournal(id: string, content: string, createdAt: number): JournalEntry {
  return {
    id, taskId: 't-1', content, mood: 4, focusRating: 3,
    createdAt, updatedAt: createdAt,
  };
}

function mkLog(id: string, overrides: Partial<WorkLog> = {}): WorkLog {
  return {
    _id: id,
    title: `Log ${id}`,
    status: 'in-progress',
    isActive: true,
    updatedAt: '2026-08-01T10:00:00.000Z',
    timelineEntries: [],
    completedItems: [],
    decisions: [],
    blockerList: [],
    workEntries: [],
    currentWork: '',
    plan: '',
    ...overrides,
  } as WorkLog;
}

function mkBlocker(id: string, overrides: Partial<CentralBlocker> = {}): CentralBlocker {
  return {
    id,
    workspaceId: 'ws-1',
    title: `Blocker ${id}`,
    severity: 'high',
    ownerId: 'u-1',
    reporterId: 'u-1',
    status: 'open',
    impactDescription: 'Blocks delivery',
    createdAt: new Date(atLocalDaysAgo(2)).toISOString(),
    ...overrides,
  };
}

function mkFeature(id: string, overrides: Partial<Feature> = {}): Feature {
  return {
    id,
    projectId: 'p-1',
    workspaceId: 'ws-1',
    name: `Feature ${id}`,
    description: '',
    type: 'feature',
    labels: [],
    ownerId: 'u-1',
    estimatedHours: 8,
    status: 'in_progress',
    order: 0,
    createdAt: new Date(atLocalDaysAgo(1)).toISOString().slice(0, 10),
    ...overrides,
  };
}

function baseInput(overrides: Partial<Parameters<typeof buildTimelineEvents>[0]> = {}) {
  return {
    tasks: [] as Task[],
    journals: [] as JournalEntry[],
    workLogs: [] as WorkLog[],
    blockers: [] as CentralBlocker[],
    features: [] as Feature[],
    currentUserId: 'u-1',
    now: NOW,
    ...overrides,
  };
}

describe('buildTimelineEvents (S1-T7)', () => {
  it('aggregates every source that exists in the stores', () => {
    const events = buildTimelineEvents(baseInput({
      tasks: [mkTask('t-1', {
        createdAt: atLocalDaysAgo(4),
        sessions: [{ id: 's-1', startTime: atLocalDaysAgo(3), activeTime: 1_800_000, totalPauseDuration: 0 }],
      })],
      journals: [mkJournal('j-1', 'Wrapped the engine.', atLocalDaysAgo(2))],
      workLogs: [mkLog('wl-1', {
        timelineEntries: [
          { _id: 'e-1', type: 'note', timestamp: atLocalDaysAgo(2), title: 'Investigated latency', description: 'Found a hot loop', category: 'Debugging' },
        ],
        completedItems: [{ _id: 'c-1', text: 'Shipped the parser', category: 'feature', done: true, completedAt: atLocalDaysAgo(1), createdAt: atLocalDaysAgo(1) }],
        decisions: [{ _id: 'd-1', title: 'Zustand over Redux', context: '', decision: 'Adopted Zustand.', alternatives: '', rationale: 'Size', timestamp: atLocalDaysAgo(1) }],
        blockerList: [{ _id: 'b-1', title: 'Mongo down', severity: 'critical', status: 'resolved', notes: 'Restarted', createdAt: atLocalDaysAgo(2), resolvedAt: atLocalDaysAgo(1) }],
      })],
      blockers: [mkBlocker('cb-1')],
      features: [mkFeature('f-1')],
    }));

    const kinds = events.map((e) => e.kind);
    expect(kinds).toContain('task_created');
    expect(kinds).toContain('session_start');
    expect(kinds).toContain('journal');
    expect(kinds).toContain('note');
    expect(kinds).toContain('completed_item');
    expect(kinds).toContain('decision');
    expect(kinds).toContain('worklog_blocker');
    expect(kinds).toContain('worklog_blocker_resolved');
    expect(kinds).toContain('blocker_raised');
    expect(kinds).toContain('feature_created');
  });

  it('sorts newest first', () => {
    const events = buildTimelineEvents(baseInput({
      journals: [
        mkJournal('j-1', 'old', atLocalDaysAgo(3)),
        mkJournal('j-2', 'newer', atLocalDaysAgo(1)),
        mkJournal('j-3', 'mid', atLocalDaysAgo(2)),
      ],
    }));
    const timestamps = events.map((e) => e.timestamp);
    expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a));
  });

  it('never invents completion or review events that have no timestamp source', () => {
    const events = buildTimelineEvents(baseInput({
      tasks: [mkTask('t-1', { status: 'completed' })],
    }));
    const kinds: Set<string> = new Set(events.map((e) => e.kind));
    expect(kinds.has('task_completed')).toBe(false);
    expect(kinds.has('review_requested')).toBe(false);
    expect(kinds.has('review_completed')).toBe(false);
  });

  it('dedupes a completed item that exists both as a timeline entry and in completedItems', () => {
    const events = buildTimelineEvents(baseInput({
      workLogs: [mkLog('wl-1', {
        timelineEntries: [
          { _id: 'e-1', type: 'completed_item', timestamp: atLocalDaysAgo(1), title: 'Shipped the parser', description: '', category: 'feature' },
        ],
        completedItems: [
          { _id: 'c-1', text: 'Shipped the parser', category: 'feature', done: true, completedAt: atLocalDaysAgo(1), createdAt: atLocalDaysAgo(1) },
        ],
      })],
    }));
    const completed = events.filter((e) => e.kind === 'completed_item');
    expect(completed).toHaveLength(1);
    expect(completed[0].id).toBe('wl-1:tl:e-1');
  });

  it('skips completed items that are not marked done', () => {
    const events = buildTimelineEvents(baseInput({
      workLogs: [mkLog('wl-1', {
        completedItems: [{ _id: 'c-1', text: 'Planned', category: 'feature', done: false, completedAt: atLocalDaysAgo(1), createdAt: atLocalDaysAgo(1) }],
      })],
    }));
    expect(events.filter((e) => e.kind === 'completed_item')).toHaveLength(0);
  });

  it('only includes features owned by the current user, and only when a user id is known', () => {
    const features = [
      mkFeature('f-1', { ownerId: 'u-1' }),
      mkFeature('f-2', { ownerId: 'someone-else' }),
    ];
    const owned = buildTimelineEvents(baseInput({ features }));
    expect(owned.filter((e) => e.kind === 'feature_created').map((e) => e.title)).toEqual(['Feature f-1']);

    const anonymous = buildTimelineEvents(baseInput({ features, currentUserId: '' }));
    expect(anonymous.filter((e) => e.kind === 'feature_created')).toHaveLength(0);
  });
});

describe('selectPersonalTimeline filters (S1-T7)', () => {
  it('range "today" keeps only events on the current calendar day', () => {
    const input = baseInput({
      journals: [
        mkJournal('j-today', 'today', atLocalDaysAgo(0)),
        mkJournal('j-yesterday', 'yesterday', atLocalDaysAgo(1)),
        mkJournal('j-early', 'early', atLocalDaysAgo(5)),
      ],
    });
    const events = selectPersonalTimeline(input, { range: 'today' });
    expect(events.map((e) => e.id)).toEqual(['journal:j-today']);
  });

  it('range "week" keeps this week and drops earlier events', () => {
    const input = baseInput({
      journals: [
        mkJournal('j-now', 'now', atLocalDaysAgo(0)),
        mkJournal('j-week', 'week', atLocalDaysAgo(3)),
        mkJournal('j-early', 'early', atLocalDaysAgo(10)),
      ],
    });
    const events = selectPersonalTimeline(input, { range: 'week' });
    const ids = events.map((e) => e.id);
    expect(ids).toContain('journal:j-now');
    expect(ids).toContain('journal:j-week');
    expect(ids).not.toContain('journal:j-early');
  });

  it('filters by a single event kind', () => {
    const input = baseInput({
      journals: [mkJournal('j-1', 'note', atLocalDaysAgo(0))],
      tasks: [mkTask('t-1', { createdAt: atLocalDaysAgo(0) })],
    });
    const events = selectPersonalTimeline(input, { types: ['journal'] });
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('journal');
  });

  it('applies a feed limit after sorting', () => {
    const input = baseInput({
      journals: [0, 1, 2, 3, 4].map((i) => mkJournal(`j-${i}`, `note ${i}`, atLocalDaysAgo(i))),
    });
    const events = selectPersonalTimeline(input, { limit: 3 });
    expect(events).toHaveLength(3);
    expect(events[0].id).toBe('journal:j-0');
  });
});

describe('groupTimelineEvents (S1-T7)', () => {
  it('groups into Today / Yesterday / This Week / Earlier', () => {
    const events: TimelineEvent[] = [
      { id: 'today', kind: 'journal', timestamp: atLocalDaysAgo(0), title: 't' },
      { id: 'yesterday', kind: 'journal', timestamp: atLocalDaysAgo(1), title: 'y' },
      { id: 'week', kind: 'journal', timestamp: atLocalDaysAgo(3), title: 'w' },
      { id: 'earlier', kind: 'journal', timestamp: atLocalDaysAgo(10), title: 'e' },
    ];
    const groups = groupTimelineEvents(events, NOW);
    const byKey: Record<TimelineGroupKey, string> = { today: '', yesterday: '', week: '', earlier: '' };
    for (const group of groups) {
      byKey[group.key] = group.events[0].id;
      expect(group.events[0].id).toBe(group.key);
    }
    expect(byKey).toEqual({ today: 'today', yesterday: 'yesterday', week: 'week', earlier: 'earlier' });
  });

  it('omits empty groups', () => {
    const groups = groupTimelineEvents([
      { id: 'today', kind: 'journal', timestamp: atLocalDaysAgo(0), title: 't' },
    ], NOW);
    expect(groups.map((g) => g.key)).toEqual(['today']);
  });

  it('labels every event kind for the filter UI', () => {
    const kinds = Object.keys(TIMELINE_KIND_LABELS);
    expect(kinds.length).toBeGreaterThanOrEqual(16);
    for (const label of Object.values(TIMELINE_KIND_LABELS)) {
      expect(label.length).toBeGreaterThan(0);
    }
  });
});
