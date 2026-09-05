import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';
import { ProjectsPage } from '../ProjectsPage';
import { useAuthStore } from '@shared/services/useAuthStore';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import type { Workspace } from '@collab/types/collaboration';

function render(node: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(<MemoryRouter>{node}</MemoryRouter>); });
  return { container, root };
}

async function scan(container: HTMLElement) {
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  return results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
}

const workspace = (id: string, overrides: Partial<Workspace> = {}): Workspace => ({
  id,
  name: `Workspace ${id}`,
  type: 'Startup',
  icon: '🏢',
  description: 'A shared engineering workspace.',
  membersCount: 3,
  projectsCount: 2,
  createdAt: '2026-01-01',
  settings: {
    allowMemberInvites: true,
    requireReviewForDone: false,
    autoSyncTimerWorkLogs: true,
    defaultVisibility: 'Workspace',
  },
  ...overrides,
});

function setInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('ProjectsPage workspace management', () => {
  const originalCollab = useCollaborationStore.getState();
  const originalAuth = useAuthStore.getState();
  const loadWorkspaces = vi.fn();
  const createWorkspace = vi.fn(async () => workspace('ws-new', { name: 'New WS' }));
  const updateWorkspace = vi.fn(async () => workspace('ws-1', { name: 'Renamed Workspace' }));
  const deleteWorkspace = vi.fn(async () => true);

  beforeEach(() => {
    vi.clearAllMocks();
    useCollaborationStore.setState({
      workspaces: [workspace('ws-1'), workspace('ws-2', { name: 'OSS', type: 'Open Source' })],
      workspacesLoading: false,
      activeWorkspaceId: '',
      tasks: [],
      loadWorkspaces,
      createWorkspace,
      updateWorkspace,
      deleteWorkspace,
      setActiveWorkspace: vi.fn(),
    });
    useAuthStore.setState({ user: { _id: 'u-1', name: 'Ajay Kumar', email: 'a@f.io', role: 'user', settings: {} } });
  });

  afterEach(() => {
    useCollaborationStore.setState(originalCollab);
    useAuthStore.setState(originalAuth);
  });

  it('renders each workspace with edit and delete affordances in grid view', () => {
    const { container, root } = render(<ProjectsPage />);
    expect(container.querySelector('[aria-label="Edit Workspace ws-1"]')).toBeTruthy();
    expect(container.querySelector('[aria-label="Delete Workspace ws-1"]')).toBeTruthy();
    expect(container.querySelector('[aria-label="Edit OSS"]')).toBeTruthy();
    act(() => root.unmount());
    container.remove();
  });

  it('edits a workspace through the shared modal', async () => {
    const { container, root } = render(<ProjectsPage />);
    const editBtn = container.querySelector('[aria-label="Edit Workspace ws-1"]') as HTMLButtonElement;
    act(() => { editBtn.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(container.textContent).toContain('Edit Workspace');
    expect(container.textContent).toContain('Workspace ws-1');

    const nameInput = container.querySelector('input[required]') as HTMLInputElement;
    setInputValue(nameInput, 'Renamed Workspace');

    const form = container.querySelector('form') as HTMLFormElement;
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(updateWorkspace).toHaveBeenCalledWith('ws-1', {
      name: 'Renamed Workspace',
      type: 'Startup',
      description: 'A shared engineering workspace.',
    });
    expect(container.textContent).not.toContain('Edit Workspace');
    act(() => root.unmount());
    container.remove();
  });

  it('deletes a workspace only after explicit confirmation', async () => {
    const { container, root } = render(<ProjectsPage />);
    const delBtn = container.querySelector('[aria-label="Delete OSS"]') as HTMLButtonElement;
    act(() => { delBtn.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(container.textContent).toContain('Delete OSS?');
    expect(deleteWorkspace).not.toHaveBeenCalled();

    const confirmBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Delete Workspace');
    expect(confirmBtn).toBeTruthy();
    await act(async () => {
      confirmBtn!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(deleteWorkspace).toHaveBeenCalledWith('ws-2');
    expect(container.textContent).not.toContain('Delete OSS?');
    act(() => root.unmount());
    container.remove();
  });

  it('keeps the edit and delete affordances in list view', () => {
    const { container, root } = render(<ProjectsPage />);
    const toggle = container.querySelector('[aria-label="View list"]') as HTMLButtonElement;
    expect(toggle).toBeTruthy();
    act(() => { toggle.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(container.querySelector('[aria-label="Edit Workspace ws-1"]')).toBeTruthy();
    expect(container.querySelector('[aria-label="Delete Workspace ws-1"]')).toBeTruthy();
    act(() => root.unmount());
    container.remove();
  });

  it('has no critical/serious axe violations on a populated page', async () => {
    const { container, root } = render(<ProjectsPage />);
    const violations = await scan(container);
    expect(violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`)).toEqual([]);
    act(() => root.unmount());
    container.remove();
  });
});
