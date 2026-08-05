import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';
import { WorkspaceProjectsPage } from '../WorkspaceProjectsPage';
import { WorkspaceTeamsPage } from '../WorkspaceTeamsPage';
import { WorkspaceMembersPage } from '../WorkspaceMembersPage';
import { useCollaborationStore } from '../../../store/useCollaborationStore';
import type { Project, WorkspaceMember } from '../../../types/collaboration';

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

const project = (id: string): Project => ({
  id, workspaceId: 'ws-1', name: `Project ${id}`, key: 'PRJ', description: '',
  members: [], teamIds: [], status: 'active', milestones: [], createdAt: '2026-01-01',
});

const member = (id: string, overrides: Partial<WorkspaceMember> = {}): WorkspaceMember => ({
  id, name: 'Ada Lovelace', email: 'ada@focusflow.io', role: 'Developer',
  teams: [], status: 'available', joinedAt: '2026-01-01', ...overrides,
});

describe('WorkspaceProjectsPage (S4-T3)', () => {
  const originalStore = useCollaborationStore.getState();

  beforeEach(() => {
    useCollaborationStore.setState({
      activeWorkspaceId: 'ws-1',
      projects: [project('p1'), { ...project('p2'), workspaceId: 'ws-other' }],
    });
  });

  afterEach(() => {
    useCollaborationStore.setState(originalStore);
  });

  it('renders the deep-link page header with only this workspace’s projects', () => {
    const { container, root } = render(<WorkspaceProjectsPage />);
    const text = container.textContent ?? '';
    expect(text).toContain('Projects & Milestones');
    expect(text).toContain('Project p1');
    expect(text).not.toContain('Project p2');
    act(() => root.unmount());
  });

  it('opens the Create Project modal from the New Project button', () => {
    const { container, root } = render(<WorkspaceProjectsPage />);
    const button = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('New Project'));
    expect(button).toBeTruthy();
    act(() => { button!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(container.textContent).toContain('Create Project');
    act(() => root.unmount());
  });

  it('renders an honest empty state when there are no projects', () => {
    useCollaborationStore.setState({ projects: [] });
    const { container, root } = render(<WorkspaceProjectsPage />);
    expect(container.textContent).toContain('No projects yet');
    act(() => root.unmount());
  });

  it('has no critical/serious axe violations on a populated page', async () => {
    const { container, root } = render(<WorkspaceProjectsPage />);
    const violations = await scan(container);
    expect(violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`)).toEqual([]);
    act(() => root.unmount());
  });
});

describe('WorkspaceTeamsPage (S4-T3)', () => {
  const originalStore = useCollaborationStore.getState();
  const updateMemberRoleSpy = vi.fn();

  beforeEach(() => {
    updateMemberRoleSpy.mockClear();
    useCollaborationStore.setState({
      activeWorkspaceId: 'ws-1',
      members: [member('m-1', { role: 'Owner' }), member('m-2', { name: 'Grace Hopper', email: 'grace@focusflow.io', role: 'Viewer' })],
      updateMemberRole: updateMemberRoleSpy,
    });
  });

  afterEach(() => {
    useCollaborationStore.setState(originalStore);
  });

  it('renders the roster with each member’s current role', () => {
    const { container, root } = render(<WorkspaceTeamsPage />);
    const text = container.textContent ?? '';
    expect(text).toContain('Teams & Access');
    expect(text).toContain('Ada Lovelace');
    expect(text).toContain('Grace Hopper');
    expect(text).toContain('Owner');
    act(() => root.unmount());
  });

  it('updates a member role through the store action', () => {
    const { container, root } = render(<WorkspaceTeamsPage />);
    const select = Array.from(container.querySelectorAll('select')).find((s) => s.getAttribute('aria-label') === 'Member role');
    act(() => { select!.value = 'Admin'; select!.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(updateMemberRoleSpy).toHaveBeenCalledWith('m-1', 'Admin');
    act(() => root.unmount());
  });

  it('renders an honest empty state when the roster is empty', () => {
    useCollaborationStore.setState({ members: [] });
    const { container, root } = render(<WorkspaceTeamsPage />);
    expect(container.textContent).toContain('No members in this workspace yet');
    act(() => root.unmount());
  });

  it('has no critical/serious axe violations on a populated page', async () => {
    const { container, root } = render(<WorkspaceTeamsPage />);
    const violations = await scan(container);
    expect(violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`)).toEqual([]);
    act(() => root.unmount());
  });
});

describe('WorkspaceMembersPage (S4-T3)', () => {
  const originalStore = useCollaborationStore.getState();

  beforeEach(() => {
    useCollaborationStore.setState({
      activeWorkspaceId: 'ws-1',
      members: [
        member('m-1', { role: 'Owner', status: 'in_focus', teams: ['Frontend'] }),
        member('m-2', { name: 'Grace Hopper', email: 'grace@focusflow.io', role: 'Viewer', status: 'offline', teams: [] }),
      ],
    });
  });

  afterEach(() => {
    useCollaborationStore.setState(originalStore);
  });

  it('renders the roster directory with status and role badges', () => {
    const { container, root } = render(<WorkspaceMembersPage />);
    const text = container.textContent ?? '';
    expect(text).toContain('Member Roster');
    expect(text).toContain('Ada Lovelace');
    expect(text).toContain('Grace Hopper');
    expect(text).toContain('1/2');
    expect(text).toContain('in focus');
    expect(text).toContain('View Profile');
    act(() => root.unmount());
  });

  it('renders an honest empty state when there are no members', () => {
    useCollaborationStore.setState({ members: [] });
    const { container, root } = render(<WorkspaceMembersPage />);
    expect(container.textContent).toContain('No members yet');
    act(() => root.unmount());
  });

  it('has no critical/serious axe violations on a populated page', async () => {
    const { container, root } = render(<WorkspaceMembersPage />);
    const violations = await scan(container);
    expect(violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`)).toEqual([]);
    act(() => root.unmount());
  });
});
