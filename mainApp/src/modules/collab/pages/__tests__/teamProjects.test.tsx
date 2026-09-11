import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';
import { ProjectsPage } from '../ProjectsPage';
import { useAuthStore } from '@shared/services/useAuthStore';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import type { Workspace, Project } from '@collab/types/collaboration';

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
  slug: `workspace-${id}`,
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

const project = (id: string, workspaceId: string, overrides: Partial<Project> = {}): Project => ({
  id,
  workspaceId,
  name: `Project ${id}`,
  key: id.toUpperCase(),
  description: `Description for project ${id}`,
  members: [],
  teamIds: [],
  status: 'active',
  milestones: [],
  createdAt: '2026-01-01',
  ...overrides,
});

describe('ProjectsPage workspace management', () => {
  const originalCollab = useCollaborationStore.getState();
  const originalAuth = useAuthStore.getState();

  beforeEach(() => {
    vi.clearAllMocks();
    useCollaborationStore.setState({
      workspaces: [workspace('ws-1'), workspace('ws-2', { name: 'OSS', type: 'Open Source' })],
      workspacesLoading: false,
      activeWorkspaceId: 'ws-1',
      projects: [project('p-1', 'ws-1'), project('p-2', 'ws-1'), project('p-3', 'ws-2')],
      tasks: [],
      setActiveWorkspace: vi.fn(),
    });
    useAuthStore.setState({ user: { _id: 'u-1', name: 'Ajay Kumar', email: 'a@f.io', role: 'user', settings: {} } });
  });

  afterEach(() => {
    useCollaborationStore.setState(originalCollab);
    useAuthStore.setState(originalAuth);
  });

  it('renders projects for the active workspace', () => {
    const { container, root } = render(<ProjectsPage />);
    expect(container.textContent).toContain('Workspace ws-1');
    expect(container.textContent).toContain('Project p-1');
    expect(container.textContent).toContain('Project p-2');
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
