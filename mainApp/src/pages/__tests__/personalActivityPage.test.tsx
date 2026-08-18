import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';
import { PersonalActivityPage } from '../PersonalActivityPage';
import { useStore } from '../../store/useStore';
import { useWorkLogStore } from '../../store/useWorkLogStore';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import { useAuthStore } from '../../store/useAuthStore';
import type { Task, JournalEntry } from '../../types';
import type { WorkLog } from '../../store/useWorkLogStore';

function atLocalDaysAgo(days: number): number {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.getTime() + 60_000;
}

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
    createdAt: atLocalDaysAgo(5),
    updatedAt: atLocalDaysAgo(5),
    ...overrides,
  };
}

function mkJournal(id: string, content: string, createdAt: number): JournalEntry {
  return {
    id, taskId: 't-1', content, mood: 4, focusRating: 3,
    createdAt, updatedAt: createdAt,
  };
}

function mkLog(id: string, overrides: Partial<WorkLog> = {}): WorkLog {
  return {
    _id: id,
    title: `Log ${id}`,
    status: 'in-progress',
    isActive: true,
    updatedAt: '2026-08-01T10:00:00.000Z',
    timelineEntries: [],
    completedItems: [],
    decisions: [],
    blockerList: [],
    workEntries: [],
    currentWork: '',
    plan: '',
    ...overrides,
  } as WorkLog;
}

function render(node: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<MemoryRouter initialEntries={['/activity']}>{node}</MemoryRouter>);
  });
  return { container, root };
}

async function flush() {
  await act(async () => {});
}

async function scan(container: HTMLElement) {
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false } },
  });
  return results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
}

describe('PersonalActivityPage (S1-T7)', () => {
  beforeEach(() => {
    useStore.setState({
      dataLoading: false,
      dataError: null,
      tasks: [],
      journals: [],
      loadAll: vi.fn(async () => {}),
      startTimer: vi.fn(async () => {}),
    });
    useWorkLogStore.setState({ activeLogs: [], closedLogs: [] });
    useCollaborationStore.setState({
      blockers: [],
      features: [],
      workspaces: [],
      activeWorkspaceId: 'ws-1',
      projects: [],
      sprints: [],
      tasks: [],
    });
    useAuthStore.setState({ user: null });
  });

  it('renders the timeline page with aggregated activity', async () => {
    useStore.setState({
      tasks: [mkTask('t-1', { createdAt: atLocalDaysAgo(0) })],
      journals: [mkJournal('j-1', 'Wrapped the engine.', atLocalDaysAgo(0))],
    });
    useWorkLogStore.setState({
      activeLogs: [mkLog('wl-1', {
        timelineEntries: [
          { _id: 'e-1', type: 'note', timestamp: atLocalDaysAgo(0), title: 'Investigated latency', description: 'Found a hot loop', category: 'Debugging' },
        ],
      })],
    });
    const { container, root } = render(<PersonalActivityPage />);
    await flush();

    const text = container.textContent ?? '';
    expect(text).toContain('Personal Activity');
    expect(text).toContain('Task t-1');
    expect(text).toContain('Wrapped the engine.');
    expect(text).toContain('Investigated latency');
    expect(text).toContain('Found a hot loop');
    act(() => root.unmount());
  });

  it('renders the honest empty state for a brand-new user', async () => {
    const { container, root } = render(<PersonalActivityPage />);
    await flush();
    expect(container.textContent).toContain('Nothing here yet');
    act(() => root.unmount());
  });

  it('passes accessibility checks on the populated page', async () => {
    useStore.setState({
      tasks: [mkTask('t-1', { createdAt: atLocalDaysAgo(0) })],
      journals: [mkJournal('j-1', 'Shipped the engine.', atLocalDaysAgo(0))],
    });
    const { container, root } = render(<PersonalActivityPage />);
    await flush();

    expect(await scan(container)).toEqual([]);
    act(() => root.unmount());
  });
});
