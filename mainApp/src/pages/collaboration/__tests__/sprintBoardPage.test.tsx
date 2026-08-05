import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import axe from 'axe-core';
import { SprintBoardPage } from '../SprintBoardPage';
import { useCollaborationStore } from '../../../store/useCollaborationStore';
import type { Sprint, CollaborativeTask } from '../../../types/collaboration';

function render(node: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(node); });
  return { container, root };
}

async function scan(container: HTMLElement) {
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  return results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
}

const sprint = (id: string): Sprint => ({
  id, workspaceId: 'ws-1', projectId: 'p1', name: `Sprint ${id}`,
  startDate: '2026-01-01', endDate: '2026-01-07', goal: 'Ship the alpha',
  status: 'active', capacityHours: 160, targetVelocity: 80,
});

const task = (overrides: Partial<CollaborativeTask>): CollaborativeTask => ({
  id: 't-1',
  workspaceId: 'ws-1',
  projectId: 'p1',
  title: 'Wire the API',
  description: 'Connect the client to the backend.',
  sprintStatus: 'in_progress',
  priority: 'high',
  ownerId: 'm-1',
  followerIds: [],
  labels: [],
  dependencies: [],
  estimatedHours: 8,
  actualHours: 0,
  subtasks: [],
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  ...overrides,
});

describe('SprintBoardPage (S4-T1)', () => {
  const originalStore = useCollaborationStore.getState();
  const updateTaskStatusSpy = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    updateTaskStatusSpy.mockClear();
    useCollaborationStore.setState({
      activeWorkspaceId: 'ws-1',
      sprints: [sprint('s1')],
      tasks: [
        task({ id: 't-1', sprintStatus: 'in_progress', title: 'Wire the API' }),
        task({ id: 't-2', sprintStatus: 'done', title: 'Seed the database' }),
      ],
      updateTaskStatus: updateTaskStatusSpy,
    });
  });

  afterEach(() => {
    useCollaborationStore.setState(originalStore);
  });

  it('renders the empty state when the workspace has no tasks', () => {
    useCollaborationStore.setState({ tasks: [] });
    const { container, root } = render(<SprintBoardPage />);
    expect(container.textContent).toContain('No tasks yet in this workspace');
    act(() => root.unmount());
  });

  it('shows the active sprint header with capacity and goal', () => {
    const { container, root } = render(<SprintBoardPage />);
    const text = container.textContent ?? '';
    expect(text).toContain('Sprint Planning');
    expect(text).toContain('Sprint s1');
    expect(text).toContain('Ship the alpha');
    expect(text).toContain('160h');
    act(() => root.unmount());
  });

  it('places tasks into their kanban columns', () => {
    const { container, root } = render(<SprintBoardPage />);
    const text = container.textContent ?? '';
    expect(text).toContain('In Progress');
    expect(text).toContain('Done');
    expect(text).toContain('Wire the API');
    expect(text).toContain('Seed the database');
    act(() => root.unmount());
  });

  it('moves a task to another status via the quick status select', () => {
    const { container, root } = render(<SprintBoardPage />);
    const select = container.querySelector<HTMLSelectElement>('[aria-label="Task status"]');
    expect(select).toBeTruthy();
    act(() => {
      select!.value = 'review';
      select!.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(updateTaskStatusSpy).toHaveBeenCalledWith('t-1', 'review');
    act(() => root.unmount());
  });

  it('has no critical/serious axe violations on a populated board', async () => {
    const { container, root } = render(<SprintBoardPage />);
    const violations = await scan(container);
    expect(violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`)).toEqual([]);
    act(() => root.unmount());
  });
});
