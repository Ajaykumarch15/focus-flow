import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';
import { FocusSessionPanel } from '../FocusSessionPanel';
import { useStore } from '../../../store/useStore';
import { useWorkLogStore } from '../../../store/useWorkLogStore';
import { useCollaborationStore } from '../../../store/useCollaborationStore';
import type { Task } from '../../../types';
import type { WorkLog } from '../../../store/useWorkLogStore';
import type { CentralBlocker, CollaborativeTask, Feature, Project, Sprint, Workspace } from '../../../types/collaboration';

// The live timer clock is driven by the timerEngine singleton; the panel test
// stubs the hook so display/state are deterministic (mirrors todayPage.test).
const timerMock = vi.hoisted(() => ({
  activeTaskId: null as string | null,
  activeSessionId: null as string | null,
  activeTimerState: 'idle' as 'idle' | 'running' | 'paused',
  activeTask: null as Task | null,
  display: '01:00:00',
  elapsedMs: 0,
  baseElapsedMs: 0,
  sessionStartTime: 0,
  totalPauseDuration: 0,
}));

vi.mock('../../../hooks/useActiveTimer', () => ({
  useActiveTimer: () => timerMock,
}));

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

function mkFeature(id = 'f-1'): Feature {
  return {
    id, projectId: 'p-1', workspaceId: 'ws-1', name: 'AI Copilot', description: '',
    type: 'feature', labels: [], estimatedHours: 8, status: 'in_progress', order: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function render(node: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<MemoryRouter initialEntries={['/focus']}>{node}</MemoryRouter>);
  });
  return { container, root };
}

function buttonByText(container: HTMLElement, text: string): HTMLButtonElement | null {
  return Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes(text)) ?? null;
}

async function scan(container: HTMLElement) {
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false } },
  });
  return results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
}

describe('FocusSessionPanel (S1-T5)', () => {
  beforeEach(() => {
    Object.assign(timerMock, {
      activeTaskId: null,
      activeSessionId: null,
      activeTimerState: 'idle',
      activeTask: null,
      display: '01:00:00',
      elapsedMs: 0,
    });

    useStore.setState({
      dataLoading: false,
      dataError: null,
      tasks: [],
      journals: [],
      activeTaskId: null,
      activeSessionId: null,
      activeTimerState: 'idle',
      startTimer: vi.fn(async () => {}),
      pauseTimer: vi.fn(),
      resumeTimer: vi.fn(),
      stopTimer: vi.fn(async () => {}),
      toggleSubtask: vi.fn(async () => {}),
      addJournal: vi.fn(async () => {}),
      completeTask: vi.fn(async () => {}),
      getTodayTime: () => 0,
    });
    useWorkLogStore.setState({ activeLogs: [], closedLogs: [], addCompleted: vi.fn(async () => {}) });
    useCollaborationStore.setState({
      workspaces: [],
      activeWorkspaceId: 'ws-1',
      projects: [],
      sprints: [],
      features: [],
      tasks: [],
      blockers: [],
    });
  });

  it('shows the honest empty state when nothing is focused and no tasks exist', () => {
    const { container, root } = render(<FocusSessionPanel />);
    const text = container.textContent ?? '';
    expect(text).toContain('Nothing focused yet');
    expect(text).toContain('Go to Backlog');
    act(() => root.unmount());
  });

  it('starts a focus session from a selected task', () => {
    useStore.setState({ tasks: [mkTask('t-1', { title: 'Build the Today page' })] });
    const { container, root } = render(<FocusSessionPanel />);
    const text = container.textContent ?? '';
    expect(text).toContain('Nothing focused yet');
    expect(text).toContain('Select a task to focus on');

    const select = container.querySelector('select');
    act(() => {
      select!.value = 't-1';
      select!.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.textContent).toContain('Build the Today page');
    expect(container.textContent).toContain('Start Focus Session');

    const start = buttonByText(container, 'Start Focus Session');
    act(() => start!.click());
    expect(useStore.getState().startTimer).toHaveBeenCalledWith('t-1');
    act(() => root.unmount());
  });

  it('renders a running focus session with context chain and live timer', () => {
    const workspace: Workspace = {
      id: 'ws-1', name: 'Acme', type: 'Startup', icon: '🚀', description: '', membersCount: 0,
      projectsCount: 0, createdAt: '2026-01-01T00:00:00.000Z', settings: {} as Workspace['settings'],
    };
    const project: Project = {
      id: 'p-1', workspaceId: 'ws-1', name: 'FocusFlow', key: 'FF', description: '', members: [],
      teamIds: [], status: 'active', milestones: [], createdAt: '2026-01-01T00:00:00.000Z',
    };
    const sprint: Sprint = {
      id: 'sp-1', workspaceId: 'ws-1', projectId: 'p-1', name: 'Sprint 24', startDate: '2026-08-03',
      endDate: '2026-08-17', goal: '', status: 'active', capacityHours: 160, targetVelocity: 80,
    };
    const collab: CollaborativeTask = mkCollab('c-1', {
      title: 'Build the AI copilot',
      sprintId: 'sp-1', featureId: 'f-1',
      subtasks: [
        { id: 's-1', title: 'Setup', completed: true },
        { id: 's-2', title: 'Build prompt flow', completed: false },
      ],
    });
    const blocker: CentralBlocker = {
      id: 'b-1', workspaceId: 'ws-1', taskId: 'c-1', title: 'Blocked on model API',
      severity: 'high', ownerId: 'u-1', reporterId: 'u-1', status: 'open',
      impactDescription: '', createdAt: '2026-01-01T00:00:00.000Z',
    };
    const log = {
      _id: 'log-1', title: 'AI copilot log', status: 'in-progress', isActive: true,
      taskRef: { _id: 'c-1', title: 'Build the AI copilot', color: '#fff', category: 'Work', totalTime: 0 },
      updatedAt: new Date().toISOString(), blockerList: [], workEntries: [], currentWork: '', plan: '',
    } as unknown as WorkLog;

    useStore.setState({
      tasks: [],
      journals: [{ id: 'j-1', taskId: 'c-1', content: 'Prompt tuning works', mood: 4, focusRating: 4, createdAt: Date.now(), updatedAt: Date.now() }],
      activeTaskId: 'c-1',
      activeSessionId: 's-1',
      activeTimerState: 'running',
      getTodayTime: () => 2 * 3_600_000,
    });
    timerMock.activeTaskId = 'c-1';
    timerMock.activeSessionId = 's-1';
    timerMock.activeTimerState = 'running';

    useCollaborationStore.setState({
      workspaces: [workspace],
      projects: [project],
      sprints: [sprint],
      features: [mkFeature()],
      tasks: [collab],
      blockers: [blocker],
    });
    useWorkLogStore.setState({ activeLogs: [log], closedLogs: [] });

    const { container, root } = render(<FocusSessionPanel />);
    const text = container.textContent ?? '';
    expect(text).toContain('Build the AI copilot');
    expect(text).toContain('Acme');
    expect(text).toContain('FocusFlow');
    expect(text).toContain('Sprint 24');
    expect(text).toContain('AI Copilot');
    expect(text).toContain('Pause Session');
    expect(text).toContain('01:00:00');
    expect(text).toContain('high blocker');
    expect(text).toContain('Session notes');
    expect(text).toContain('Work log linked');
    expect(text).toContain('Build prompt flow');
    expect(text).toContain('Up next');
    expect(text).toContain('2.0h');
    expect(text).not.toContain('Start Focus Session');
    act(() => root.unmount());
  });

  it('pauses a running session and resumes a paused session', () => {
    useStore.setState({
      tasks: [mkTask('t-1', { status: 'active' })],
      activeTaskId: 't-1',
      activeSessionId: 's-1',
      activeTimerState: 'running',
    });
    timerMock.activeTaskId = 't-1';
    timerMock.activeTimerState = 'running';

    const running = render(<FocusSessionPanel />);
    act(() => buttonByText(running.container, 'Pause Session')!.click());
    expect(useStore.getState().pauseTimer).toHaveBeenCalledWith('t-1');
    act(() => running.root.unmount());

    timerMock.activeTimerState = 'paused';
    useStore.setState({
      tasks: [mkTask('t-1', { status: 'paused' })],
      activeTaskId: 't-1',
      activeSessionId: 's-1',
      activeTimerState: 'paused',
    });
    const paused = render(<FocusSessionPanel />);
    const text = paused.container.textContent ?? '';
    expect(text).toContain('Resume Session');
    expect(text).not.toContain('Pause Session');
    act(() => buttonByText(paused.container, 'Resume Session')!.click());
    expect(useStore.getState().resumeTimer).toHaveBeenCalledWith('t-1');
    act(() => paused.root.unmount());
  });

  it('switches tasks via the switch-task control', () => {
    useStore.setState({
      tasks: [
        mkTask('t-1', { title: 'First task' }),
        mkTask('t-2', { title: 'Second task' }),
      ],
      activeTaskId: 't-1',
      activeSessionId: 's-1',
      activeTimerState: 'running',
    });
    timerMock.activeTaskId = 't-1';
    timerMock.activeTimerState = 'running';

    const { container, root } = render(<FocusSessionPanel />);
    expect(container.textContent).toContain('First task');
    const select = container.querySelector('select');
    act(() => {
      select!.value = 't-2';
      select!.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.textContent).toContain('Second task');
    expect(container.textContent).toContain('Start Focus Session');
    act(() => root.unmount());
  });

  it('adds a session note through the inline composer', () => {
    useStore.setState({ tasks: [mkTask('t-1', { title: 'Note task' })] });
    const { container, root } = render(<FocusSessionPanel />);
    act(() => {
      const select = container.querySelector('select');
      select!.value = 't-1';
      select!.dispatchEvent(new Event('change', { bubbles: true }));
    });
    act(() => buttonByText(container, 'Add Session Note')!.click());

    const textarea = container.querySelector('textarea');
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!.set!;
      setter.call(textarea, 'Writing the resume card');
      textarea!.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => buttonByText(container, 'Save Note')!.click());

    expect(useStore.getState().addJournal).toHaveBeenCalledWith({
      taskId: 't-1',
      content: 'Writing the resume card',
      mood: 3,
      focusRating: 3,
    });
    act(() => root.unmount());
  });

  it('toggles subtasks and keeps the next one highlighted', () => {
    useStore.setState({
      tasks: [mkTask('t-1', {
        subtasks: [
          { id: 's-1', title: 'Build', completed: false, createdAt: 1 },
          { id: 's-2', title: 'Ship', completed: false, createdAt: 2 },
        ],
      })],
      activeTaskId: 't-1',
      activeSessionId: 's-1',
      activeTimerState: 'running',
    });
    timerMock.activeTaskId = 't-1';
    timerMock.activeTimerState = 'running';

    const { container, root } = render(<FocusSessionPanel />);
    act(() => buttonByText(container, 'Build')!.click());
    expect(useStore.getState().toggleSubtask).toHaveBeenCalledWith('t-1', 's-1', true);
    act(() => root.unmount());
  });

  it('shows an honest completed banner and disables start for completed tasks', () => {
    useStore.setState({ tasks: [mkTask('t-1', { title: 'Done task', status: 'completed' })], activeTaskId: 't-1' });
    const { container, root } = render(<FocusSessionPanel />);
    const text = container.textContent ?? '';
    expect(text).toContain('This task is complete');
    const start = buttonByText(container, 'Start Focus Session');
    expect(start?.disabled).toBe(true);
    act(() => root.unmount());
  });

  it('completes the focused task and logs a completed item to the linked work log', async () => {
    const log = {
      _id: 'log-1', title: 'AI copilot log', status: 'in-progress', isActive: true,
      taskRef: { _id: 't-1', title: 'Done task', color: '#fff', category: 'Work', totalTime: 0 },
      updatedAt: new Date().toISOString(), blockerList: [], workEntries: [], currentWork: '', plan: '',
    } as unknown as WorkLog;
    useStore.setState({
      tasks: [mkTask('t-1', { title: 'Done task', status: 'active', totalTime: 2 * 3_600_000 + 30 * 60_000 })],
      activeTaskId: 't-1',
      activeSessionId: 's-1',
      activeTimerState: 'running',
    });
    timerMock.activeTaskId = 't-1';
    timerMock.activeTimerState = 'running';
    useWorkLogStore.setState({ activeLogs: [log], closedLogs: [] });

    const { container, root } = render(<FocusSessionPanel />);
    act(() => buttonByText(container, 'Complete Task')!.click());
    await act(async () => {});

    expect(useStore.getState().completeTask).toHaveBeenCalledWith('t-1');
    expect(useWorkLogStore.getState().addCompleted).toHaveBeenCalledWith('log-1', 'Done task (2h 30m)');
    act(() => root.unmount());
  });

  it('completes the task without a completed item when no work log is linked', async () => {
    useStore.setState({
      tasks: [mkTask('t-1', { title: 'Solo task', status: 'active' })],
      activeTaskId: 't-1',
      activeSessionId: 's-1',
      activeTimerState: 'running',
    });
    timerMock.activeTaskId = 't-1';
    timerMock.activeTimerState = 'running';

    const { container, root } = render(<FocusSessionPanel />);
    act(() => buttonByText(container, 'Complete Task')!.click());
    await act(async () => {});

    expect(useStore.getState().completeTask).toHaveBeenCalledWith('t-1');
    expect(useWorkLogStore.getState().addCompleted).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it('shows the completion reflection prompt once the task is completed', () => {
    useStore.setState({ tasks: [mkTask('t-1', { title: 'Done task', status: 'completed' })], activeTaskId: 't-1' });
    const { container, root } = render(<FocusSessionPanel />);
    const text = container.textContent ?? '';
    expect(text).toContain('Done — one light reflection');
    expect(text).toContain('Save Reflection');
    expect(buttonByText(container, 'Complete Task')).toBeNull();
    act(() => root.unmount());
  });

  it('renders a collab task with missing sprint/feature/project without crashing', () => {
    useStore.setState({
      tasks: [],
      activeTaskId: 'c-1',
      activeSessionId: 's-1',
      activeTimerState: 'running',
    });
    timerMock.activeTaskId = 'c-1';
    timerMock.activeTimerState = 'running';
    useCollaborationStore.setState({
      workspaces: [],
      projects: [],
      sprints: [],
      features: [],
      tasks: [mkCollab('c-1', { title: 'Orphan collab task', sprintId: 'sp-missing', featureId: 'f-missing' })],
      blockers: [],
    });
    const { container, root } = render(<FocusSessionPanel />);
    const text = container.textContent ?? '';
    expect(text).toContain('Orphan collab task');
    expect(text).not.toContain('Sprint 24');
    expect(text).not.toContain('AI Copilot');
    act(() => root.unmount());
  });

  it('renders the loading skeleton while data is fetching', () => {
    useStore.setState({ dataLoading: true, tasks: [] });
    const { container, root } = render(<FocusSessionPanel />);
    expect(container.querySelector('.skeleton')).not.toBeNull();
    expect(container.textContent).not.toContain('Nothing focused yet');
    act(() => root.unmount());
  });

  it('renders the error state with a retry action', () => {
    useStore.setState({ dataLoading: false, dataError: 'API unavailable', tasks: [] });
    const { container, root } = render(<FocusSessionPanel />);
    const text = container.textContent ?? '';
    expect(text).toContain('API unavailable');
    expect(text).toContain('Retry');
    act(() => root.unmount());
  });

  it('renders responsively with stacked mobile grids and row layout on large screens', () => {
    useStore.setState({
      tasks: [mkTask('t-1', { title: 'Responsive task', status: 'active' })],
      activeTaskId: 't-1',
      activeSessionId: 's-1',
      activeTimerState: 'running',
    });
    timerMock.activeTaskId = 't-1';
    timerMock.activeTimerState = 'running';
    const { container, root } = render(<FocusSessionPanel />);
    const metrics = container.querySelector('dl');
    expect(metrics?.className).toContain('grid-cols-2');
    expect(metrics?.className).toContain('lg:grid-cols-4');
    const outer = container.querySelector('div.p-6');
    expect(outer?.className).toContain('max-w-4xl');
    act(() => root.unmount());
  });

  it('has no critical/serious axe violations on a populated focus panel', async () => {
    const project: Project = {
      id: 'p-1', workspaceId: 'ws-1', name: 'FocusFlow', key: 'FF', description: '', members: [],
      teamIds: [], status: 'active', milestones: [], createdAt: '2026-01-01T00:00:00.000Z',
    };
    const sprint: Sprint = {
      id: 'sp-1', workspaceId: 'ws-1', projectId: 'p-1', name: 'Sprint 24', startDate: '2026-08-03',
      endDate: '2026-08-17', goal: '', status: 'active', capacityHours: 160, targetVelocity: 80,
    };
    useStore.setState({
      tasks: [mkTask('t-1', {
        title: 'Axe task', status: 'active', totalTime: 60_000,
        subtasks: [{ id: 's-1', title: 'Sub A', completed: false, createdAt: 1 }],
      })],
      activeTaskId: 't-1',
      activeSessionId: 's-1',
      activeTimerState: 'running',
    });
    timerMock.activeTaskId = 't-1';
    timerMock.activeTimerState = 'running';
    useCollaborationStore.setState({
      workspaces: [{ id: 'ws-1', name: 'Acme', type: 'Startup', icon: '🚀', description: '', membersCount: 0, projectsCount: 0, createdAt: '2026-01-01T00:00:00.000Z', settings: {} as Workspace['settings'] }],
      projects: [project],
      sprints: [sprint],
      features: [mkFeature()],
      tasks: [],
      blockers: [],
    });
    const { container, root } = render(<FocusSessionPanel />);
    const violations = await scan(container);
    expect(violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`)).toEqual([]);
    act(() => root.unmount());
  });
});
