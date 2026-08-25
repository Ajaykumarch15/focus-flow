import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import axe from 'axe-core';
import { WorkspaceLayout } from '../WorkspaceLayout';
import { useAuthStore } from '../../../store/useAuthStore';
import { useStore } from '../../../store/useStore';
import { useCollaborationStore } from '../../../store/useCollaborationStore';
import type { Project, Workspace } from '../../../types/collaboration';

function render(node: ReactNode, path = '/w/ws-1') {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/w/:workspaceId" element={<WorkspaceLayout />}>
            <Route index element={node} />
            <Route path="overview" element={node} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
  });
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

const project = (id: string, overrides: Partial<Project> = {}): Project => ({
  id,
  workspaceId: 'ws-1',
  name: `Project ${id}`,
  key: `P${id.replace(/[^0-9]/g, '') || 'X'}`,
  description: 'An engineering initiative.',
  repositoryUrl: '',
  members: ['m-1', 'm-2'],
  teamIds: [],
  status: 'active',
  milestones: [],
  createdAt: '2026-01-10',
  ...overrides,
});

describe('WorkspaceLayout engineering workspace shell', () => {
  const originalCollab = useCollaborationStore.getState();
  const originalAuth = useAuthStore.getState();
  const originalStore = useStore.getState();

  beforeEach(() => {
    vi.clearAllMocks();
    useCollaborationStore.setState({
      workspaces: [workspace('ws-1')],
      activeWorkspaceId: 'ws-1',
      projects: [
        project('p-1', { name: 'AI Search Engine', status: 'active' }),
        project('p-2', { name: 'Mobile Gateway', status: 'planning' }),
      ],
      projectsLoading: false,
      teams: [],
      tasks: [],
      blockers: [],
      docs: [],
      sprints: [],
      notifications: [],
      loadCollabData: vi.fn(async () => {}),
    });
    useStore.setState({ dataLoading: false, tasks: [] });
    useAuthStore.setState({ user: { _id: 'u-1', name: 'Ajay Kumar', email: 'a@f.io', role: 'user', settings: {} } });
  });

  afterEach(() => {
    useCollaborationStore.setState(originalCollab);
    useAuthStore.setState(originalAuth);
    useStore.setState(originalStore);
  });

  it('renders the top navigation with breadcrumb, search, and account controls', () => {
    const { container, root } = render(<div>HOME OUTLET</div>);
    expect(container.querySelector('header')).toBeTruthy();
    expect(container.textContent).toContain('FocusFlow');
    const hubLink = container.querySelector('a[href="/hub"]');
    expect(hubLink).toBeTruthy();
    expect(container.textContent).toContain('Workspace Hub');
    expect(container.querySelector('button[aria-label="Search workspace"]')).toBeTruthy();
    expect(container.querySelector('button[aria-label="Notifications"]')).toBeTruthy();
    expect(container.querySelector('button[aria-label="Workspace settings"]')).toBeTruthy();
    expect(container.querySelector('button[aria-label="Switch workspace"]')).toBeTruthy();
    expect(container.textContent).toContain('HOME OUTLET');
    act(() => root.unmount());
    container.remove();
  });

  it('hides the identity header and section tabs on the workspace root page', () => {
    const { container, root } = render(<div>OUTLET</div>);
    expect(container.textContent).toContain('FocusFlow');
    expect(container.textContent).not.toContain('Edit Workspace');
    expect(container.textContent).not.toContain('3 members');
    expect(container.textContent).not.toContain('Mission Control');
    expect(container.textContent).not.toContain('Sprint Board');
    expect(container.textContent).not.toContain('Backlog');
    expect(container.textContent).toContain('OUTLET');
    act(() => root.unmount());
    container.remove();
  });

  it('renders the workspace identity header with badges and quick actions', () => {
    const { container, root } = render(<div>OUTLET</div>, '/w/ws-1/overview');
    expect(container.textContent).toContain('Workspace ws-1');
    expect(container.textContent).toContain('A shared engineering workspace.');
    expect(container.textContent).toContain('3 members');
    expect(container.textContent).toContain('2 projects');
    expect(container.textContent).toContain('1 active');
    expect(container.textContent).toContain('Startup');
    expect([...container.querySelectorAll('button')].some((b) => b.textContent?.includes('Edit Workspace'))).toBeTruthy();
    expect([...container.querySelectorAll('button')].some((b) => b.textContent?.includes('Create Project'))).toBeTruthy();
    act(() => root.unmount());
    container.remove();
  });

  it('renders the workspace section tabs as a horizontal bar (no sidebar)', () => {
    const { container, root } = render(<div>OUTLET</div>, '/w/ws-1/overview');
    expect(container.textContent).toContain('Home');
    expect(container.textContent).toContain('Mission Control');
    expect(container.textContent).toContain('Sprint Board');
    expect(container.textContent).toContain('Backlog');
    expect(container.textContent).toContain('Projects');
    expect(container.textContent).toContain('Teams');
    act(() => root.unmount());
    container.remove();
  });

  it('opens the Edit Workspace modal from the header action', () => {
    const { container, root } = render(<div>OUTLET</div>, '/w/ws-1/overview');
    const edit = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Edit Workspace'));
    expect(edit).toBeTruthy();
    act(() => edit!.click());
    expect(container.textContent).toContain('Save Changes');
    expect(container.textContent).toContain('Workspace Name');
    act(() => root.unmount());
    container.remove();
  });

  it('opens the Create Project modal from the header action', () => {
    const { container, root } = render(<div>OUTLET</div>, '/w/ws-1/overview');
    const create = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Create Project'));
    expect(create).toBeTruthy();
    act(() => create!.click());
    expect(container.textContent).toContain('Create Engineering Project');
    act(() => root.unmount());
    container.remove();
  });

  it('renders without critical or serious accessibility violations', async () => {
    const { container, root } = render(<div>OUTLET</div>, '/w/ws-1/overview');
    const violations = await scan(container);
    expect(violations).toEqual([]);
    act(() => root.unmount());
    container.remove();
  });
});
