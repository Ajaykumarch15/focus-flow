import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';
import { WorkspaceHub } from '../WorkspaceHub';
import { useAuthStore } from '../../store/useAuthStore';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import type { Workspace } from '../../types/collaboration';

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

describe('WorkspaceHub (IES-P2-07)', () => {
  const originalCollab = useCollaborationStore.getState();
  const originalAuth = useAuthStore.getState();
  const loadWorkspaces = vi.fn();

  beforeEach(() => {
    loadWorkspaces.mockReset();
    useCollaborationStore.setState({
      workspaces: [workspace('ws-1'), workspace('ws-2', { name: 'OSS', type: 'Open Source', membersCount: 5 })],
      loadWorkspaces,
    });
    useAuthStore.setState({ user: { _id: 'u-1', name: 'Ajay Kumar', email: 'a@f.io', role: 'user', settings: {} } });
  });

  afterEach(() => {
    useCollaborationStore.setState(originalCollab);
    useAuthStore.setState(originalAuth);
  });

  it('loads real workspaces on mount', () => {
    const { container, root } = render(<WorkspaceHub />);
    expect(loadWorkspaces).toHaveBeenCalled();
    act(() => root.unmount());
    container.remove();
  });

  it('renders the personal + team cards with real workspace and member counts', () => {
    const { container, root } = render(<WorkspaceHub />);
    const text = container.textContent ?? '';
    expect(text).toContain('Personal Workspace');
    expect(text).toContain('Team Collaboration');
    expect(text).toContain('2 Workspaces');
    expect(text).toContain('8 Members');
    expect(text).toContain('Ajay Kumar');
    act(() => root.unmount());
    container.remove();
  });

  it('has no critical/serious axe violations on a populated hub', async () => {
    const { container, root } = render(<WorkspaceHub />);
    const violations = await scan(container);
    expect(violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`)).toEqual([]);
    act(() => root.unmount());
    container.remove();
  });
});
