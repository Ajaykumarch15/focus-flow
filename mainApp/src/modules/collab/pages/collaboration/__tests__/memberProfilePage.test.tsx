import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import axe from 'axe-core';
import { MemberProfilePage } from '../MemberProfilePage';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import type {
  WorkspaceMember, WorkspaceActivity, CollaborativeTask, Sprint,
} from '@collab/types/collaboration';

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

const member: WorkspaceMember = {
  id: 'm-1', name: 'Ada Lovelace', email: 'ada@focusflow.io',
  role: 'Developer', teams: ['Frontend'], status: 'available',
  currentFocusTimeMs: 7200000, joinedAt: '2026-01-01',
};

const task: CollaborativeTask = {
  id: 't-1', workspaceId: 'ws-1', projectId: 'p-1', sprintId: 's-1',
  title: 'Fix CI pipeline', description: 'Restore green builds.',
  sprintStatus: 'done', priority: 'high', ownerId: 'm-1', assigneeId: 'm-1',
  reviewerId: undefined, followerIds: [], labels: [], dependencies: [],
  estimatedHours: 2, actualHours: 3, gitContext: { branch: 'fix/ci' },
  subtasks: [], createdAt: '2026-01-01', updatedAt: '2026-01-01',
};

const sprint: Sprint = {
  id: 's-1', workspaceId: 'ws-1', projectId: 'p-1', name: 'Sprint 24 — AI Copilot',
  startDate: '2026-01-01', endDate: '2026-01-10', goal: 'Ship it',
  status: 'active', capacityHours: 40, targetVelocity: 10,
};

const activity: WorkspaceActivity = {
  id: 'a-1', workspaceId: 'ws-1',
  actor: { id: 'm-1', name: 'Ada Lovelace' },
  action: 'project.updated', details: { projectName: 'Ship it' },
  timestamp: '2026-01-01T00:00:00.000Z',
};

const page = (
  <MemoryRouter initialEntries={['/w/ws-1/members/m-1']}>
    <Routes>
      <Route path="/w/:workspaceId/members/:memberId" element={<MemberProfilePage />} />
    </Routes>
  </MemoryRouter>
);

describe('MemberProfilePage (IES-P2-08)', () => {
  const originalStore = useCollaborationStore.getState();
  const updateMemberRole = vi.fn();

  beforeEach(() => {
    updateMemberRole.mockReset();
    useCollaborationStore.setState({
      activeWorkspaceId: 'ws-1',
      members: [member],
      tasks: [task],
      sprints: [sprint],
      activities: [activity],
      updateMemberRole,
    });
  });

  afterEach(() => {
    useCollaborationStore.setState(originalStore);
  });

  it('renders the member header with role, status and team badges', () => {
    const { container, root } = render(page);
    const text = container.textContent ?? '';
    expect(text).toContain('Ada Lovelace');
    expect(text).toContain('Role: Developer');
    expect(text).toContain('available');
    expect(text).toContain('Team: Frontend');
    act(() => root.unmount());
    container.remove();
  });

  it('renders telemetry from real store data (focus time, features, active sprint)', () => {
    const { container, root } = render(page);
    const text = container.textContent ?? '';
    expect(text).toContain('2h 0m');
    expect(text).toContain('1 Features');
    expect(text).toContain('1 Done');
    expect(text).toContain('Sprint 24 — AI Copilot');
    expect(text).toContain('Fix CI pipeline');
    act(() => root.unmount());
    container.remove();
  });

  it('renders the member activity timeline with labels and detail', () => {
    const { container, root } = render(page);
    const text = container.textContent ?? '';
    expect(text).toContain('updated a project');
    expect(text).toContain('Project: Ship it');
    act(() => root.unmount());
    container.remove();
  });

  it('edits a member role through updateMemberRole', () => {
    const { container, root } = render(page);
    const edit = Array.from(container.querySelectorAll('button')).find((b) => b.getAttribute('aria-label') === 'Edit role');
    expect(edit).toBeTruthy();
    act(() => { edit!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    const select = Array.from(container.querySelectorAll('select')).find((s) => s.getAttribute('aria-label') === 'Role');
    act(() => { select!.value = 'Admin'; select!.dispatchEvent(new Event('change', { bubbles: true })); });
    const save = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Save'));
    act(() => { save!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(updateMemberRole).toHaveBeenCalledWith('m-1', 'Admin');
    act(() => root.unmount());
    container.remove();
  });

  it('renders an honest not-found state for an unknown member id', () => {
    useCollaborationStore.setState({ members: [] });
    const { container, root } = render(page);
    expect(container.textContent).toContain('Member not found');
    act(() => root.unmount());
    container.remove();
  });

  it('has no critical/serious axe violations on a populated profile', async () => {
    const { container, root } = render(page);
    const violations = await scan(container);
    expect(violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`)).toEqual([]);
    act(() => root.unmount());
    container.remove();
  });
});
