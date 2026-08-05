import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';
import { EngineeringMemoryPanel } from '../EngineeringMemoryPanel';
import { useStore } from '../../../store/useStore';
import { useWorkLogStore } from '../../../store/useWorkLogStore';
import { useCollaborationStore } from '../../../store/useCollaborationStore';
import type { Task, JournalEntry } from '../../../types';
import type { WorkLog } from '../../../store/useWorkLogStore';

// The panel fetches server session documents through the existing api layer.
// The whole module is stubbed so history docs are deterministic (mirrors the
// Analytics page pattern, but in tests we never hit the network).
const apiMock = vi.hoisted(() => ({
  sessions: {
    list: vi.fn(async () => [] as any[]),
  },
}));

vi.mock('../../../utils/api', () => ({ api: apiMock }));

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

function mkJournal(id: string, taskId: string, content: string, createdAt: number): JournalEntry {
  return {
    id, taskId, content, mood: 4, focusRating: 3,
    createdAt, updatedAt: createdAt,
  };
}

function mkLog(id: string, taskId: string, overrides: Partial<WorkLog> = {}): WorkLog {
  return {
    _id: id,
    title: `Log ${id}`,
    status: 'in-progress',
    isActive: true,
    taskRef: { _id: taskId, title: 'Task', color: '#fff', category: 'Work', totalTime: 0 },
    updatedAt: '2026-08-01T10:00:00.000Z',
    blockerList: [],
    workEntries: [],
    currentWork: '',
    plan: '',
    ...overrides,
  } as WorkLog;
}

function closedSessionDoc(id: string, overrides: Record<string, any> = {}): Record<string, any> {
  return {
    _id: id,
    taskId: 't-1',
    startTime: 1_700_000_000_000,
    endTime: 1_700_003_600_000,
    activeTime: 1_800_000,
    totalPauseDuration: 120_000,
    pauseCount: 2,
    isActive: false,
    focusScore: 84,
    pauseLog: [],
    ...overrides,
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

async function flush() {
  await act(async () => {});
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

describe('EngineeringMemoryPanel (S1-T6)', () => {
  beforeEach(() => {
    apiMock.sessions.list.mockReset();
    apiMock.sessions.list.mockResolvedValue([]);

    useStore.setState({
      dataLoading: false,
      dataError: null,
      tasks: [],
      journals: [],
      activeTaskId: null,
      activeSessionId: null,
      activeTimerState: 'idle',
      currentSessionStart: undefined,
      currentPauseStart: undefined,
      loadAll: vi.fn(async () => {}),
      addJournal: vi.fn(async () => {}),
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

  it('shows the honest empty memory state with zero context', () => {
    const { container, root } = render(<EngineeringMemoryPanel />);
    const text = container.textContent ?? '';
    expect(text).toContain('Engineering Memory');
    expect(text).toContain('No memory yet');
    expect(text).toContain('0/10 context');
    expect(container.querySelectorAll('[aria-label*="missing"]').length).toBe(10);
    act(() => root.unmount());
  });

  it('renders a previous session summary plus linked work log and decisions', async () => {
    apiMock.sessions.list.mockResolvedValue([
      closedSessionDoc('s-1'),
      closedSessionDoc('s-2', { startTime: 1_800_000_000_000, activeTime: 3_600_000, pauseCount: 1, focusScore: 91 }),
    ]);
    useStore.setState({
      tasks: [mkTask('t-1', { totalTime: 7_200_000 })],
      activeTaskId: 't-1',
      activeSessionId: null,
      activeTimerState: 'idle',
    });
    useWorkLogStore.setState({
      activeLogs: [
        mkLog('wl-1', 't-1', {
          decisions: [
            { _id: 'd-1', title: 'Zustand over Redux', context: '', decision: 'Adopted Zustand for store isolation.', alternatives: '', rationale: 'Smaller footprint', timestamp: 1_700_000_500_000 },
          ],
        }),
      ],
    });
    const { container, root } = render(<EngineeringMemoryPanel taskId="t-1" />);
    await flush();

    const text = container.textContent ?? '';
    expect(text).toContain('Previous session');
    expect(text).toContain('1h');
    expect(text).toContain('1 pause');
    expect(text).toContain('Focus 91');
    expect(text).toContain('Total time on task');
    expect(text).toContain('2.0h');
    expect(text).toContain('Recent decisions (1)');
    expect(text).toContain('Zustand over Redux');
    expect(text).toContain('Open work log');
    act(() => root.unmount());
  });

  it('renders the active session strip with resume/pause timestamps', async () => {
    apiMock.sessions.list.mockResolvedValue([
      closedSessionDoc('s-9', {
        _id: 's-9', isActive: true, startTime: 1_700_000_000_000,
        pauseLog: [
          { pauseStart: 1_700_000_100_000, resumeTime: 1_700_000_120_000 },
          { pauseStart: 1_700_000_200_000, resumeTime: null },
        ],
      }),
    ]);
    useStore.setState({
      tasks: [mkTask('t-1')],
      activeTaskId: 't-1',
      activeSessionId: 's-9',
      activeTimerState: 'paused',
    });
    const { container, root } = render(<EngineeringMemoryPanel />);
    await flush();

    const text = container.textContent ?? '';
    expect(text).toContain('Session');
    expect(text).toContain('Paused');
    expect(text).toContain('Started');
    expect(text).toContain('Resumed');
    act(() => root.unmount());
  });

  it('surfaces the last journal note and lets the user continue writing it', async () => {
    useStore.setState({
      tasks: [mkTask('t-1')],
      journals: [mkJournal('j-1', 't-1', 'Finished the refactor.', 1_700_000_000_000)],
      activeTaskId: 't-1',
    });
    const { container, root } = render(<EngineeringMemoryPanel />);
    await flush();

    expect(container.textContent).toContain('Last journal note');
    expect(container.textContent).toContain('Finished the refactor.');

    act(() => {
      buttonByText(container, 'Continue writing')!.click();
    });
    const textarea = container.querySelector('textarea[aria-label="Quick journal note"]');
    expect(textarea).not.toBeNull();

    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!.set!;
      setter.call(textarea, 'Next step: wire up the tests.');
      textarea!.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => {
      buttonByText(container, 'Save note')!.click();
    });
    await flush();

    expect(useStore.getState().addJournal).toHaveBeenCalledWith({
      taskId: 't-1',
      content: 'Next step: wire up the tests.',
      mood: 4,
      focusRating: 3,
    });
    act(() => root.unmount());
  });

  it('shows a loading state while session history is still fetching', () => {
    apiMock.sessions.list.mockReturnValue(new Promise(() => {}));
    const { container, root } = render(<EngineeringMemoryPanel />);
    expect(container.querySelector('.skeleton')).not.toBeNull();
    expect(apiMock.sessions.list).toHaveBeenCalled();
    act(() => root.unmount());
  });

  it('surfaces the session history error with a working retry', async () => {
    apiMock.sessions.list.mockRejectedValueOnce(new Error('Session history failed'));
    const { container, root } = render(<EngineeringMemoryPanel />);
    await flush();

    expect(container.textContent).toContain('Session history failed');
    const retry = buttonByText(container, 'Retry');
    expect(retry).not.toBeNull();

    act(() => retry!.click());
    await flush();
    expect(container.textContent).not.toContain('Session history failed');
    act(() => root.unmount());
  });

  it('marks the journal facet missing when no journal exists', async () => {
    useStore.setState({ tasks: [mkTask('t-1')], activeTaskId: 't-1' });
    const { container, root } = render(<EngineeringMemoryPanel />);
    await flush();

    expect(container.querySelector('[aria-label="Journal missing"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Work log missing"]')).not.toBeNull();
    act(() => root.unmount());
  });

  it('passes accessibility checks with populated context', async () => {
    apiMock.sessions.list.mockResolvedValue([closedSessionDoc('s-1')]);
    useStore.setState({
      tasks: [mkTask('t-1', { totalTime: 3_600_000 })],
      journals: [mkJournal('j-1', 't-1', 'Shipped the engine.', 1_700_000_000_000)],
      activeTaskId: 't-1',
    });
    useWorkLogStore.setState({
      activeLogs: [
        mkLog('wl-2', 't-1', {
          decisions: [
            { _id: 'd-2', title: 'Chose vite', context: '', decision: 'Bundler decided.', alternatives: '', rationale: 'Speed', timestamp: 1_700_000_400_000 },
          ],
        }),
      ],
    });
    const { container, root } = render(<EngineeringMemoryPanel />);
    await flush();

    expect(await scan(container)).toEqual([]);
    act(() => root.unmount());
  });
});
