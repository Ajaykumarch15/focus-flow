import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Tasks } from '../Tasks';
import { useStore } from '@worklog/services/useStore';
import { useAuthStore } from '@shared/services/useAuthStore';
import type { Task } from '@shared/types';

// Deterministic timer display (same stub as TodayPage tests).
vi.mock('@shared/hooks/useActiveTimer', () => ({
  useActiveTimer: () => ({
    activeTaskId: null,
    activeSessionId: null,
    activeTimerState: 'idle',
    activeTask: null,
    display: '00:00:00',
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
    root.render(<MemoryRouter initialEntries={['/worklog/tasks']}>{node}</MemoryRouter>);
  });
  return { container, root };
}

function renderTasksPage() {
  return render(
    <Routes>
      <Route path="/worklog/tasks" element={<Tasks />} />
      <Route path="/worklog/tasks/:id" element={<div data-testid="location">task-detail</div>} />
      <Route path="*" element={<div data-testid="location">other</div>} />
    </Routes>,
  );
}

describe('TasksPage UI/UX enhancements', () => {
  const originalTasks = useStore.getState().tasks;

  beforeEach(() => {
    useAuthStore.setState({ user: { _id: 'u1', name: 'Ajay Kumar', email: 'a@b.co', role: 'user', settings: {} } });
    useStore.setState({ tasks: [], selectedTaskIds: new Set<string>(), dataLoading: false, dataError: null });
    return () => {
      useStore.setState({ tasks: originalTasks });
    };
  });

  it('greets first-time users with the No tasks yet state', () => {
    const { container } = renderTasksPage();
    expect(container.textContent).toContain('No tasks yet');
    // The regression this locks in: an explicit create CTA must be present.
    const ctas = Array.from(container.querySelectorAll('button')).filter(b => b.textContent?.includes('Add Task'));
    expect(ctas.length).toBeGreaterThanOrEqual(2); // header action + empty-state action
  });

  it('renders status pills with live counts and filters on click', () => {
    useStore.setState({
      tasks: [
        mkTask('t-1'),
        mkTask('t-2'),
        mkTask('t-3', { status: 'completed', title: 'Finished work' }),
      ],
    });
    const { container } = renderTasksPage();

    const group = container.querySelector('[role="group"][aria-label="Filter by status"]');
    expect(group).toBeTruthy();

    const pill = (label: string) =>
      Array.from(group!.querySelectorAll('button')).find(b => b.textContent?.startsWith(label))!;
    expect(pill('All').textContent).toContain('2'); // completed hidden by default
    expect(pill('Done').textContent).toContain('1');
    expect(pill('All').getAttribute('aria-pressed')).toBe('true');

    act(() => { pill('Done').click(); });
    expect(pill('Done').getAttribute('aria-pressed')).toBe('true');
    expect(container.textContent).toContain('Finished work');
    expect(container.textContent).toContain('Showing'); // results summary appears while filtering
  });

  it('opens task detail via keyboard (Enter) on the focused card', () => {
    useStore.setState({ tasks: [mkTask('t-9', { title: 'Keyboard target' })] });
    const { container } = renderTasksPage();

    const card = container.querySelector('[role="button"][aria-label="Open task: Keyboard target"]') as HTMLElement;
    expect(card).toBeTruthy();
    act(() => {
      card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe('task-detail');
  });

  it('offers a one-click Clear filters escape hatch', () => {
    useStore.setState({ tasks: [mkTask('t-1'), mkTask('t-2', { status: 'completed' })] });
    const { container } = renderTasksPage();

    const overdueToggle = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Overdue'))!;
    act(() => { overdueToggle.click(); });
    expect(overdueToggle.getAttribute('aria-pressed')).toBe('true');

    const clear = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Clear filters'));
    expect(clear).toBeTruthy();
    act(() => { clear!.click(); });

    const toggleAgain = Array.from(container.querySelectorAll('button')).find(b => b.textContent?.includes('Overdue'))!;
    expect(toggleAgain.getAttribute('aria-pressed')).toBe('false');
    expect(container.textContent).not.toContain('Clear filters');
  });
});
