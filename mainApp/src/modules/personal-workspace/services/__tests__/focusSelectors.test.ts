import { describe, it, expect } from 'vitest';
import { selectFocusSession, type FocusInput } from '../focusSelectors';
import type { Task } from '@shared/types';
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

function baseInput(overrides: Partial<FocusInput> = {}): FocusInput {
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
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('selectFocusSession (S1-T5)', () => {
  it('returns the honest empty view when nothing is selected and no session runs', () => {
    const view = selectFocusSession(baseInput());
    expect(view.taskId).toBeNull();
    expect(view.title).toBeNull();
    expect(view.hasActiveSession).toBe(false);
    expect(view.subtasks).toEqual([]);
    expect(view.workLog).toBeNull();
  });

  it('follows the active timer task when no explicit task is selected', () => {
    const view = selectFocusSession(baseInput({
      tasks: [mkTask('t-1', { status: 'active', totalTime: 3_600_000 })],
      activeTaskId: 't-1',
      activeTimerState: 'running',
    }));
    expect(view.taskId).toBe('t-1');
    expect(view.title).toBe('Task t-1');
    expect(view.sessionState).toBe('running');
    expect(view.hasActiveSession).toBe(true);
    expect(view.totalTimeMs).toBe(3_600_000);
  });

  it('prefers the explicitly selected task over the active session task', () => {
    const view = selectFocusSession(baseInput({
      tasks: [
        mkTask('t-active', { status: 'active' }),
        mkTask('t-picked'),
      ],
      activeTaskId: 't-active',
      activeTimerState: 'running',
      focusTaskId: 't-picked',
    }));
    expect(view.taskId).toBe('t-picked');
    expect(view.hasActiveSession).toBe(false);
  });

  it('reports a paused session as paused, not running', () => {
    const view = selectFocusSession(baseInput({
      tasks: [mkTask('t-1', { status: 'paused' })],
      activeTaskId: 't-1',
      activeSessionId: 's-1',
      activeTimerState: 'paused',
    }));
    expect(view.sessionState).toBe('paused');
    expect(view.hasActiveSession).toBe(true);
  });

  it('surfaces the workspace → project → sprint → feature chain for a collab task', () => {
    const view = selectFocusSession(baseInput({
      collabTasks: [mkCollab('c-1', { sprintId: 'sp-1', featureId: 'f-1' })],
      workspaces: [mkWorkspace()],
      projects: [mkProject()],
      sprints: [mkSprint()],
      features: [mkFeature()],
      activeTaskId: 'c-1',
      activeTimerState: 'running',
    }));
    expect(view.isPersonal).toBe(false);
    expect(view.workspace?.label).toBe('Acme');
    expect(view.workspaceId).toBe('ws-1');
    expect(view.project?.label).toBe('FocusFlow');
    expect(view.sprint?.label).toBe('Sprint 24');
    expect(view.feature?.label).toBe('AI Copilot');
  });

  it('resolves missing sprint / feature / project / workspace honestly to null', () => {
    const view = selectFocusSession(baseInput({
      collabTasks: [mkCollab('c-1', { projectId: 'missing-project', sprintId: 'missing-sprint', featureId: 'missing-feature' })],
      workspaces: [],
      projects: [mkProject()],
      activeTaskId: 'c-1',
      activeTimerState: 'paused',
    }));
    expect(view.taskId).toBe('c-1');
    expect(view.title).toBe('Collab c-1');
    expect(view.project).toBeNull();
    expect(view.sprint).toBeNull();
    expect(view.feature).toBeNull();
    expect(view.workspace).toBeNull();
  });

  it('never fabricates a task that no longer resolves (deleted task)', () => {
    const view = selectFocusSession(baseInput({
      tasks: [mkTask('t-keep')],
      activeTaskId: 't-deleted',
      activeTimerState: 'running',
      focusTaskId: 't-deleted',
    }));
    expect(view.taskId).toBeNull();
    expect(view.title).toBeNull();
  });

  it('flags completed personal and done collab tasks', () => {
    const personal = selectFocusSession(baseInput({
      tasks: [mkTask('t-1', { status: 'completed' })],
      focusTaskId: 't-1',
    }));
    expect(personal.completed).toBe(true);

    const collab = selectFocusSession(baseInput({
      collabTasks: [mkCollab('c-1', { sprintStatus: 'done' })],
      focusTaskId: 'c-1',
    }));
    expect(collab.completed).toBe(true);
  });

  it('computes subtasks and points the next subtask at the first incomplete one', () => {
    const view = selectFocusSession(baseInput({
      tasks: [mkTask('t-1', {
        subtasks: [
          { id: 's-1', title: 'Setup', completed: true, createdAt: 1 },
          { id: 's-2', title: 'Build', completed: false, createdAt: 2 },
          { id: 's-3', title: 'Ship', completed: false, createdAt: 3 },
        ],
      })],
      focusTaskId: 't-1',
    }));
    expect(view.subtasks).toHaveLength(3);
    expect(view.nextSubtask?.id).toBe('s-2');
  });

  it('computes collab total time and estimated remaining work from hours', () => {
    const view = selectFocusSession(baseInput({
      collabTasks: [mkCollab('c-1', { estimatedHours: 8, actualHours: 2.5 })],
      focusTaskId: 'c-1',
    }));
    expect(view.totalTimeMs).toBe(2.5 * 3_600_000);
    expect(view.estimatedRemainingHours).toBeCloseTo(5.5);
  });

  it('leaves the estimate null for personal tasks and floors it at zero', () => {
    const personal = selectFocusSession(baseInput({
      tasks: [mkTask('t-1', { totalTime: 60_000 })],
      focusTaskId: 't-1',
    }));
    expect(personal.totalTimeMs).toBe(60_000);
    expect(personal.estimatedRemainingHours).toBeNull();

    const overEstimated = selectFocusSession(baseInput({
      collabTasks: [mkCollab('c-1', { estimatedHours: 2, actualHours: 4 })],
      focusTaskId: 'c-1',
    }));
    expect(overEstimated.estimatedRemainingHours).toBe(0);
  });

  it('picks the most severe unresolved central blocker and ignores resolved ones', () => {
    const view = selectFocusSession(baseInput({
      collabTasks: [mkCollab('c-1')],
      blockers: [
        mkBlocker('b-low', 'c-1', 'low'),
        mkBlocker('b-high', 'c-1', 'high'),
        mkBlocker('b-crit-resolved', 'c-1', 'critical', 'resolved'),
      ],
      focusTaskId: 'c-1',
    }));
    expect(view.blocker?.title).toBe('Blocker b-high');
    expect(view.blocker?.severity).toBe('high');
  });

  it('falls back to a structured blocker on a linked work log', () => {
    const log = mkLog('log-1', 't-1', {
      blockerList: [{ _id: 'sb-1', title: 'Structured blocker', severity: 'critical', status: 'open', notes: '', createdAt: 1 }],
    });
    const view = selectFocusSession(baseInput({
      tasks: [mkTask('t-1')],
      workLogs: [log],
      focusTaskId: 't-1',
    }));
    expect(view.blocker?.title).toBe('Structured blocker');
    expect(view.blocker?.severity).toBe('critical');
  });

  it('derives the session-notes indicator from journal entries, newest first', () => {
    const view = selectFocusSession(baseInput({
      tasks: [mkTask('t-1')],
      journals: [
        { id: 'j-old', taskId: 't-1', content: 'Older note', mood: 3, focusRating: 3, createdAt: 100, updatedAt: 100 },
        { id: 'j-new', taskId: 't-1', content: 'Fresh note', mood: 4, focusRating: 4, createdAt: 200, updatedAt: 200 },
        { id: 'j-other', taskId: 't-2', content: 'Other task', mood: 3, focusRating: 3, createdAt: 300, updatedAt: 300 },
      ],
      focusTaskId: 't-1',
    }));
    expect(view.hasSessionNotes).toBe(true);
    expect(view.latestNote?.content).toBe('Fresh note');
  });

  it('links the most recent non-done work log for the task and ignores done logs', () => {
    const view = selectFocusSession(baseInput({
      tasks: [mkTask('t-1')],
      workLogs: [
        mkLog('log-done', 't-1', { status: 'done', isActive: false }),
        mkLog('log-old', 't-1', { updatedAt: '2026-01-01T00:00:00.000Z' }),
        mkLog('log-new', 't-1', { updatedAt: '2026-01-05T00:00:00.000Z' }),
      ],
      focusTaskId: 't-1',
    }));
    expect(view.workLog?.id).toBe('log-new');
  });

  it('uses the feature description as the objective when the task has none', () => {
    const view = selectFocusSession(baseInput({
      collabTasks: [mkCollab('c-1', { description: '', featureId: 'f-1' })],
      features: [mkFeature()],
      focusTaskId: 'c-1',
    }));
    expect(view.objective).toBe('Feature objective');
  });
});
