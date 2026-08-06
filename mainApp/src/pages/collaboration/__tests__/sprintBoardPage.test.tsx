import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import axe from 'axe-core';
import { SprintBoardPage } from '../SprintBoardPage';
import { useCollaborationStore } from '../../../store/useCollaborationStore';
import type { Sprint, CollaborativeTask, Feature } from '../../../types/collaboration';

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

function dragEvent(type: string, dt: unknown) {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'dataTransfer', { value: dt });
  return ev;
}

function findButton(container: HTMLElement, label: string) {
  return [...container.querySelectorAll('button')].find((b) => b.textContent?.includes(label));
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

const feature = (overrides: Partial<Feature>): Feature => ({
  id: 'f-1', projectId: 'p1', workspaceId: 'ws-1', name: 'Auth module',
  description: '', type: 'feature', labels: [], ownerId: 'm-1',
  estimatedHours: 8, status: 'backlog', order: 0, createdAt: '2026-01-01',
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

  // EEP2-P4.3.3 (s1) planning toggle / (s3) capacity bar / (s2) drag/drop.
  it('hides the capacity panel until planning mode is toggled on', () => {
    const { container, root } = render(<SprintBoardPage />);
    expect(container.querySelector('[data-testid="capacity-panel"]')).toBeNull();
    const toggle = findButton(container, 'Planning mode');
    expect(toggle).toBeTruthy();
    expect(toggle?.getAttribute('aria-pressed')).toBe('false');
    act(() => toggle!.click());
    expect(container.querySelector('[data-testid="capacity-panel"]')).toBeTruthy();
    expect(toggle?.getAttribute('aria-pressed')).toBe('true');
    act(() => root.unmount());
  });

  it('shows the planning capacity bar from sprint features + tasks', () => {
    useCollaborationStore.setState({
      features: [feature({ id: 'f-1', sprintId: 's1', estimatedHours: 40, name: 'Auth module' })],
      tasks: [
        task({ id: 't-3', sprintId: 's1', sprintStatus: 'in_progress', estimatedHours: 40, title: 'Planned task' }),
      ],
    });
    const { container, root } = render(<SprintBoardPage />);
    act(() => findButton(container, 'Planning mode')!.click());
    const text = container.textContent ?? '';
    // 40h feature + 40h task = 80h of the 160h capacity budget → 50%.
    expect(text).toContain('80h');
    expect(text).toContain('of 160h loaded (50%)');
    expect(text).toContain('80h of headroom remains');
    const bar = container.querySelector<HTMLDivElement>('[data-testid="capacity-bar"]');
    expect(bar?.style.width).toBe('50%');
    act(() => root.unmount());
  });

  it('reassigns a task via drag-and-drop between columns in planning mode', () => {
    const { container, root } = render(<SprintBoardPage />);
    act(() => findButton(container, 'Planning mode')!.click());
    const card = container.querySelector<HTMLElement>('[data-testid="task-card-t-1"]');
    const doneCol = container.querySelector<HTMLElement>('[data-testid="column-done"]');
    expect(card).toBeTruthy();
    expect(doneCol).toBeTruthy();
    const dt = { setData: vi.fn(), getData: () => 't-1', effectAllowed: 'move' };
    act(() => card!.dispatchEvent(dragEvent('dragstart', dt)));
    act(() => doneCol!.dispatchEvent(dragEvent('drop', dt)));
    expect(updateTaskStatusSpy).toHaveBeenCalledWith('t-1', 'done');
    act(() => root.unmount());
  });

  // EEP2-P5.1.3 (s2): the card's subtask toggle expands the SubtaskPanel inline.
  it('expands a task card subtask panel via its toggle', () => {
    useCollaborationStore.setState({
      tasks: [
        task({
          id: 't-1', sprintStatus: 'in_progress',
          subtasks: [{ id: 's1', title: 'Write tests', completed: false }],
        }),
      ],
    });
    const { container, root } = render(<SprintBoardPage />);
    expect(container.querySelector('[data-testid="subtask-panel-t-1"]')).toBeNull();
    const toggle = container.querySelector<HTMLButtonElement>('[aria-label="Subtasks for Wire the API"]');
    expect(toggle).toBeTruthy();
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    act(() => toggle!.click());
    const panel = container.querySelector('[data-testid="subtask-panel-t-1"]');
    expect(panel).toBeTruthy();
    expect(panel?.textContent).toContain('0/1');
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    act(() => root.unmount());
  });

  // EEP2-P5.2.2 (s2): blocked styling derives from selectBlockedTasks — a card
  // with an unfinished dependency gets the amber border + "Blocked" badge.
  it('marks a card blocked only when it has an unfinished dependency', () => {
    useCollaborationStore.setState({
      tasks: [
        task({ id: 't-1', sprintStatus: 'in_progress', dependencies: ['t-2'], title: 'Wire the API' }),
        task({ id: 't-2', sprintStatus: 'in_progress', title: 'Seed the database' }),
        task({ id: 't-3', sprintStatus: 'backlog', dependencies: ['t-4'], title: 'Ship the release' }),
        task({ id: 't-4', sprintStatus: 'done', title: 'QA sign-off' }),
      ],
    });
    const { container, root } = render(<SprintBoardPage />);
    const blockedCard = container.querySelector<HTMLElement>('[data-testid="task-card-t-1"]');
    const clearCard = container.querySelector<HTMLElement>('[data-testid="task-card-t-3"]');
    expect(blockedCard?.className).toContain('border-warning-500/50');
    expect(blockedCard?.textContent).toContain('Blocked');
    expect(blockedCard?.textContent).toContain('Dependencies 0/1');
    expect(clearCard?.className).not.toContain('border-warning-500/50');
    expect(clearCard?.textContent).not.toContain('Blocked');
    expect(clearCard?.textContent).toContain('Dependencies 1/1');
    act(() => root.unmount());
  });

  // EEP2-P5.2.2 (s1): the card's dependency toggle expands the DependencyPanel.
  it('expands a task card dependency panel via its toggle', () => {
    useCollaborationStore.setState({
      tasks: [
        task({ id: 't-1', sprintStatus: 'in_progress', dependencies: ['t-2'], title: 'Wire the API' }),
        task({ id: 't-2', sprintStatus: 'done', title: 'Seed the database' }),
      ],
    });
    const { container, root } = render(<SprintBoardPage />);
    expect(container.querySelector('[data-testid="dependency-panel-t-1"]')).toBeNull();
    const toggle = container.querySelector<HTMLButtonElement>('[aria-label="Dependencies for Wire the API"]');
    expect(toggle).toBeTruthy();
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    act(() => toggle!.click());
    const panel = container.querySelector('[data-testid="dependency-panel-t-1"]');
    expect(panel).toBeTruthy();
    expect(panel?.textContent).toContain('Seed the database');
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    act(() => root.unmount());
  });
});
