import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';
import { TodayPage } from '../TodayPage';
import { useStore } from '@worklog/services/useStore';
import { useAuthStore } from '@shared/services/useAuthStore';
import { useWorkLogStore } from '@worklog/services/useWorkLogStore';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import type { Task } from '@shared/types';
import type { WorkLog } from '@worklog/services/useWorkLogStore';
import type { CentralBlocker, CollaborativeTask, Sprint, Project } from '@collab/types/collaboration';

// The live timer display is driven by the timerEngine singleton; for a
// deterministic page test the hook is stubbed and TodayPage's own state drives
// the rest of the UI.
vi.mock('@shared/hooks/useActiveTimer', () => ({
  useActiveTimer: () => ({
    activeTaskId: null,
    activeSessionId: null,
    activeTimerState: 'idle',
    activeTask: null,
    display: '01:00:00',
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

function render(node: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<MemoryRouter initialEntries={['/worklog/dashboard']}>{node}</MemoryRouter>);
  });
  return { container, root };
}

// A fully-populated store: every Today bucket has data and nothing is empty.
function seedPopulated() {
  const todayMidnight = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
  const tasks: Task[] = [
    mkTask('t-active', { status: 'active', totalTime: 3_600_000, updatedAt: Date.now() - 1000, title: 'Build the Today page' }),
    mkTask('t-paused', { status: 'paused', totalTime: 1_800_000, title: 'Refactor timer engine' }),
    mkTask('t-worklog', { totalTime: 60_000, title: 'Document API mappers' }),
    mkTask('t-due-today', { deadline: todayMidnight, title: 'Ship the landing copy' }),
    mkTask('t-overdue', { deadline: todayMidnight - 86_400_000, title: 'Fix login redirect' }),
    mkTask('t-high', { priority: 'high', title: 'Migrate auth to httpOnly' }),
    mkTask('t-done-today', { status: 'completed', updatedAt: Date.now() - 60_000, title: 'Finished onboarding' }),
  ];
  const log = {
    _id: 'log-1',
    title: 'API mappers log',
    status: 'in-progress',
    isActive: true,
    taskRef: { _id: 't-worklog', title: 'Document API mappers', totalTime: 60_000 },
    updatedAt: new Date().toISOString(),
  } as unknown as WorkLog;
  const blocker: CentralBlocker = {
    id: 'b-1', workspaceId: 'ws-1', taskId: 't-overdue', title: 'Blocked on API',
    severity: 'high', ownerId: 'u-1', reporterId: 'u-1', status: 'open',
    impactDescription: 'Cannot proceed', createdAt: new Date().toISOString(),
  };
  const collabTask: CollaborativeTask = {
    id: 'c-1', workspaceId: 'ws-1', projectId: 'p-1', title: 'Review the PR',
    sprintStatus: 'review', priority: 'high', ownerId: 'u-2', reviewerId: 'u-1',
    followerIds: [], labels: [], dependencies: [], estimatedHours: 2, actualHours: 0,
    subtasks: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    description: '',
  };
  const sprint: Sprint = {
    id: 'sp-1', workspaceId: 'ws-1', projectId: 'p-1', name: 'Sprint 24',
    startDate: '2026-08-03', endDate: new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10),
    goal: '', status: 'active', capacityHours: 160, targetVelocity: 80,
  };
  const project: Project = {
    id: 'p-1', workspaceId: 'ws-1', name: 'FocusFlow', key: 'FF', description: '',
    members: [], teamIds: [], status: 'active',
    milestones: [{ id: 'm-1', title: 'GA launch', dueDate: new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10), status: 'active', targetPoints: 5 }],
    createdAt: '2026-01-01',
  };

  useStore.setState({ tasks, activeTaskId: 't-active', activeSessionId: 's-1' });
  useWorkLogStore.setState({ activeLogs: [log] });
  useCollaborationStore.setState({ blockers: [blocker], tasks: [collabTask], sprints: [sprint], projects: [project] });
}

async function scan(container: HTMLElement) {
  const results = await axe.run(container, {
    rules: {
      'color-contrast': { enabled: false },
    },
  });
  return results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
}

describe('TodayPage (S1-T2)', () => {
  beforeEach(() => {
    useStore.setState({
      dataLoading: false,
      dataError: null,
      tasks: [],
      activeTaskId: null,
      activeSessionId: null,
      activeTimerState: 'idle',
      profile: { ...useStore.getState().profile, name: 'Ajay Kumar', dailyGoal: 8 },
      getTodayTime: () => 2 * 3_600_000,
      getWeekTime: () => 5 * 3_600_000,
    });
    useAuthStore.setState({
      user: { _id: 'u-1', name: 'Ajay Kumar', email: 'ajay@focusflow.dev', role: 'user', settings: {} },
    });
    useWorkLogStore.setState({ activeLogs: [] });
    useCollaborationStore.setState({
      workspaces: [],
      activeWorkspaceId: 'ws-1',
      blockers: [],
      tasks: [],
      sprints: [],
      projects: [],
    });
  });

  it('renders Header, Continue, Do Now and Attention from store data', () => {
    seedPopulated();
    const { container, root } = render(<TodayPage />);
    const text = container.textContent ?? '';

    // Header
    expect(text).toContain('Ajay');
    expect(text).toContain('25%');
    expect(text).toContain('2.0h');
    expect(text).toContain('Timer Running');

    // Continue Working
    expect(text).toContain('Build the Today page');
    expect(text).toContain('Resume');
    expect(text).toContain('Refactor timer engine');
    expect(text).toContain('In work log');

    // Today's Focus (Do Now)
    expect(text).toContain('Ship the landing copy');
    expect(text).toContain('Due today');
    expect(text).toContain('High priority');
    expect(text).toContain('Migrate auth to httpOnly');
    expect(text).toContain('Focus Now');
    expect(text).toContain('01:00:00');

    // Attention
    expect(text).toContain('Overdue');
    expect(text).toContain('Fix login redirect');
    expect(text).toContain('Blocked on API');
    expect(text).toContain('Review the PR');
    expect(text).toContain('Sprint 24');
    expect(text).toContain('GA launch');

    // Stats
    expect(text).toContain('Completed Today');
    expect(text).toContain('View My Backlog (6)');

    act(() => root.unmount());
  });

  it('shows an honest "—" when the daily goal is unset', () => {
    useStore.setState({ profile: { ...useStore.getState().profile, dailyGoal: 0 } });
    const { container, root } = render(<TodayPage />);
    expect(container.textContent).toContain('—');
    act(() => root.unmount());
  });

  it('renders empty states when there is nothing to surface', () => {
    const { container, root } = render(<TodayPage />);
    const text = container.textContent ?? '';
    expect(text).toContain('Nothing to resume');
    expect(text).toContain('No tasks yet');
    expect(text).toContain('Nothing needs attention');
    expect(text).toContain('Start New Task');
    act(() => root.unmount());
  });

  it('renders the loading skeleton while data is fetching', () => {
    useStore.setState({ dataLoading: true, tasks: [] });
    const { container, root } = render(<TodayPage />);
    expect(container.querySelector('.skeleton')).not.toBeNull();
    expect(container.textContent).not.toContain('Nothing to resume');
    act(() => root.unmount());
  });

  it('renders the error banner with a retry action when loading fails', () => {
    useStore.setState({ dataLoading: false, dataError: 'API unavailable', tasks: [] });
    const { container, root } = render(<TodayPage />);
    const text = container.textContent ?? '';
    expect(text).toContain('API unavailable');
    expect(text).toContain('Retry');
    act(() => root.unmount());
  });

  it('has no critical/serious axe violations on a populated Today page', async () => {
    seedPopulated();
    const { container, root } = render(<TodayPage />);
    const violations = await scan(container);
    expect(
      violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`),
    ).toEqual([]);
    act(() => root.unmount());
  });
});
