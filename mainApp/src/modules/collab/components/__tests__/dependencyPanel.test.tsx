import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import axe from 'axe-core';
import { DependencyPanel } from '../DependencyPanel';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import type { CollaborativeTask } from '@collab/types/collaboration';

// EEP2-P5.2.2 (s1): the panel lists the task's dependencies (title + board
// status), exposes add/remove against the workspace task pool, and shows a
// "Blocked by N" read-out while any dependency is unfinished. Writes go through
// setDependencies (optimistic + server cycle/same-project guard).
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

describe('DependencyPanel (EEP2-P5.2.2)', () => {
  const originalStore = useCollaborationStore.getState();
  const setDependenciesSpy = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    setDependenciesSpy.mockClear();
    useCollaborationStore.setState({
      tasks: [
        task({ id: 't-1', title: 'Wire the API', dependencies: [] }),
        task({ id: 't-2', title: 'Auth module', sprintStatus: 'done' }),
        task({ id: 't-3', title: 'DB seed', sprintStatus: 'in_progress' }),
      ],
      setDependencies: setDependenciesSpy,
    });
  });

  afterEach(() => {
    useCollaborationStore.setState(originalStore);
  });

  it('lists dependency titles with their board status', () => {
    const parent = task({
      dependencies: ['t-2'],
    });
    const deps = [useCollaborationStore.getState().tasks.find((t) => t.id === 't-2')!];
    const { container, root } = render(<DependencyPanel task={parent} dependencies={deps} />);
    const text = container.textContent ?? '';
    expect(text).toContain('Dependencies');
    expect(text).toContain('Auth module');
    expect(text).toContain('done');
    act(() => root.unmount());
  });

  it('shows an honest empty state when there are no dependencies', () => {
    const { container, root } = render(<DependencyPanel task={task({})} dependencies={[]} />);
    const text = container.textContent ?? '';
    expect(text).toContain('0');
    expect(text).toContain('No dependencies yet');
    act(() => root.unmount());
  });

  it('adds a dependency from the workspace pool via the store', async () => {
    const { container, root } = render(<DependencyPanel task={task({})} dependencies={[]} />);
    const select = container.querySelector<HTMLSelectElement>('[aria-label="Add dependency"]');
    expect(select).toBeTruthy();
    await act(async () => {
      select!.value = 't-3';
      select!.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => {
      [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Add'))!.click();
    });
    expect(setDependenciesSpy).toHaveBeenCalledWith('t-1', ['t-3']);
    act(() => root.unmount());
  });

  it('removes a dependency via the store', async () => {
    const parent = task({ dependencies: ['t-2'] });
    const deps = [useCollaborationStore.getState().tasks.find((t) => t.id === 't-2')!];
    const { container, root } = render(<DependencyPanel task={parent} dependencies={deps} />);
    const removeBtn = container.querySelector<HTMLButtonElement>('[aria-label="Remove dependency Auth module"]');
    expect(removeBtn).toBeTruthy();
    await act(async () => {
      removeBtn!.click();
    });
    expect(setDependenciesSpy).toHaveBeenCalledWith('t-1', []);
    act(() => root.unmount());
  });

  it('shows a blocked read-out while any dependency is unfinished', () => {
    const parent = task({ dependencies: ['t-3'] });
    const deps = [useCollaborationStore.getState().tasks.find((t) => t.id === 't-3')!];
    const { container, root } = render(<DependencyPanel task={parent} dependencies={deps} />);
    expect(container.textContent).toContain('Blocked by 1 unfinished task');
    act(() => root.unmount());
  });

  it('does not suggest self or already-linked tasks as candidates', () => {
    const parent = task({ dependencies: ['t-3'] });
    const deps = [useCollaborationStore.getState().tasks.find((t) => t.id === 't-3')!];
    const { container, root } = render(<DependencyPanel task={parent} dependencies={deps} />);
    const options = [...container.querySelectorAll('option')].map((o) => o.textContent);
    expect(options).toContain('Auth module');
    expect(options).not.toContain('DB seed');
    expect(options).not.toContain('Wire the API');
    act(() => root.unmount());
  });

  it('has no critical/serious axe violations', async () => {
    const parent = task({ dependencies: ['t-2', 't-3'] });
    const deps = ['t-2', 't-3'].map((id) => useCollaborationStore.getState().tasks.find((t) => t.id === id)!);
    const { container, root } = render(<DependencyPanel task={parent} dependencies={deps} />);
    const violations = await scan(container);
    expect(violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`)).toEqual([]);
    act(() => root.unmount());
  });
});
