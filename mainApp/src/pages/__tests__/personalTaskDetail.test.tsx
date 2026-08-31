import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { PersonalTaskDetail } from '../PersonalTaskDetail';
import { usePersonalTaskStore } from '../../store/usePersonalTaskStore';
import { useStore } from '../../store/useStore';
import { useWorkLogStore } from '../../store/useWorkLogStore';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import type { Task } from '../../types';

const apiMock = vi.hoisted(() => ({
  sessions: { list: vi.fn(async () => [] as any[]) },
}));
vi.mock('../../utils/api', () => ({ api: apiMock }));

const timerState = vi.hoisted(() => ({
  activeTaskId: null as string | null,
  activeSessionId: null as string | null,
  activeTimerState: 'idle' as 'idle' | 'running' | 'paused',
  activeTask: null as Task | null,
  display: '00:00:00',
  elapsedMs: 0,
  baseElapsedMs: 0,
  sessionStartTime: 0,
  totalPauseDuration: 0,
}));
vi.mock('../../hooks/useActiveTimer', () => ({
  useActiveTimer: () => timerState,
}));

function mkTask(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title: `Task ${id}`,
    description: '',
    priority: 'medium',
    status: 'todo',
    category: 'Personal',
    color: '#8b5cf6',
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
      <MemoryRouter initialEntries={[`/personal/tasks/${taskId}`]}>
        <Routes>
          <Route path="/personal/tasks/:id" element={<PersonalTaskDetail />} />
          <Route path="*" element={<PersonalTaskDetail />} />
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

  Object.assign(timerState, {
    activeTaskId: null,
    activeSessionId: null,
    activeTimerState: 'idle',
    activeTask: null,
    display: '00:00:00',
    elapsedMs: 0,
    baseElapsedMs: 0,
    sessionStartTime: 0,
    totalPauseDuration: 0,
  });

  usePersonalTaskStore.setState({
    tasks: [mkTask('t-1', { title: 'Read a book' })],
    journals: [],
    fetchTasks: vi.fn(async () => {}),
    fetchJournals: vi.fn(async () => {}),
    addTask: vi.fn(async () => 't-new'),
    updateTask: vi.fn(async () => {}),
    deleteTask: vi.fn(async () => {}),
    completeTask: vi.fn(async () => {}),
    reorderTasks: vi.fn(),
    persistTaskOrder: vi.fn(async () => {}),
    toggleTaskSelection: vi.fn(),
    selectAllTasks: vi.fn(),
    clearTaskSelection: vi.fn(),
    bulkCompleteTasks: vi.fn(async () => {}),
    bulkDeleteTasks: vi.fn(async () => {}),
    startTimer: vi.fn(async () => {}),
    pauseTimer: vi.fn(),
    resumeTimer: vi.fn(),
    stopTimer: vi.fn(async () => {}),
    addSubtask: vi.fn(async () => {}),
    toggleSubtask: vi.fn(async () => {}),
    deleteSubtask: vi.fn(async () => {}),
    addJournal: vi.fn(async () => {}),
    rehydratePersonalTimer: vi.fn(async () => {}),
    loading: false,
    error: null,
    selectedTaskIds: new Set<string>(),
  });

  useStore.setState({
    dataLoading: false,
    dataError: null,
    theme: { mode: 'dark' as const, accentColor: '#8b5cf6', fontSize: 'md' as const, glassmorphism: false, animatedBackground: false, reducedMotion: false },
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
});

describe('PersonalTaskDetail page', () => {
  it('renders task not found when task ID does not match', () => {
    const { container } = renderWithRoute('nonexistent');
    expect(container.textContent).toContain('Task not found');
    expect(container.textContent).toContain('Back to Tasks');
  });

  it('renders task title and details', () => {
    const { container } = renderWithRoute('t-1');
    const text = container.textContent ?? '';
    expect(text).toContain('Read a book');
    expect(text).toContain('Focus Timer');
    expect(text).toContain('Ready to focus');
  });

  it('shows Start Timer button when task is idle', () => {
    const { container } = renderWithRoute('t-1');
    expect(buttonByText(container, 'Start Timer')).not.toBeNull();
  });

  it('calls startTimer when Start Timer is clicked', () => {
    const { container } = renderWithRoute('t-1');
    const btn = buttonByText(container, 'Start Timer')!;
    act(() => btn.click());
    expect(usePersonalTaskStore.getState().startTimer).toHaveBeenCalledWith('t-1');
  });

  it('shows Pause button when timer is running', () => {
    timerState.activeTaskId = 't-1';
    timerState.activeTimerState = 'running';
    timerState.display = '01:00:00';

    const { container } = renderWithRoute('t-1');
    expect(buttonByText(container, 'Pause')).not.toBeNull();
  });

  it('calls pauseTimer when Pause is clicked', () => {
    timerState.activeTaskId = 't-1';
    timerState.activeTimerState = 'running';

    const { container } = renderWithRoute('t-1');
    const btn = buttonByText(container, 'Pause')!;
    act(() => btn.click());
    expect(usePersonalTaskStore.getState().pauseTimer).toHaveBeenCalledWith('t-1');
  });

  it('shows Resume and Stop buttons when timer is paused', () => {
    timerState.activeTaskId = 't-1';
    timerState.activeTimerState = 'paused';
    timerState.display = '00:15:00';

    const { container } = renderWithRoute('t-1');
    expect(buttonByText(container, 'Resume')).not.toBeNull();
    expect(buttonByText(container, 'Stop')).not.toBeNull();
  });

  it('calls stopTimer when Stop is clicked', () => {
    timerState.activeTaskId = 't-1';
    timerState.activeTimerState = 'paused';

    const { container } = renderWithRoute('t-1');
    const btn = buttonByText(container, 'Stop')!;
    act(() => btn.click());
    expect(usePersonalTaskStore.getState().stopTimer).toHaveBeenCalledWith('t-1');
  });

  it('renders subtask section with correct count', () => {
    usePersonalTaskStore.setState({
      tasks: [mkTask('t-1', {
        title: 'Read a book',
        subtasks: [
          { id: 's-1', title: 'Chapter 1', completed: true, createdAt: 1 },
          { id: 's-2', title: 'Chapter 2', completed: false, createdAt: 2 },
        ],
      })],
    });
    const { container } = renderWithRoute('t-1');
    const text = container.textContent ?? '';
    expect(text).toContain('Chapter 1');
    expect(text).toContain('Chapter 2');
    expect(text).toContain('1/2 subtasks');
  });

  it('renders Engineering Memory section', () => {
    const { container } = renderWithRoute('t-1');
    expect(container.textContent).toContain('Engineering Memory');
  });

  it('opens delete confirmation dialog when delete is clicked', () => {
    const { container } = renderWithRoute('t-1');
    const deleteBtn = container.querySelector('button[aria-label="Delete task Read a book"]') as HTMLButtonElement;
    expect(deleteBtn).not.toBeNull();
    act(() => deleteBtn.click());
    expect(container.textContent).toContain('Delete Task');
    expect(container.textContent).toContain('cannot be undone');
  });

  it('renders back link to personal tasks list', () => {
    const { container } = renderWithRoute('t-1');
    expect(buttonByText(container, 'Back to Tasks')).not.toBeNull();
  });
});
