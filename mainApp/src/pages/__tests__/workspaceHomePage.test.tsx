import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import axe from 'axe-core';
import { WorkspaceHomePage } from '../collaboration/WorkspaceHomePage';
import { useAuthStore } from '../../store/useAuthStore';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import type { Project, Workspace } from '../../types/collaboration';

function render(node: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <MemoryRouter initialEntries={['/w/ws-1']}>
        <Routes>
          <Route path="/w/:workspaceId" element={node} />
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

function setInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function setSelectValue(el: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('WorkspaceHomePage project launcher', () => {
  const originalCollab = useCollaborationStore.getState();
  const originalAuth = useAuthStore.getState();

  beforeEach(() => {
    vi.clearAllMocks();
    useCollaborationStore.setState({
      workspaces: [workspace('ws-1')],
      activeWorkspaceId: 'ws-1',
      projects: [
        project('p-1', { name: 'AI Search Engine', key: 'ASE', status: 'active' }),
        project('p-2', { name: 'Mobile Gateway', key: 'MGW', status: 'planning' }),
        project('p-3', { name: 'Data Platform', key: 'DPL', status: 'completed', members: ['m-1'] }),
      ],
      projectsLoading: false,
      teams: [],
      tasks: [
        { id: 't-1', workspaceId: 'ws-1', projectId: 'p-1', sprintStatus: 'done', updatedAt: '2026-02-01' },
        { id: 't-2', workspaceId: 'ws-1', projectId: 'p-1', sprintStatus: 'in_progress', updatedAt: '2026-02-02' },
      ] as any,
      createProject: vi.fn(),
    });
    useAuthStore.setState({ user: { _id: 'u-1', name: 'Ajay Kumar', email: 'a@f.io', role: 'user', settings: {} } });
  });

  afterEach(() => {
    useCollaborationStore.setState(originalCollab);
    useAuthStore.setState(originalAuth);
  });

  it('renders the workspace header, stats, and project cards', () => {
    const { container, root } = render(<WorkspaceHomePage />);
    expect(container.textContent).toContain('Workspace ws-1');
    expect(container.textContent).toContain('A shared engineering workspace.');
    expect(container.textContent).toContain('3 members');
    expect(container.textContent).toContain('3 projects');
    expect(container.textContent).toContain('1 active');
    expect(container.textContent).toContain('AI Search Engine');
    expect(container.textContent).toContain('Mobile Gateway');
    expect(container.textContent).toContain('Data Platform');
    expect(container.textContent).toContain('2 members');
    act(() => root.unmount());
    container.remove();
  });

  it('shows a loading skeleton while projects are loading', () => {
    useCollaborationStore.setState({ projectsLoading: true });
    const { container, root } = render(<WorkspaceHomePage />);
    expect(container.querySelector('.skeleton')).toBeTruthy();
    expect(container.textContent).not.toContain('AI Search Engine');
    act(() => root.unmount());
    container.remove();
  });

  it('shows the empty state when the workspace has no projects', () => {
    useCollaborationStore.setState({ projects: [] });
    const { container, root } = render(<WorkspaceHomePage />);
    expect(container.textContent).toContain('No projects yet');
    act(() => root.unmount());
    container.remove();
  });

  it('opens the Create Project modal from the left CTA card', () => {
    const { container, root } = render(<WorkspaceHomePage />);
    const cta = container.querySelector('[aria-label="Create new project"]') as HTMLButtonElement;
    act(() => { cta.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(container.textContent).toContain('Create Engineering Project');
    act(() => root.unmount());
    container.remove();
  });

  it('opens the Create Project modal from the empty-state action', () => {
    useCollaborationStore.setState({ projects: [] });
    const { container, root } = render(<WorkspaceHomePage />);
    const button = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Create Project');
    expect(button).toBeTruthy();
    act(() => { button!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(container.textContent).toContain('Create Engineering Project');
    act(() => root.unmount());
    container.remove();
  });

  it('links project cards to the project route', () => {
    const { container, root } = render(<WorkspaceHomePage />);
    const link = container.querySelector('a[aria-label="Open AI Search Engine"]');
    expect(link?.getAttribute('href')).toBe('/w/ws-1/projects/p-1');
    act(() => root.unmount());
    container.remove();
  });

  it('searches projects by name, key, and description', () => {
    const { container, root } = render(<WorkspaceHomePage />);
    const input = container.querySelector('input[aria-label="Search projects"]') as HTMLInputElement;

    setInputValue(input, 'mobile');
    expect(container.textContent).toContain('Mobile Gateway');
    expect(container.textContent).not.toContain('AI Search Engine');
    expect(container.textContent).not.toContain('Data Platform');

    setInputValue(input, 'DPL');
    expect(container.textContent).toContain('Data Platform');
    expect(container.textContent).not.toContain('Mobile Gateway');

    setInputValue(input, 'zzz');
    expect(container.textContent).toContain('No matching projects');
    act(() => root.unmount());
    container.remove();
  });

  it('filters projects by status', () => {
    const { container, root } = render(<WorkspaceHomePage />);
    const select = container.querySelector('select[aria-label="Filter by status"]') as HTMLSelectElement;

    setSelectValue(select, 'planning');
    expect(container.textContent).toContain('Mobile Gateway');
    expect(container.textContent).not.toContain('AI Search Engine');
    expect(container.textContent).not.toContain('Data Platform');

    setSelectValue(select, 'completed');
    expect(container.textContent).toContain('Data Platform');
    expect(container.textContent).not.toContain('AI Search Engine');
    act(() => root.unmount());
    container.remove();
  });

  it('sorts projects by name', () => {
    const { container, root } = render(<WorkspaceHomePage />);
    const select = container.querySelector('select[aria-label="Sort projects"]') as HTMLSelectElement;
    setSelectValue(select, 'name');
    const titles = Array.from(container.querySelectorAll('a[aria-label^="Open "] h3')).map((h) => h.textContent);
    expect(titles).toEqual(['AI Search Engine', 'Data Platform', 'Mobile Gateway']);
    act(() => root.unmount());
    container.remove();
  });

  it('paginates when there are more projects than the page size', () => {
    const many = Array.from({ length: 7 }, (_, i) => project(`p-${i + 1}`, { name: `Project ${i + 1}` }));
    useCollaborationStore.setState({ projects: many });
    const { container, root } = render(<WorkspaceHomePage />);

    expect(container.textContent).toContain('1 of 2');
    const next = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Next') as HTMLButtonElement;
    const prev = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Previous') as HTMLButtonElement;
    expect(prev.disabled).toBe(true);

    act(() => { next.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(container.textContent).toContain('2 of 2');
    expect(Array.from(container.querySelectorAll('a[aria-label^="Open "] h3')).length).toBe(1);

    act(() => { next.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(container.textContent).toContain('2 of 2');
    act(() => root.unmount());
    container.remove();
  });

  it('hides pagination when projects fit on one page', () => {
    const { container, root } = render(<WorkspaceHomePage />);
    expect(container.textContent).not.toContain('of 2');
    expect(Array.from(container.querySelectorAll('button')).some((b) => b.textContent === 'Next')).toBe(false);
    act(() => root.unmount());
    container.remove();
  });

  it('has no critical/serious axe violations on a populated page', async () => {
    const { container, root } = render(<WorkspaceHomePage />);
    const violations = await scan(container);
    expect(violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`)).toEqual([]);
    act(() => root.unmount());
    container.remove();
  });
});
