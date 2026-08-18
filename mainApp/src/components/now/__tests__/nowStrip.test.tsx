import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';
import { NowStrip } from '../NowStrip';
import { useStore } from '../../../store/useStore';
import { useCollaborationStore } from '../../../store/useCollaborationStore';
import type { Task } from '../../../types';
import type { CollaborativeTask, Feature, Project, Sprint, Workspace } from '../../../types/collaboration';

// The live clock is driven by the timerEngine singleton; stub the hook so the
// test controls the display deterministically. Session state itself comes from
// the store (activeTimerState), exactly as in the real strip.
vi.mock('../../../hooks/useActiveTimer', () => ({
  useActiveTimer: () => ({
    activeTaskId: null,
    activeSessionId: null,
    activeTimerState: 'idle',
    activeTask: null,
    display: '01:23:45',
    elapsedMs: 0,
    baseElapsedMs: 0,
    sessionStartTime: 0,
    totalPauseDuration: 0,
  }),
}));

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

function render(node: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<MemoryRouter initialEntries={['/dashboard']}>{node}</MemoryRouter>);
  });
  return { container, root };
}

async function scan(container: HTMLElement) {
  const results = await axe.run(container, {
    rules: {
      'color-contrast': { enabled: false },
    },
  });
  return results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
}

describe('NowStrip (S1-T3)', () => {
  beforeEach(() => {
    useStore.setState({
      dataLoading: false,
      dataError: null,
      tasks: [],
      activeTaskId: null,
      activeSessionId: null,
      activeTimerState: 'idle',
    });
    useCollaborationStore.setState({
      workspaces: [],
      activeWorkspaceId: '',
      projects: [],
      sprints: [],
      features: [],
      tasks: [],
    });
  });

  it('shows the honest empty state when nothing is running', () => {
    const { container, root } = render(<NowStrip />);
    const text = container.textContent ?? '';
    expect(text).toContain('No active task');
    expect(text).toContain('Start something');
    expect(text).not.toContain('Pause');
    act(() => root.unmount());
  });

  it('shows the running task, state badge, clock and Pause control', () => {
    useStore.setState({ tasks: [mkTask('t-1', { title: 'Build the Today page' })], activeTaskId: 't-1', activeTimerState: 'running' });
    const { container, root } = render(<NowStrip />);
    const text = container.textContent ?? '';
    expect(text).toContain('Build the Today page');
    expect(text).toContain('running');
    expect(text).toContain('01:23:45');
    expect(text).toContain('Pause');
    expect(text).not.toContain('Resume');
    act(() => root.unmount());
  });

  it('offers Resume when the session is paused', () => {
    useStore.setState({ tasks: [mkTask('t-1', { title: 'Refactor timer engine', status: 'paused' })], activeTaskId: 't-1', activeTimerState: 'paused' });
    const { container, root } = render(<NowStrip />);
    const text = container.textContent ?? '';
    expect(text).toContain('paused');
    expect(text).toContain('01:23:45');
    expect(text).toContain('Resume');
    expect(text).not.toContain('Pause');
    act(() => root.unmount());
  });

  it('renders the workspace → project → sprint → feature chain for a collab task', () => {
    useStore.setState({ tasks: [], activeTaskId: 'c-1', activeTimerState: 'running' });
    useCollaborationStore.setState({
      workspaces: [workspace],
      projects: [project],
      sprints: [sprint],
      features: [feature],
      tasks: [mkCollabTask('c-1', { title: 'Ship the Now strip', featureId: 'f-1', sprintId: 'sp-1' })],
    });
    const { container, root } = render(<NowStrip />);
    const text = container.textContent ?? '';
    expect(text).toContain('FocusFlow');
    expect(text).toContain('Companion');
    expect(text).toContain('Sprint 24');
    expect(text).toContain('Now Strip');
    expect(text).toContain('Ship the Now strip');
    act(() => root.unmount());
  });

  it('skips a missing sprint without fabricating one', () => {
    useStore.setState({ tasks: [], activeTaskId: 'c-1', activeTimerState: 'running' });
    useCollaborationStore.setState({
      workspaces: [workspace],
      projects: [project],
      sprints: [],
      features: [],
      tasks: [mkCollabTask('c-1', { title: 'No sprint here' })],
    });
    const { container, root } = render(<NowStrip />);
    const text = container.textContent ?? '';
    expect(text).toContain('No sprint here');
    expect(text).toContain('FocusFlow');
    expect(text).not.toContain('Sprint');
    act(() => root.unmount());
  });

  it('shows subtask progress when the task has subtasks', () => {
    useStore.setState({
      tasks: [mkTask('t-1', {
        title: 'Ship the strip',
        subtasks: [
          { id: 's1', title: 'a', completed: true, createdAt: 1 },
          { id: 's2', title: 'b', completed: true, createdAt: 1 },
          { id: 's3', title: 'c', completed: false, createdAt: 1 },
        ],
      })],
      activeTaskId: 't-1',
      activeTimerState: 'running',
    });
    const { container, root } = render(<NowStrip />);
    expect(container.textContent).toContain('2/3 subtasks');
    act(() => root.unmount());
  });

  it('marks a completed task and hides the timer controls', () => {
    useStore.setState({ tasks: [mkTask('t-1', { title: 'Finished onboarding', status: 'completed' })], activeTaskId: 't-1', activeTimerState: 'idle' });
    const { container, root } = render(<NowStrip />);
    const text = container.textContent ?? '';
    expect(text).toContain('Finished onboarding');
    expect(text).toContain('completed');
    expect(text).not.toContain('Pause');
    expect(text).not.toContain('Resume');
    act(() => root.unmount());
  });

  it('renders the compact skeleton while the stores are loading', () => {
    useStore.setState({ dataLoading: true, tasks: [] });
    const { container, root } = render(<NowStrip />);
    expect(container.querySelector('.skeleton')).not.toBeNull();
    expect(container.textContent).not.toContain('No active task');
    act(() => root.unmount());
  });

  it('renders a compact error strip with a retry action on load failure', () => {
    useStore.setState({ dataLoading: false, dataError: 'API unavailable', tasks: [] });
    const { container, root } = render(<NowStrip />);
    const text = container.textContent ?? '';
    expect(text).toContain("Couldn't load current context");
    expect(text).toContain('Retry');
    act(() => root.unmount());
  });

  it('has no critical/serious axe violations on a populated running strip', async () => {
    useStore.setState({
      tasks: [mkTask('t-1', {
        title: 'Build the Today page',
        subtasks: [
          { id: 's1', title: 'a', completed: true, createdAt: 1 },
          { id: 's2', title: 'b', completed: false, createdAt: 1 },
        ],
      })],
      activeTaskId: 't-1',
      activeTimerState: 'running',
    });
    const { container, root } = render(<NowStrip />);
    const violations = await scan(container);
    expect(
      violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`),
    ).toEqual([]);
    act(() => root.unmount());
  });

  it('has no critical/serious axe violations on the empty strip', async () => {
    const { container, root } = render(<NowStrip />);
    const violations = await scan(container);
    expect(
      violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`),
    ).toEqual([]);
    act(() => root.unmount());
  });
});
