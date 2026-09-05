import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import axe from 'axe-core';
import { TaskContinuationPanel } from '../TaskContinuationPanel';
import { useStore } from '@worklog/services/useStore';
import { useWorkLogStore } from '@worklog/services/useWorkLogStore';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import type { Task } from '@shared/types';
import type { WorkLog } from '@worklog/services/useWorkLogStore';
import type { CollaborativeTask, Feature, Project, Sprint, Workspace } from '@collab/types/collaboration';

// The live timer clock is driven by the timerEngine singleton; the panel test
// stubs the hook so display/state are deterministic (mirrors focusSessionPanel).
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

vi.mock('@shared/hooks/useActiveTimer', () => ({
  useActiveTimer: () => timerMock,
}));

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

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

function render(node: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <MemoryRouter initialEntries={['/tasks/t-1']}>
        {node}
        <LocationProbe />
      </MemoryRouter>,
    );
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

describe('TaskContinuationPanel (S2-T1)', () => {
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
      loadAll: vi.fn(async () => {}),
      getTodayTime: () => 0,
    });
    useWorkLogStore.setState({ activeLogs: [], closedLogs: [] });
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

  it('renders the honest empty state when there is nothing to continue', () => {
    useStore.setState({ tasks: [mkTask('t-1')] });
    const { container, root } = render(<TaskContinuationPanel taskId="t-1" />);
    const text = container.textContent ?? '';
    expect(text).toContain('Continuation');
    expect(text).toContain('Nothing to continue yet');
    act(() => root.unmount());
  });

  it('shows the loading skeleton while data is fetching', () => {
    useStore.setState({ dataLoading: true, tasks: [] });
    const { container, root } = render(<TaskContinuationPanel taskId="t-1" />);
    expect(container.querySelector('.skeleton')).not.toBeNull();
    expect(container.textContent).not.toContain('Nothing to continue yet');
    act(() => root.unmount());
  });

  it('shows the error state with a retry action', () => {
    useStore.setState({ dataLoading: false, dataError: 'API unavailable', tasks: [] });
    const { container, root } = render(<TaskContinuationPanel taskId="t-1" />);
    const text = container.textContent ?? '';
    expect(text).toContain('API unavailable');
    expect(text).toContain('Retry');
    act(() => buttonByText(container, 'Retry')!.click());
    expect(useStore.getState().loadAll).toHaveBeenCalled();
    act(() => root.unmount());
  });

  it('renders the context chain, subtask progress and total focused time', () => {
    useStore.setState({
      tasks: [mkTask('t-1', {
        totalTime: 2 * 3_600_000,
        subtasks: [
          { id: 's-1', title: 'Setup', completed: true, createdAt: 1 },
          { id: 's-2', title: 'Build prompt flow', completed: false, createdAt: 2 },
        ],
      })],
    });
    const collab = mkCollab('c-1', { sprintId: 'sp-1', featureId: 'f-1' });
    useCollaborationStore.setState({
      workspaces: [mkWorkspace()],
      projects: [mkProject()],
      sprints: [mkSprint()],
      features: [mkFeature()],
      tasks: [collab],
      blockers: [],
    });

    // The panel targets the personal task t-1; collab data proves the chain is
    // only shown for the resolved task (not an orphan chain).
    const { container, root } = render(<TaskContinuationPanel taskId="t-1" />);
    const text = container.textContent ?? '';
    expect(text).toContain('1/2 subtasks');
    expect(text).toContain('Up next: Build prompt flow');
    expect(text).toContain('Total focused');
    expect(text).toContain('2.0h');
    expect(text).not.toContain('Acme');
    act(() => root.unmount());
  });

  it('renders git branch + PR with status badges for a collab task', () => {
    const collab = mkCollab('c-1', {
      gitContext: {
        branch: 'feat/continuation',
        prNumber: 42,
        prUrl: 'https://github.com/acme/focusflow/pull/42',
        reviewStatus: 'approved',
        mergeStatus: 'open',
      },
    });
    useCollaborationStore.setState({
      workspaces: [mkWorkspace()],
      projects: [mkProject()],
      sprints: [mkSprint()],
      features: [mkFeature()],
      tasks: [collab],
      blockers: [],
    });
    const { container, root } = render(<TaskContinuationPanel taskId="c-1" />);
    const text = container.textContent ?? '';
    expect(text).toContain('feat/continuation');
    expect(text).toContain('PR #42');
    expect(text).toContain('approved');
    expect(text).toContain('open');
    const link = container.querySelector('a[href="https://github.com/acme/focusflow/pull/42"]');
    expect(link).not.toBeNull();
    act(() => root.unmount());
  });

  it('renders where-I-stopped from the linked work log and opens it', () => {
    useStore.setState({
      tasks: [mkTask('t-1', { title: 'Wire the continuation view' })],
    });
    const log = mkLog('log-1', {
      title: 'Continuation work log',
      taskRef: { _id: 't-1', title: 'Wire the continuation view', color: '#fff', category: 'Work', totalTime: 0 },
      currentWork: 'Wiring the selector and the panel',
      updatedAt: new Date().toISOString(),
    });
    useWorkLogStore.setState({ activeLogs: [log], closedLogs: [] });

    const { container, root } = render(<TaskContinuationPanel taskId="t-1" />);
    const text = container.textContent ?? '';
    expect(text).toContain('Where I stopped');
    expect(text).toContain('Wiring the selector and the panel');
    expect(text).toContain('Current work');
    expect(text).toContain('Open work log');

    const open = buttonByText(container, 'Open work log');
    act(() => open!.click());
    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe('/worklog/logs/log-1');
    act(() => root.unmount());
  });

  it('renders a live running session with clock and resume link', () => {
    useStore.setState({
      tasks: [mkTask('t-1', { title: 'Live session task' })],
      activeTaskId: 't-1',
      activeSessionId: 'sess-1',
      activeTimerState: 'running',
    });
    timerMock.activeTaskId = 't-1';
    timerMock.activeSessionId = 'sess-1';
    timerMock.activeTimerState = 'running';

    const { container, root } = render(<TaskContinuationPanel taskId="t-1" />);
    const text = container.textContent ?? '';
    expect(text).toContain('running');
    expect(text).toContain('01:00:00');
    expect(text).toContain('Live session');
    expect(text).toContain('View Task');
    act(() => root.unmount());
  });

  it('renders a paused session distinctly and links back to focus', () => {
    useStore.setState({
      tasks: [mkTask('t-1', { title: 'Paused task' })],
      activeTaskId: 't-1',
      activeSessionId: 'sess-1',
      activeTimerState: 'paused',
    });
    timerMock.activeTaskId = 't-1';
    timerMock.activeTimerState = 'paused';

    const { container, root } = render(<TaskContinuationPanel taskId="t-1" />);
    const text = container.textContent ?? '';
    expect(text).toContain('paused');
    const focus = buttonByText(container, 'View Task');
    expect(focus).not.toBeNull();
    act(() => root.unmount());
  });

  it('shows an honest Done badge for completed tasks', () => {
    useStore.setState({ tasks: [mkTask('t-1', { status: 'completed' })] });
    const { container, root } = render(<TaskContinuationPanel taskId="t-1" />);
    expect(container.textContent).toContain('Done');
    act(() => root.unmount());
  });

  it('has no critical/serious axe violations on a populated panel', async () => {
    useStore.setState({
      tasks: [mkTask('t-1', {
        title: 'Axe continuation',
        status: 'active',
        totalTime: 60_000,
        subtasks: [{ id: 's-1', title: 'Sub A', completed: false, createdAt: 1 }],
      })],
      activeTaskId: 't-1',
      activeSessionId: 'sess-1',
      activeTimerState: 'running',
    });
    timerMock.activeTaskId = 't-1';
    timerMock.activeTimerState = 'running';

    const collab = mkCollab('c-1', {
      gitContext: { branch: 'feat/axe', prNumber: 7, prUrl: 'https://github.com/acme/focusflow/pull/7' },
    });
    useCollaborationStore.setState({
      workspaces: [mkWorkspace()],
      projects: [mkProject()],
      sprints: [mkSprint()],
      features: [mkFeature()],
      tasks: [collab],
      blockers: [],
    });

    const { container, root } = render(<TaskContinuationPanel taskId="t-1" />);
    const violations = await scan(container);
    expect(violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`)).toEqual([]);
    act(() => root.unmount());
  });
});
