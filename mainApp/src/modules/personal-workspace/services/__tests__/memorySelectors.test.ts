import { describe, it, expect } from 'vitest';
import {
  mapSession, selectEngineeringMemory, selectMemory,
  type MemoryInput, type MemorySession,
} from '../memorySelectors';
import type { Task, JournalEntry } from '@shared/types';
import type { WorkLog } from '@worklog/services/useWorkLogStore';
import type { CentralBlocker, CollaborativeTask, Feature, Project, Sprint, Workspace } from '@collab/types/collaboration';

// ── Factories (honest, minimal) ───────────────────────────────────────────────

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
    order: 0,
    createdAt: Date.now() - 60_000,
    updatedAt: Date.now() - 60_000,
    ...overrides,
  };
}

function mkCollab(id: string, overrides: Partial<CollaborativeTask> = {}): CollaborativeTask {
  return {
    id,
    workspaceId: 'ws-1',
    projectId: 'p-1',
    sprintId: 'sp-1',
    featureId: 'f-1',
    title: `Collab ${id}`,
    description: '',
    sprintStatus: 'in_progress',
    priority: 'medium',
    ownerId: 'u-1',
    followerIds: [],
    labels: [],
    dependencies: [],
    estimatedHours: 0,
    actualHours: 0,
    subtasks: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

function mkLog(id: string, taskId: string, overrides: Partial<WorkLog> = {}): WorkLog {
  return {
    _id: id,
    title: `Log ${id}`,
    status: 'in-progress',
    isActive: true,
    taskRef: { _id: taskId, title: 'Task', color: '#fff', category: 'Work', totalTime: 0 },
    updatedAt: '2026-01-03T00:00:00.000Z',
    blockerList: [],
    workEntries: [],
    currentWork: '',
    plan: '',
    ...overrides,
  } as WorkLog;
}

function mkBlocker(id: string, taskId: string, severity: CentralBlocker['severity'], status: CentralBlocker['status'] = 'open'): CentralBlocker {
  return {
    id, workspaceId: 'ws-1', taskId, title: `Blocker ${id}`, severity,
    ownerId: 'u-1', reporterId: 'u-1', status,
    impactDescription: '', createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function mkWorkspace(id = 'ws-1'): Workspace {
  return {
    id, name: 'Acme', type: 'Startup', icon: '🚀', description: '', membersCount: 0, projectsCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z', settings: {} as Workspace['settings'],
  };
}

function mkProject(id = 'p-1'): Project {
  return {
    id, workspaceId: 'ws-1', name: 'FocusFlow', key: 'FF', description: '', members: [], teamIds: [],
    status: 'active', milestones: [], createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function mkSprint(id = 'sp-1'): Sprint {
  return {
    id, workspaceId: 'ws-1', projectId: 'p-1', name: 'Sprint 24', startDate: '2026-01-01', endDate: '2026-01-15',
    goal: '', status: 'active', capacityHours: 160, targetVelocity: 80,
  };
}

function mkFeature(id = 'f-1'): Feature {
  return {
    id, projectId: 'p-1', workspaceId: 'ws-1', name: 'AI Copilot', description: 'Feature objective', type: 'feature',
    labels: [], estimatedHours: 8, status: 'in_progress', order: 0, createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function mkJournal(id: string, taskId: string, content: string, createdAt: number): JournalEntry {
  return {
    id, taskId, content, mood: 4, focusRating: 3,
    createdAt, updatedAt: createdAt,
  };
}

function mkSession(id: string, overrides: Partial<MemorySession> = {}): MemorySession {
  return {
    id,
    taskId: 't-1',
    startTime: 1_700_000_000_000,
    endTime: 1_700_003_600_000,
    activeTime: 3_600_000,
    totalPauseDuration: 0,
    pauseCount: 0,
    isActive: false,
    focusScore: 82,
    pauseLog: [],
    ...overrides,
  };
}

function baseInput(overrides: Partial<MemoryInput> = {}): MemoryInput {
  return {
    tasks: [],
    collabTasks: [],
    workspaces: [],
    projects: [],
    sprints: [],
    features: [],
    workLogs: [],
    blockers: [],
    journals: [],
    activeTaskId: null,
    activeSessionId: null,
    activeTimerState: 'idle',
    focusTaskId: null,
    sessions: [],
    currentSessionStart: null,
    currentPauseStart: null,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('mapSession (S1-T6)', () => {
  it('maps a server session document into a MemorySession', () => {
    const doc = {
      _id: 's-1',
      taskId: { _id: 't-1' },
      startTime: 1_700_000_000_000,
      endTime: 1_700_003_600_000,
      activeTime: 3_600_000,
      totalPauseDuration: 120_000,
      pauseCount: 1,
      isActive: false,
      focusScore: 77,
      pauseLog: [{ pauseStart: 1_700_001_000_000, resumeTime: 1_700_001_120_000 }],
    };
    expect(mapSession(doc)).toEqual({
      id: 's-1',
      taskId: 't-1',
      startTime: 1_700_000_000_000,
      endTime: 1_700_003_600_000,
      activeTime: 3_600_000,
      totalPauseDuration: 120_000,
      pauseCount: 1,
      isActive: false,
      focusScore: 77,
      pauseLog: [{ pauseStart: 1_700_001_000_000, resumeTime: 1_700_001_120_000 }],
    });
  });

  it('coerces missing values to honest defaults (no fabrication)', () => {
    const doc = { _id: 's-2' };
    expect(mapSession(doc)).toEqual({
      id: 's-2',
      taskId: '',
      startTime: 0,
      endTime: null,
      activeTime: 0,
      totalPauseDuration: 0,
      pauseCount: 0,
      isActive: false,
      focusScore: null,
      pauseLog: [],
    });
  });
});

describe('selectEngineeringMemory (S1-T6)', () => {
  it('returns the honest empty view when nothing exists', () => {
    const view = selectEngineeringMemory(baseInput());
    expect(view.taskId).toBeNull();
    expect(view.taskTitle).toBeNull();
    expect(view.hasActiveSession).toBe(false);
    expect(view.hasAnyMemory).toBe(false);
    expect(view.previousSession).toBeNull();
    expect(view.linkedWorkLog).toBeNull();
    expect(view.lastWorkLog).toBeNull();
    expect(view.lastJournalNote).toBeNull();
    expect(view.recentDecisions).toEqual([]);
    expect(view.blockerCount).toBe(0);
    expect(view.completeness).toBe(0);
    expect(view.totalFacets).toBe(10);
    expect(view.facets.every((f) => f.present === false)).toBe(true);
  });

  it('uses the active task id when no explicit focus task is given', () => {
    const view = selectEngineeringMemory(
      baseInput({ tasks: [mkTask('t-1')], activeTaskId: 't-1' }),
    );
    expect(view.taskId).toBe('t-1');
    expect(view.taskTitle).toBe('Task t-1');
    expect(view.facets.find((f) => f.key === 'task')?.present).toBe(true);
  });

  it('resolves the collaboration context chain (workspace/project/sprint/feature)', () => {
    const view = selectEngineeringMemory(
      baseInput({
        collabTasks: [mkCollab('c-1')],
        workspaces: [mkWorkspace()],
        projects: [mkProject()],
        sprints: [mkSprint()],
        features: [mkFeature()],
        focusTaskId: 'c-1',
      }),
    );
    expect(view.taskId).toBe('c-1');
    expect(view.workspace?.label).toBe('Acme');
    expect(view.project?.label).toBe('FocusFlow');
    expect(view.sprint?.label).toBe('Sprint 24');
    expect(view.feature?.label).toBe('AI Copilot');
    expect(view.facets.filter((f) => f.present).map((f) => f.key))
      .toEqual(['task', 'workspace', 'project', 'sprint', 'feature']);
    expect(view.completeness).toBe(5);
  });

  it('picks the most recently updated work log as lastWorkLog', () => {
    const old = mkLog('wl-1', 't-1', { updatedAt: '2026-01-01T00:00:00.000Z' });
    const latest = mkLog('wl-2', 't-1', { updatedAt: '2026-02-01T00:00:00.000Z' });
    const view = selectEngineeringMemory(
      baseInput({ workLogs: [old, latest], activeTaskId: 't-1' }),
    );
    expect(view.lastWorkLog?.id).toBe('wl-2');
    expect(view.lastWorkLog?.title).toBe('Log wl-2');
  });

  it('resolves the linked work log for the focused task', () => {
    const linked = mkLog('wl-9', 't-1', {
      workEntries: [
        {
          _id: 'e-1', date: '2026-01-01', what: 'Refactor engine', activeMs: 0,
          sessionIds: ['s-9'],
        },
      ],
    });
    const view = selectEngineeringMemory(
      baseInput({ workLogs: [linked], focusTaskId: 't-1', tasks: [mkTask('t-1')] }),
    );
    expect(view.linkedWorkLog?.id).toBe('wl-9');
    expect(view.linkedWorkLog?.sessionCount).toBe(1);
  });

  it('ranks the last journal note and prefers the note linked to the task', () => {
    const newerOther = mkJournal('j-1', 't-9', 'Latest reflection', 3_000_000_000_000);
    const olderTask = mkJournal('j-2', 't-1', 'Task note', 2_000_000_000_000);
    const view = selectEngineeringMemory(
      baseInput({ journals: [newerOther, olderTask], focusTaskId: 't-1', tasks: [mkTask('t-1')] }),
    );
    expect(view.lastJournalNote?.content).toBe('Latest reflection');
    expect(view.taskJournalNote?.content).toBe('Task note');
    expect(view.lastJournalNote?.mood).toBe(4);
  });

  it('surfaces a previous session summary from closed sessions', () => {
    const older = mkSession('s-1', { startTime: 1_000_000_000_000, activeTime: 900_000, totalPauseDuration: 60_000, pauseCount: 1, focusScore: 71 });
    const newer = mkSession('s-2', { startTime: 2_000_000_000_000, activeTime: 1_800_000 });
    const view = selectEngineeringMemory(baseInput({ sessions: [older, newer], focusTaskId: 't-1', tasks: [mkTask('t-1', { totalTime: 3_000_000 })] }));
    expect(view.previousSession?.id).toBe('s-2');
    expect(view.previousSession?.taskTitle).toBe('Task t-1');
    expect(view.previousSession?.activeTime).toBe(1_800_000);
    expect(view.hasAnyMemory).toBe(true);
    expect(view.totalTimeOnTaskMs).toBe(3_000_000);
  });

  it('derives lastResumeAt and currentPauseAt from the active session pause log', () => {
    const active = mkSession('s-3', {
      isActive: true,
      startTime: 1_000_000_000_000,
      pauseLog: [
        { pauseStart: 1_000_001_000_000, resumeTime: 1_000_001_120_000 },
        { pauseStart: 1_000_002_000_000, resumeTime: null },
      ],
    });
    const view = selectEngineeringMemory(
      baseInput({
        sessions: [active],
        activeSessionId: 's-3',
        activeTaskId: 't-1',
        activeTimerState: 'paused',
        tasks: [mkTask('t-1')],
      }),
    );
    expect(view.hasActiveSession).toBe(true);
    expect(view.sessionState).toBe('paused');
    expect(view.activeSessionId).toBe('s-3');
    expect(view.lastResumeAt).toBe(1_000_001_120_000);
    expect(view.currentPauseAt).toBe(1_000_002_000_000);
  });

  it('falls back to session start when the active session has no pause log', () => {
    const active = mkSession('s-4', { isActive: true, startTime: 5_000_000_000_000, pauseLog: [] });
    const view = selectEngineeringMemory(
      baseInput({ sessions: [active], activeSessionId: 's-4' }),
    );
    expect(view.lastResumeAt).toBe(5_000_000_000_000);
    expect(view.currentPauseAt).toBeNull();
  });

  it('uses the live timer snapshot when the active session is not yet in the list', () => {
    const view = selectEngineeringMemory(
      baseInput({
        activeTaskId: 't-1',
        activeSessionId: 'live-1',
        activeTimerState: 'running',
        currentSessionStart: 4_000_000_000_000,
        currentPauseStart: 4_000_100_000_000,
        tasks: [mkTask('t-1')],
      }),
    );
    expect(view.hasActiveSession).toBe(true);
    expect(view.sessionStartAt).toBe(4_000_000_000_000);
    expect(view.currentPauseAt).toBe(4_000_100_000_000);
  });

  it('collects recent engineering decisions from work logs (newest first, capped at 3)', () => {
    const log = mkLog('wl-5', 't-1', {
      decisions: [
        { _id: 'd-1', title: 'Old', context: '', decision: 'x', alternatives: '', rationale: 'r', timestamp: 1_000_000_000_000 },
        { _id: 'd-2', title: 'Mid', context: '', decision: 'y', alternatives: '', rationale: 'r', timestamp: 2_000_000_000_000 },
        { _id: 'd-3', title: 'New', context: '', decision: 'z', alternatives: '', rationale: 'r', timestamp: 3_000_000_000_000 },
        { _id: 'd-4', title: 'Older', context: '', decision: 'w', alternatives: '', rationale: 'r', timestamp: 500_000_000_000 },
      ],
    });
    const view = selectEngineeringMemory(baseInput({ workLogs: [log], focusTaskId: 't-1' }));
    expect(view.recentDecisions.map((d) => d.title)).toEqual(['New', 'Mid', 'Old']);
    expect(view.recentDecisions[0]?.workLogTitle).toBe('Log wl-5');
  });

  it('counts only open blockers for the focused task', () => {
    const view = selectEngineeringMemory(
      baseInput({
        focusTaskId: 't-1',
        tasks: [mkTask('t-1')],
        blockers: [
          mkBlocker('b-1', 't-1', 'high', 'open'),
          mkBlocker('b-2', 't-1', 'medium', 'investigating'),
          mkBlocker('b-3', 't-1', 'high', 'resolved'),
          mkBlocker('b-4', 't-2', 'high', 'open'),
        ],
      }),
    );
    expect(view.blockerCount).toBe(2);
  });

  it('marks subtasks present only when the focused task has them', () => {
    const withSubtasks = selectEngineeringMemory(
      baseInput({ focusTaskId: 't-1', tasks: [mkTask('t-1', { subtasks: [{ id: 'st-1', title: 'Step', completed: false, createdAt: 1_000_000_000_000 }] })] }),
    );
    expect(withSubtasks.subtaskCount).toBe(1);
    expect(withSubtasks.facets.find((f) => f.key === 'subtasks')?.present).toBe(true);

    const without = selectEngineeringMemory(baseInput({ focusTaskId: 't-1' }));
    expect(without.subtaskCount).toBe(0);
    expect(without.facets.find((f) => f.key === 'subtasks')?.present).toBe(false);
  });

  it('computes completeness from present facets only', () => {
    const view = selectEngineeringMemory(
      baseInput({
        focusTaskId: 't-1',
        collabTasks: [mkCollab('t-1')],
        workspaces: [mkWorkspace()],
        projects: [mkProject()],
        sprints: [mkSprint()],
        features: [mkFeature()],
        workLogs: [mkLog('wl-8', 't-1', { decisions: [{ _id: 'd-1', title: 'Dec', context: '', decision: 'd', alternatives: '', rationale: 'r', timestamp: 1_000_000_000_000 }] })],
      }),
    );
    expect(view.completeness).toBe(7);
    expect(view.totalFacets).toBe(10);
  });
});

describe('selectMemory (S3-T1)', () => {
  it('resolves whereStopped to the newest timeline node', () => {
    const log = mkLog('wl-mem-1', 't-1', {
      timelineEntries: [
        { _id: 'tl-1', timestamp: 100, type: 'note', title: 'Started debugging', description: '', category: '' },
        { _id: 'tl-2', timestamp: 200, type: 'snapshot', title: 'Snapshot at noon', description: '', category: '' },
      ],
      completedItems: [
        { _id: 'ci-1', text: 'Shipped the focus loop', category: 'feature', done: true, completedAt: 300, createdAt: 200 },
      ],
    });
    const view = selectMemory(log);
    expect(view.whereStopped).toEqual({
      id: 'wl-mem-1:ci:ci-1',
      kind: 'completed_item',
      label: 'Completed item',
      title: 'Shipped the focus loop',
      description: 'Completed item',
      timestamp: 300,
    });
  });

  it('returns null whereStopped when the log has no events', () => {
    const view = selectMemory(mkLog('wl-empty', 't-1', { timelineEntries: [] }));
    expect(view.whereStopped).toBeNull();
  });

  it('sorts decisions newest first', () => {
    const view = selectMemory(mkLog('wl-dec', 't-1', {
      decisions: [
        { _id: 'd-1', title: 'Old', context: '', decision: '', alternatives: '', rationale: '', timestamp: 100 },
        { _id: 'd-2', title: 'New', context: '', decision: '', alternatives: '', rationale: '', timestamp: 300 },
        { _id: 'd-3', title: 'Mid', context: '', decision: '', alternatives: '', rationale: '', timestamp: 200 },
      ],
    }));
    expect(view.decisions.map((d) => d._id)).toEqual(['d-2', 'd-3', 'd-1']);
  });

  it('sorts blockers open-first then newest, resolved last', () => {
    const view = selectMemory(mkLog('wl-blk', 't-1', {
      blockerList: [
        { _id: 'b-1', title: 'Resolved', severity: 'high', status: 'resolved', notes: '', createdAt: 300 },
        { _id: 'b-2', title: 'Open old', severity: 'low', status: 'open', notes: '', createdAt: 100 },
        { _id: 'b-3', title: 'Open new', severity: 'medium', status: 'open', notes: '', createdAt: 200 },
      ],
    }));
    expect(view.blockers.map((b) => b._id)).toEqual(['b-3', 'b-2', 'b-1']);
  });

  it('sorts snapshots newest first', () => {
    const view = selectMemory(mkLog('wl-snap', 't-1', {
      progressSnapshots: [
        { _id: 's-1', period: 'Morning', text: 'a', timestamp: 100 },
        { _id: 's-2', period: 'Afternoon', text: 'b', timestamp: 300 },
        { _id: 's-3', period: 'Evening', text: 'c', timestamp: 200 },
      ],
    }));
    expect(view.snapshots.map((s) => s._id)).toEqual(['s-2', 's-3', 's-1']);
  });

  it('returns null reflection when every field is blank or missing', () => {
    expect(selectMemory(mkLog('wl-refl-1', 't-1')).reflection).toBeNull();
    const blank = selectMemory(mkLog('wl-refl-2', 't-1', {
      reflection: { wentWell: '', slowedDown: '   ', learned: '', improvement: '', rating: 4 },
    }));
    expect(blank.reflection).toBeNull();
  });

  it('returns the reflection once any field is filled', () => {
    const filled = { wentWell: 'Shipped the loop', slowedDown: '', learned: '', improvement: '', rating: 5 };
    const view = selectMemory(mkLog('wl-refl-3', 't-1', { reflection: filled }));
    expect(view.reflection).toEqual(filled);
  });
});
