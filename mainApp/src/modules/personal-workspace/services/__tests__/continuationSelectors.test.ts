import { describe, it, expect } from 'vitest';
import { selectTaskContinuation } from '../continuationSelectors';
import type { FocusInput } from '../focusSelectors';
import type { Task } from '@shared/types';
import type { WorkLog } from '@worklog/services/useWorkLogStore';
import type {
  CollaborativeTask, Feature, Project, Sprint, Workspace,
} from '@collab/types/collaboration';

const NOW = 1_700_000_000_000;

function mkTask(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title: `Task ${id}`,
    description: '',
    priority: 'medium',
    status: 'active',
    category: 'Work',
    color: '#0ea5e9',
    tags: [],
    subtasks: [],
    sessions: [],
    totalTime: 0,
    order: 0,
    createdAt: NOW - 60_000,
    updatedAt: NOW - 60_000,
    ...overrides,
  };
}

function mkCollab(id: string, overrides: Partial<CollaborativeTask> = {}): CollaborativeTask {
  return {
    id,
    workspaceId: 'ws-1',
    projectId: 'p-1',
    title: `Collab ${id}`,
    description: 'Collaborative objective',
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

function mkLog(id: string, overrides: Partial<WorkLog> = {}): WorkLog {
  return {
    _id: id,
    title: `Log ${id}`,
    status: 'in-progress',
    isActive: true,
    taskRef: undefined,
    problemFlow: { problem: '', investigation: '', rootCause: '', solution: '', lessonsLearned: '' },
    problem: '',
    gitBranch: '',
    currentWork: '',
    plan: '',
    designNotes: '',
    blockers: '',
    gitRef: { repository: '', branch: '', commitIds: [], prNumber: '', issueNumber: '' },
    timelineEntries: [],
    decisions: [],
    blockerList: [],
    progressSnapshots: [],
    completedItems: [],
    links: [],
    attachments: [],
    workEntries: [],
    tomorrowPlan: { topPriority: '', unfinishedItems: [], attentionRequired: '' },
    reflection: { wentWell: '', slowedDown: '', learned: '', improvement: '', rating: 0 },
    moodMetrics: { energy: 0, focus: 0, stress: 0, confidence: 0, motivation: 0 },
    mood: 3,
    tags: [],
    totalActiveMs: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function mkFeature(id = 'f-1'): Feature {
  return {
    id, projectId: 'p-1', workspaceId: 'ws-1', name: 'AI Copilot', description: '',
    type: 'feature', labels: [], estimatedHours: 8, status: 'in_progress', order: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function mkWorkspace(id = 'ws-1'): Workspace {
  return {
    id, name: 'Acme', type: 'Startup', icon: '🚀', description: '', membersCount: 0,
    projectsCount: 0, createdAt: '2026-01-01T00:00:00.000Z', settings: {} as Workspace['settings'],
  };
}

function mkProject(id = 'p-1'): Project {
  return {
    id, workspaceId: 'ws-1', name: 'FocusFlow', key: 'FF', description: '', members: [],
    teamIds: [], status: 'active', milestones: [], createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function mkSprint(id = 'sp-1'): Sprint {
  return {
    id, workspaceId: 'ws-1', projectId: 'p-1', name: 'Sprint 24', startDate: '2026-08-03',
    endDate: '2026-08-17', goal: '', status: 'active', capacityHours: 160, targetVelocity: 80,
  };
}

function mkInput(overrides: Partial<FocusInput> = {}): FocusInput {
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
    now: NOW,
    ...overrides,
  };
}

describe('selectTaskContinuation (S2-T1)', () => {
  it('returns the honest empty view when no task is targetable', () => {
    const view = selectTaskContinuation(mkInput());
    expect(view.taskId).toBeNull();
    expect(view.title).toBeNull();
    expect(view.git).toEqual({ branch: null, pr: null });
    expect(view.whereIStopped).toBeNull();
    expect(view.workLog).toBeNull();
    expect(view.hasActiveSession).toBe(false);
  });

  it('resolves a personal task and links its session, subtasks and totals', () => {
    const view = selectTaskContinuation(mkInput({
      tasks: [mkTask('t-1', {
        totalTime: 3_600_000,
        subtasks: [
          { id: 's-1', title: 'Setup', completed: true, createdAt: 1 },
          { id: 's-2', title: 'Build prompt flow', completed: false, createdAt: 2 },
        ],
      })],
      focusTaskId: 't-1',
      activeTaskId: 't-1',
      activeSessionId: 'sess-1',
      activeTimerState: 'running',
    }));
    expect(view.taskId).toBe('t-1');
    expect(view.title).toBe('Task t-1');
    expect(view.isPersonal).toBe(true);
    expect(view.completed).toBe(false);
    expect(view.subtasksDone).toBe(1);
    expect(view.subtasksTotal).toBe(2);
    expect(view.nextSubtask?.title).toBe('Build prompt flow');
    expect(view.totalTimeMs).toBe(3_600_000);
    expect(view.hasActiveSession).toBe(true);
    expect(view.sessionState).toBe('running');
  });

  it('distinguishes paused (continuable) from idle (not running) sessions', () => {
    const paused = selectTaskContinuation(mkInput({
      tasks: [mkTask('t-1')],
      focusTaskId: 't-1',
      activeTaskId: 't-1',
      activeTimerState: 'paused',
    }));
    expect(paused.hasActiveSession).toBe(true);
    expect(paused.sessionState).toBe('paused');

    const idle = selectTaskContinuation(mkInput({
      tasks: [mkTask('t-1')],
      focusTaskId: 't-1',
      activeTaskId: 't-1',
      activeTimerState: 'idle',
    }));
    expect(idle.hasActiveSession).toBe(false);
    expect(idle.sessionState).toBe('idle');

    const otherTaskRunning = selectTaskContinuation(mkInput({
      tasks: [mkTask('t-1')],
      focusTaskId: 't-1',
      activeTaskId: 't-2',
      activeTimerState: 'running',
    }));
    expect(otherTaskRunning.hasActiveSession).toBe(false);
    expect(otherTaskRunning.sessionState).toBe('running');
  });

  it('maps the workspace → project → sprint → feature chain for collab tasks', () => {
    const collab = mkCollab('c-1', { sprintId: 'sp-1', featureId: 'f-1' });
    const view = selectTaskContinuation(mkInput({
      collabTasks: [collab],
      workspaces: [mkWorkspace()],
      projects: [mkProject()],
      sprints: [mkSprint()],
      features: [mkFeature()],
      focusTaskId: 'c-1',
    }));
    expect(view.isPersonal).toBe(false);
    expect(view.workspace?.label).toBe('Acme');
    expect(view.project?.label).toBe('FocusFlow');
    expect(view.sprint?.label).toBe('Sprint 24');
    expect(view.feature?.label).toBe('AI Copilot');
  });

  it('resolves git branch + PR from the collab task gitContext', () => {
    const collab = mkCollab('c-1', {
      gitContext: {
        branch: 'feat/continuation',
        prNumber: 42,
        prUrl: 'https://github.com/acme/focusflow/pull/42',
        reviewStatus: 'approved',
        mergeStatus: 'open',
      },
    });
    const view = selectTaskContinuation(mkInput({ collabTasks: [collab], focusTaskId: 'c-1' }));
    expect(view.git.branch).toBe('feat/continuation');
    expect(view.git.pr?.number).toBe('42');
    expect(view.git.pr?.url).toBe('https://github.com/acme/focusflow/pull/42');
    expect(view.git.pr?.reviewStatus).toBe('approved');
    expect(view.git.pr?.mergeStatus).toBe('open');
  });

  it('falls back to the linked work log git fields when the task has no gitContext', () => {
    const log = mkLog('log-1', {
      taskRef: { _id: 't-1', title: 'Task t-1', color: '#fff', category: 'Work', totalTime: 0 },
      gitBranch: 'feat/personal',
      gitRef: { repository: 'acme/repo', branch: 'feat/personal', commitIds: ['abc123'], prNumber: '12', issueNumber: '' },
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
    const view = selectTaskContinuation(mkInput({
      tasks: [mkTask('t-1')],
      workLogs: [log],
      focusTaskId: 't-1',
    }));
    expect(view.git.branch).toBe('feat/personal');
    expect(view.git.pr?.number).toBe('12');
  });

  it('derives the PR url from a PR-category link when the work log has one', () => {
    const log = mkLog('log-1', {
      taskRef: { _id: 't-1', title: 'Task t-1', color: '#fff', category: 'Work', totalTime: 0 },
      links: [{ _id: 'lk-1', label: 'PR #7', url: 'https://github.com/acme/repo/pull/7', category: 'PR' }],
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
    const view = selectTaskContinuation(mkInput({
      tasks: [mkTask('t-1')],
      workLogs: [log],
      focusTaskId: 't-1',
    }));
    expect(view.git.branch).toBeNull();
    expect(view.git.pr?.number).toBeNull();
    expect(view.git.pr?.url).toBe('https://github.com/acme/repo/pull/7');
  });

  it('returns no git when neither task nor work log carries any', () => {
    const view = selectTaskContinuation(mkInput({
      tasks: [mkTask('t-1')],
      focusTaskId: 't-1',
    }));
    expect(view.git).toEqual({ branch: null, pr: null });
  });

  it('uses the last journal note as where-I-stopped when no work log exists', () => {
    const view = selectTaskContinuation(mkInput({
      tasks: [mkTask('t-1')],
      journals: [
        { id: 'j-1', taskId: 't-1', content: 'Prompt tuning works', mood: 4, focusRating: 4, createdAt: NOW - 1_000, updatedAt: NOW - 1_000 },
      ],
      focusTaskId: 't-1',
    }));
    expect(view.whereIStopped?.source).toBe('journal');
    expect(view.whereIStopped?.text).toBe('Prompt tuning works');
    expect(view.whereIStopped?.at).toBe(NOW - 1_000);
    expect(view.whereIStopped?.workLogId).toBeNull();
  });

  it('ranks the newest artifact across progress, entries and journals', () => {
    const log = mkLog('log-1', {
      taskRef: { _id: 't-1', title: 'Task t-1', color: '#fff', category: 'Work', totalTime: 0 },
      progressSnapshots: [
        { _id: 'snap-1', period: 'Morning', text: 'Mid-morning snapshot', timestamp: NOW - 5_000 },
      ],
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
    const view = selectTaskContinuation(mkInput({
      tasks: [mkTask('t-1')],
      workLogs: [log],
      journals: [
        { id: 'j-1', taskId: 't-1', content: 'A more recent journal note', mood: 4, focusRating: 4, createdAt: NOW - 1_000, updatedAt: NOW - 1_000 },
      ],
      focusTaskId: 't-1',
    }));
    expect(view.whereIStopped?.source).toBe('journal');
    expect(view.whereIStopped?.text).toBe('A more recent journal note');
    expect(view.whereIStopped?.workLogId).toBeNull();
  });

  it('falls back to the work log currentWork field when nothing is timestamped', () => {
    const log = mkLog('log-1', {
      taskRef: { _id: 't-1', title: 'Task t-1', color: '#fff', category: 'Work', totalTime: 0 },
      currentWork: 'Wiring the continuation selector',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
    const view = selectTaskContinuation(mkInput({
      tasks: [mkTask('t-1')],
      workLogs: [log],
      focusTaskId: 't-1',
    }));
    expect(view.whereIStopped?.source).toBe('worklog');
    expect(view.whereIStopped?.text).toBe('Wiring the continuation selector');
    expect(view.whereIStopped?.at).toBeNull();
    expect(view.whereIStopped?.workLogId).toBe('log-1');
  });

  it('skips work entries that carry no usable timestamp', () => {
    const log = mkLog('log-1', {
      taskRef: { _id: 't-1', title: 'Task t-1', color: '#fff', category: 'Work', totalTime: 0 },
      workEntries: [
        { _id: 'we-1', date: '2026-01-02', what: 'Started the grid', activeMs: 60_000 },
      ],
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
    const view = selectTaskContinuation(mkInput({
      tasks: [mkTask('t-1')],
      workLogs: [log],
      focusTaskId: 't-1',
    }));
    expect(view.whereIStopped).toBeNull();
  });

  it('prefers the most recently updated of several linked work logs', () => {
    const oldLog = mkLog('log-old', {
      taskRef: { _id: 't-1', title: 'Task t-1', color: '#fff', category: 'Work', totalTime: 0 },
      currentWork: 'Old state',
      updatedAt: '2026-01-01T08:00:00.000Z',
    });
    const newLog = mkLog('log-new', {
      taskRef: { _id: 't-1', title: 'Task t-1', color: '#fff', category: 'Work', totalTime: 0 },
      currentWork: 'Fresh state',
      updatedAt: '2026-01-02T08:00:00.000Z',
    });
    const view = selectTaskContinuation(mkInput({
      tasks: [mkTask('t-1')],
      workLogs: [oldLog, newLog],
      focusTaskId: 't-1',
    }));
    expect(view.workLog?.id).toBe('log-new');
    expect(view.whereIStopped?.workLogId).toBe('log-new');
    expect(view.whereIStopped?.text).toBe('Fresh state');
  });

  it('breaks timestamp ties toward structured progress over notes', () => {
    const log = mkLog('log-1', {
      taskRef: { _id: 't-1', title: 'Task t-1', color: '#fff', category: 'Work', totalTime: 0 },
      progressSnapshots: [
        { _id: 'snap-1', period: 'Morning', text: 'Snapshot text', timestamp: NOW - 1_000 },
      ],
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
    const view = selectTaskContinuation(mkInput({
      tasks: [mkTask('t-1')],
      workLogs: [log],
      journals: [
        { id: 'j-1', taskId: 't-1', content: 'Journal note', mood: 4, focusRating: 4, createdAt: NOW - 1_000, updatedAt: NOW - 1_000 },
      ],
      focusTaskId: 't-1',
    }));
    expect(view.whereIStopped?.source).toBe('progress');
    expect(view.whereIStopped?.text).toBe('Snapshot text');
  });

  it('surfaces an honest completed state', () => {
    const view = selectTaskContinuation(mkInput({
      tasks: [mkTask('t-1', { status: 'completed' })],
      focusTaskId: 't-1',
    }));
    expect(view.completed).toBe(true);
    expect(view.status).toBe('completed');
  });

  it('keeps the view honest when the target task was deleted', () => {
    const view = selectTaskContinuation(mkInput({
      tasks: [],
      collabTasks: [],
      focusTaskId: 'deleted-1',
    }));
    expect(view.taskId).toBeNull();
    expect(view.title).toBeNull();
  });
});
