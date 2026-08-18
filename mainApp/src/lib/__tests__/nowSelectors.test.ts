import { describe, it, expect } from 'vitest';
import { selectNowStrip } from '../nowSelectors';
import type { Task } from '../../types';
import type { CollaborativeTask, Feature, Project, Sprint, Workspace } from '../../types/collaboration';

function mkTask(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title: id,
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

function mkCollabTask(id: string, overrides: Partial<CollaborativeTask> = {}): CollaborativeTask {
  return {
    id,
    workspaceId: 'ws-1',
    projectId: 'p-1',
    title: id,
    description: '',
    sprintStatus: 'in_progress',
    priority: 'high',
    ownerId: 'u-1',
    followerIds: [],
    labels: [],
    dependencies: [],
    estimatedHours: 2,
    actualHours: 0,
    subtasks: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const workspace: Workspace = {
  id: 'ws-1', name: 'FocusFlow', type: 'Startup', icon: '⚡', description: '',
  membersCount: 4, projectsCount: 1, createdAt: '2026-01-01',
  settings: { allowMemberInvites: true, requireReviewForDone: false, autoSyncTimerWorkLogs: true, defaultVisibility: 'Workspace' },
};
const project: Project = {
  id: 'p-1', workspaceId: 'ws-1', name: 'Companion', key: 'COMP', description: '',
  members: [], teamIds: [], status: 'active', milestones: [], createdAt: '2026-01-01',
};
const sprint: Sprint = {
  id: 'sp-1', workspaceId: 'ws-1', projectId: 'p-1', name: 'Sprint 24',
  startDate: '2026-08-03', endDate: '2026-08-17', goal: '', status: 'active',
  capacityHours: 160, targetVelocity: 80,
};
const feature: Feature = {
  id: 'f-1', projectId: 'p-1', sprintId: 'sp-1', workspaceId: 'ws-1', name: 'Now Strip',
  description: '', type: 'feature', labels: [], ownerId: 'u-1', estimatedHours: 8,
  status: 'in_progress', order: 0, createdAt: '2026-01-01',
};

describe('selectNowStrip (S1-T3)', () => {
  it('returns the honest none-state when there is no active task', () => {
    const now = selectNowStrip({
      tasks: [mkTask('t-1')], collabTasks: [], workspaces: [], projects: [], sprints: [], features: [],
      activeTaskId: null, activeSessionId: null, activeTimerState: 'idle',
    });
    expect(now.state).toBe('none');
    expect(now.title).toBeNull();
    expect(now.workspace).toBeNull();
    expect(now.sessionState).toBe('idle');
  });

  it('returns none (no fabricated title) when the active task cannot be resolved', () => {
    const now = selectNowStrip({
      tasks: [mkTask('t-1')], collabTasks: [], workspaces: [], projects: [], sprints: [], features: [],
      activeTaskId: 'ghost-id', activeSessionId: null, activeTimerState: 'paused',
    });
    expect(now.state).toBe('none');
    expect(now.title).toBeNull();
    expect(now.sessionState).toBe('paused');
  });

  it('resolves a personal task without a collab chain', () => {
    const now = selectNowStrip({
      tasks: [mkTask('t-1', { title: 'Build the Today page' })],
      collabTasks: [], workspaces: [workspace], projects: [project], sprints: [sprint], features: [feature],
      activeTaskId: 't-1', activeSessionId: 's-1', activeTimerState: 'running',
    });
    expect(now.state).toBe('personal');
    expect(now.title).toBe('Build the Today page');
    expect(now.workspace).toBeNull();
    expect(now.project).toBeNull();
    expect(now.sessionState).toBe('running');
  });

  it('resolves the full collab chain for a collaborative task', () => {
    const task = mkCollabTask('c-1', {
      sprintId: 'sp-1', featureId: 'f-1', gitContext: { branch: 'feat/now-strip', repository: 'focusflow' },
      subtasks: [
        { id: 's1', title: 'selector', completed: true },
        { id: 's2', title: 'strip', completed: true },
        { id: 's3', title: 'wiring', completed: false },
      ],
    });
    const now = selectNowStrip({
      tasks: [], collabTasks: [task],
      workspaces: [workspace], projects: [project], sprints: [sprint], features: [feature],
      activeTaskId: 'c-1', activeSessionId: 's-1', activeTimerState: 'running',
    });
    expect(now.state).toBe('collab');
    expect(now.title).toBe('c-1');
    expect(now.workspace?.label).toBe('FocusFlow');
    expect(now.workspaceId).toBe('ws-1');
    expect(now.project?.label).toBe('Companion');
    expect(now.sprint?.label).toBe('Sprint 24');
    expect(now.feature?.label).toBe('Now Strip');
    expect(now.branch).toBe('feat/now-strip');
    expect(now.subtasksDone).toBe(2);
    expect(now.subtasksTotal).toBe(3);
  });

  it('omits a missing sprint and a missing project without crashing', () => {
    const task = mkCollabTask('c-1', { projectId: 'unknown-project', sprintId: 'unknown-sprint', featureId: 'f-1' });
    const now = selectNowStrip({
      tasks: [], collabTasks: [task],
      workspaces: [workspace], projects: [project], sprints: [sprint], features: [feature],
      activeTaskId: 'c-1', activeSessionId: null, activeTimerState: 'paused',
    });
    expect(now.sprint).toBeNull();
    expect(now.project).toBeNull();
    expect(now.feature?.label).toBe('Now Strip');
    expect(now.title).toBe('c-1');
  });

  it('omits the chain entirely when the sprint and feature are not linked', () => {
    const task = mkCollabTask('c-1', { sprintId: undefined, featureId: undefined });
    const now = selectNowStrip({
      tasks: [], collabTasks: [task],
      workspaces: [workspace], projects: [project], sprints: [sprint], features: [feature],
      activeTaskId: 'c-1', activeSessionId: null, activeTimerState: 'idle',
    });
    expect(now.sprint).toBeNull();
    expect(now.feature).toBeNull();
    expect(now.workspace?.label).toBe('FocusFlow');
    expect(now.project?.label).toBe('Companion');
  });

  it('flags a completed personal task', () => {
    const now = selectNowStrip({
      tasks: [mkTask('t-1', { status: 'completed' })], collabTasks: [],
      workspaces: [], projects: [], sprints: [], features: [],
      activeTaskId: 't-1', activeSessionId: null, activeTimerState: 'idle',
    });
    expect(now.completed).toBe(true);
  });

  it('flags a done collab task', () => {
    const now = selectNowStrip({
      tasks: [], collabTasks: [mkCollabTask('c-1', { sprintStatus: 'done' })],
      workspaces: [], projects: [], sprints: [], features: [],
      activeTaskId: 'c-1', activeSessionId: null, activeTimerState: 'idle',
    });
    expect(now.completed).toBe(true);
  });

  it('does not fabricate a branch when git context is absent', () => {
    const now = selectNowStrip({
      tasks: [mkTask('t-1')], collabTasks: [],
      workspaces: [], projects: [], sprints: [], features: [],
      activeTaskId: 't-1', activeSessionId: null, activeTimerState: 'running',
    });
    expect(now.branch).toBeNull();
  });
});
