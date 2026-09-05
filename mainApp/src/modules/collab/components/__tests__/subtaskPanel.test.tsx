import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import axe from 'axe-core';
import { SubtaskPanel } from '../SubtaskPanel';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import type { CollaborativeTask } from '@collab/types/collaboration';

// EEP2-P5.1.3 (s2): the subtask panel renders the DDS §4.10 progress read-out,
// an honest empty state, and wires add/toggle/delete to the store actions.
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

describe('SubtaskPanel (EEP2-P5.1.3)', () => {
  const originalStore = useCollaborationStore.getState();
  const addSubtaskSpy = vi.fn().mockResolvedValue(undefined);
  const toggleSubtaskSpy = vi.fn().mockResolvedValue(undefined);
  const deleteSubtaskSpy = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    addSubtaskSpy.mockClear();
    toggleSubtaskSpy.mockClear();
    deleteSubtaskSpy.mockClear();
    useCollaborationStore.setState({
      tasks: [task({ subtasks: [{ id: 's1', title: 'Write tests', completed: false }] })],
      addSubtask: addSubtaskSpy,
      toggleSubtask: toggleSubtaskSpy,
      deleteSubtask: deleteSubtaskSpy,
    });
  });

  afterEach(() => {
    useCollaborationStore.setState(originalStore);
  });

  it('renders the x/y progress read-out and lists the subtasks', () => {
    const withSubtasks = task({
      subtasks: [
        { id: 's1', title: 'Write tests', completed: true },
        { id: 's2', title: 'Run tests', completed: false },
        { id: 's3', title: 'Ship it', completed: false },
      ],
    });
    const { container, root } = render(<SubtaskPanel task={withSubtasks} />);
    const text = container.textContent ?? '';
    expect(text).toContain('Subtasks');
    expect(text).toContain('1/3');
    expect(text).toContain('Write tests');
    expect(text).toContain('Run tests');
    expect(text).toContain('Ship it');
    act(() => root.unmount());
  });

  it('shows an honest empty state when there are no subtasks', () => {
    const { container, root } = render(<SubtaskPanel task={task({ subtasks: [] })} />);
    const text = container.textContent ?? '';
    expect(text).toContain('0/0');
    expect(text).toContain('No subtasks yet');
    act(() => root.unmount());
  });

  it('adds a subtask through the store and clears the input', async () => {
    const { container, root } = render(<SubtaskPanel task={task({ subtasks: [] })} />);
    const input = container.querySelector<HTMLInputElement>('[aria-label="New subtask title"]');
    expect(input).toBeTruthy();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
      setter.call(input, 'Write tests');
      input!.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(addSubtaskSpy).toHaveBeenCalledWith('t-1', 'Write tests');
    expect(input!.value).toBe('');
    act(() => root.unmount());
  });

  it('toggles a subtask via the store when the checkbox changes', async () => {
    const withSubtasks = task({ subtasks: [{ id: 's1', title: 'Write tests', completed: false }] });
    const { container, root } = render(<SubtaskPanel task={withSubtasks} />);
    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(checkbox).toBeTruthy();
    await act(async () => {
      checkbox!.click();
    });
    expect(toggleSubtaskSpy).toHaveBeenCalledWith('t-1', 's1', true);
    act(() => root.unmount());
  });

  it('deletes a subtask via the store', async () => {
    const withSubtasks = task({ subtasks: [{ id: 's1', title: 'Write tests', completed: false }] });
    const { container, root } = render(<SubtaskPanel task={withSubtasks} />);
    const deleteBtn = container.querySelector<HTMLButtonElement>('[aria-label="Delete subtask Write tests"]');
    expect(deleteBtn).toBeTruthy();
    await act(async () => {
      deleteBtn!.click();
    });
    expect(deleteSubtaskSpy).toHaveBeenCalledWith('t-1', 's1');
    act(() => root.unmount());
  });

  it('has no critical/serious axe violations', async () => {
    const withSubtasks = task({
      subtasks: [
        { id: 's1', title: 'Write tests', completed: true },
        { id: 's2', title: 'Run tests', completed: false },
      ],
    });
    const { container, root } = render(<SubtaskPanel task={withSubtasks} />);
    const violations = await scan(container);
    expect(violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`)).toEqual([]);
    act(() => root.unmount());
  });
});
