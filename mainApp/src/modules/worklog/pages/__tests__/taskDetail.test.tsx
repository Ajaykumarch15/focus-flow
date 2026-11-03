import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { TaskDetail } from '../TaskDetail';
import { useStore } from '@worklog/services/useStore';
import { useWorkLogStore } from '@worklog/services/useWorkLogStore';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { useScheduleStore } from '@worklog/services/useScheduleStore';
import type { Task } from '@shared/types';

const apiMock = vi.hoisted(() => ({
  sessions: { list: vi.fn(async () => [] as any[]) },
}));
vi.mock('@shared/utils/api', () => ({ api: apiMock }));

const taskTimerState = vi.hoisted(() => ({ state: 'idle' as 'idle' | 'running' | 'paused', display: '00:00:00' }));
vi.mock('@shared/hooks/useTaskParallelTimer', () => ({
  useTaskParallelTimer: () => taskTimerState,
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
    order: 0,
    createdAt: Date.now() - 60_000,
    updatedAt: Date.now() - 60_000,
    ...overrides,
  };
}

function renderWithRoute(taskId = 't-1') {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[`/worklog/tasks/${taskId}`]}>
        <Routes>
          <Route path="/worklog/tasks/:id" element={<TaskDetail />} />
          <Route path="*" element={<TaskDetail />} />
        </Routes>
      </MemoryRouter>
    );
  });
  return { container, root };
}

function buttonByText(container: HTMLElement, text: string): HTMLButtonElement | null {
  return Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes(text)) ?? null;
}

beforeEach(() => {
  apiMock.sessions.list.mockReset();
  apiMock.sessions.list.mockResolvedValue([]);

  Object.assign(taskTimerState, { state: 'idle', display: '00:00:00' });

  useStore.setState({
    dataLoading: false,
    dataError: null,
    tasks: [mkTask('t-1', { title: 'Build the detail page' })],
    journals: [],
    activeTaskId: null,
    activeSessionId: null,
    activeTimerState: 'idle',
    loadAll: vi.fn(async () => {}),
    addJournal: vi.fn(async () => {}),
    startTimer: vi.fn(async () => {}),
    pauseTimer: vi.fn(),
    resumeTimer: vi.fn(),
    stopTimer: vi.fn(async () => {}),
    startParallelTimer: vi.fn(async () => {}),
    pauseParallelTimer: vi.fn(),
    resumeParallelTimer: vi.fn(),
    stopParallelTimer: vi.fn(async () => {}),
    addSubtask: vi.fn(async () => {}),
    toggleSubtask: vi.fn(async () => {}),
    deleteSubtask: vi.fn(async () => {}),
    updateTask: vi.fn(async () => {}),
    deleteTask: vi.fn(async () => {}),
    getTodayTime: () => 0,
    theme: { mode: 'dark' as const, accentColor: '#0ea5e9', fontSize: 'md' as const, glassmorphism: false, animatedBackground: false, reducedMotion: false },
  });

  useWorkLogStore.setState({ activeLogs: [], closedLogs: [] });
  useCollaborationStore.setState({
    workspaces: [],
    activeWorkspaceId: undefined,
    projects: [],
    sprints: [],
    features: [],
    tasks: [],
    blockers: [],
  });
  useScheduleStore.setState({
    schedules: [],
    isModalOpen: false,
    openModal: vi.fn(),
    closeModal: vi.fn(),
  });
});

describe('TaskDetail page', () => {
  it('renders task not found when task ID does not match', () => {
    const { container } = renderWithRoute('nonexistent');
    expect(container.textContent).toContain('Task not found');
    expect(container.textContent).toContain('Back to Tasks');
  });

  it('renders task title and details', () => {
    const { container } = renderWithRoute('t-1');
    const text = container.textContent ?? '';
    expect(text).toContain('Build the detail page');
    expect(text).toContain('Focus Timer');
    expect(text).toContain('Ready to focus');
  });

  it('shows Start Focus button when task is idle', () => {
    const { container } = renderWithRoute('t-1');
    expect(buttonByText(container, 'Start Focus')).not.toBeNull();
  });

  it('calls startParallelTimer when Start Focus is clicked', () => {
    const { container } = renderWithRoute('t-1');
    const btn = buttonByText(container, 'Start Focus')!;
    act(() => btn.click());
    expect(useStore.getState().startParallelTimer).toHaveBeenCalledWith('t-1');
  });

  it('shows Pause button when this task timer is running, even when another task is active', () => {
    taskTimerState.state = 'running';
    taskTimerState.display = '01:30:00';

    const { container } = renderWithRoute('t-1');
    expect(buttonByText(container, 'Pause')).not.toBeNull();
  });

  it('calls pauseParallelTimer when Pause is clicked', () => {
    taskTimerState.state = 'running';

    const { container } = renderWithRoute('t-1');
    const btn = buttonByText(container, 'Pause')!;
    act(() => btn.click());
    expect(useStore.getState().pauseParallelTimer).toHaveBeenCalledWith('t-1');
  });

  it('shows Resume and Stop buttons when timer is paused', () => {
    taskTimerState.state = 'paused';
    taskTimerState.display = '00:30:00';

    const { container } = renderWithRoute('t-1');
    expect(buttonByText(container, 'Resume')).not.toBeNull();
    expect(buttonByText(container, 'Stop')).not.toBeNull();
  });

  it('calls stopParallelTimer when Stop is clicked', () => {
    taskTimerState.state = 'paused';

    const { container } = renderWithRoute('t-1');
    const btn = buttonByText(container, 'Stop')!;
    act(() => btn.click());
    expect(useStore.getState().stopParallelTimer).toHaveBeenCalledWith('t-1');
  });

  it('renders subtask section with correct count', () => {
    useStore.setState({
      tasks: [mkTask('t-1', {
        subtasks: [
          { id: 's-1', title: 'Sub A', completed: false, createdAt: 1 },
          { id: 's-2', title: 'Sub B', completed: true, createdAt: 2 },
        ],
      })],
    });
    const { container } = renderWithRoute('t-1');
    const text = container.textContent ?? '';
    expect(text).toContain('Sub A');
    expect(text).toContain('Sub B');
    expect(text).toContain('1/2 subtasks');
  });

  it('renders Engineering Memory section', () => {
    const { container } = renderWithRoute('t-1');
    expect(container.textContent).toContain('Engineering Memory');
  });

  it('opens delete confirmation dialog when delete is clicked', () => {
    const { container } = renderWithRoute('t-1');
    const deleteBtn = container.querySelector('button[aria-label="Delete task Build the detail page"]') as HTMLButtonElement;
    expect(deleteBtn).not.toBeNull();
    act(() => deleteBtn.click());
    expect(container.textContent).toContain('Delete Task');
    expect(container.textContent).toContain('cannot be undone');
  });

  it('renders back link to tasks list', () => {
    const { container } = renderWithRoute('t-1');
    expect(buttonByText(container, 'Back to Tasks')).not.toBeNull();
  });
});
