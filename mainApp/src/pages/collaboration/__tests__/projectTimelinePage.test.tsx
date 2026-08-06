import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import axe from 'axe-core';
import { ProjectTimelinePage } from '../ProjectTimelinePage';
import { useCollaborationStore } from '../../../store/useCollaborationStore';
import type {
  CentralBlocker,
  CollaborativeTask,
  Feature,
  Project,
  Sprint,
  WorkspaceActivity,
  WorkspaceMember,
} from '../../../types/collaboration';

function renderAt(path: string, node: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/w/:workspaceId/projects/:projectId/timeline" element={node} />
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

const project = (overrides: Partial<Project> = {}): Project => ({
  id: 'p1',
  workspaceId: 'ws-1',
  name: 'AI Copilot',
  key: 'FF',
  description: '',
  members: ['m-1'],
  teamIds: ['t-1'],
  status: 'active',
  milestones: [
    { id: 'ms-1', title: 'Beta release', dueDate: '2026-03-20', status: 'completed', targetPoints: 40 },
  ],
  createdAt: '2026-01-05',
  ...overrides,
});

const sprint = (overrides: Partial<Sprint> = {}): Sprint => ({
  id: 's1',
  workspaceId: 'ws-1',
  projectId: 'p1',
  name: 'Sprint 12',
  startDate: '2026-03-01',
  endDate: '2026-03-14',
  goal: '',
  status: 'completed',
  capacityHours: 160,
  targetVelocity: 80,
  ...overrides,
});

const feature = (overrides: Partial<Feature> = {}): Feature => ({
  id: 'f1',
  projectId: 'p1',
  workspaceId: 'ws-1',
  name: 'Inline completions',
  description: '',
  type: 'feature',
  labels: [],
  estimatedHours: 8,
  status: 'in_progress',
  order: 1,
  createdAt: '2026-02-01',
  ...overrides,
});

const task = (overrides: Partial<CollaborativeTask> = {}): CollaborativeTask => ({
  id: 't1',
  workspaceId: 'ws-1',
  projectId: 'p1',
  sprintId: 's1',
  featureId: 'f1',
  title: 'Wire the model endpoint',
  description: '',
  sprintStatus: 'in_progress',
  priority: 'high',
  ownerId: 'm-1',
  assigneeId: 'm-1',
  followerIds: [],
  labels: [],
  dependencies: [],
  estimatedHours: 8,
  actualHours: 0,
  subtasks: [],
  createdAt: '2026-02-20',
  updatedAt: '2026-03-10',
  ...overrides,
});

const blocker = (overrides: Partial<CentralBlocker> = {}): CentralBlocker => ({
  id: 'b1',
  workspaceId: 'ws-1',
  taskId: 't1',
  title: 'Model latency spikes',
  severity: 'high',
  ownerId: 'm-1',
  reporterId: 'm-2',
  status: 'open',
  impactDescription: '',
  createdAt: '2026-03-08',
  ...overrides,
});

const member = (id: string, name: string): WorkspaceMember => ({
  id,
  name,
  email: `${id}@focusflow.io`,
  role: 'Developer',
  teams: [],
  status: 'available',
  joinedAt: '2026-01-01',
});

const activity = (overrides: Partial<WorkspaceActivity>): WorkspaceActivity => ({
  id: 'a-1',
  workspaceId: 'ws-1',
  actor: { id: 'm-1', name: 'Ada Lovelace' },
  action: 'task.created',
  details: {},
  timestamp: '2026-03-09T10:00:00.000Z',
  ...overrides,
});

const seededState = () => ({
  activeWorkspaceId: 'ws-1',
  loadWorkspaceActivity: vi.fn().mockResolvedValue(undefined),
  projects: [project()],
  sprints: [sprint()],
  features: [feature()],
  tasks: [task()],
  blockers: [blocker()],
  members: [member('m-1', 'Ada Lovelace'), member('m-2', 'Grace Hopper')],
  activities: [
    activity({
      id: 'a-task',
      action: 'task.created',
      details: { taskId: 't1', taskTitle: 'Wire the model endpoint' },
    }),
    activity({
      id: 'a-foreign',
      action: 'task.created',
      details: { taskId: 'zzz', taskTitle: 'Unrelated' },
    }),
  ],
});

describe('ProjectTimelinePage (P1-T2)', () => {
  const originalStore = useCollaborationStore.getState();

  beforeEach(() => {
    useCollaborationStore.setState(seededState());
  });

  afterEach(() => {
    useCollaborationStore.setState(originalStore);
  });

  it('renders a project-scoped timeline grouped from the feed and derived history', () => {
    const { container, root } = renderAt('/w/ws-1/projects/p1/timeline', <ProjectTimelinePage />);
    const text = container.textContent ?? '';
    expect(text).toContain('Project Timeline');
    expect(text).toContain('Task created');
    expect(text).toContain('Wire the model endpoint');
    expect(text).toContain('Blocker raised');
    expect(text).toContain('high: Model latency spikes');
    expect(text).toContain('Release shipped');
    expect(text).toContain('Beta release');
    expect(text).toContain('Ada Lovelace');
    expect(text).not.toContain('Unrelated');
    expect(container.querySelector('a[href="/w/ws-1/members/m-1"]')).toBeTruthy();
    expect(container.querySelector('a[aria-label="Jump to AI Copilot overview"]')).toBeTruthy();
    act(() => root.unmount());
  });

  it('filters the timeline via the entity search param', () => {
    const { container, root } = renderAt('/w/ws-1/projects/p1/timeline?entity=blocker', <ProjectTimelinePage />);
    const text = container.textContent ?? '';
    expect(text).toContain('Blocker raised');
    expect(text).not.toContain('Task created');
    expect(text).not.toContain('Release shipped');
    act(() => root.unmount());
  });

  it('switches the filter from the segmented control', () => {
    const { container, root } = renderAt('/w/ws-1/projects/p1/timeline', <ProjectTimelinePage />);
    expect(container.textContent).toContain('Task created');
    const button = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Blockers');
    expect(button).toBeTruthy();
    act(() => { button!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    const text = container.textContent ?? '';
    expect(text).toContain('Blocker raised');
    expect(text).not.toContain('Task created');
    expect(text).not.toContain('Release shipped');
    act(() => root.unmount());
  });

  it('shows a loading state while the feed loads with no data yet', () => {
    useCollaborationStore.setState({
      activityLoading: true,
      projects: [project({ milestones: [] })],
      tasks: [], features: [], sprints: [], blockers: [], activities: [],
    });
    const { container, root } = renderAt('/w/ws-1/projects/p1/timeline', <ProjectTimelinePage />);
    expect(container.textContent).toContain('Loading timeline');
    act(() => root.unmount());
  });

  it('shows an honest empty state when there is no timeline data', () => {
    useCollaborationStore.setState({
      activityLoading: false,
      projects: [project({ milestones: [] })],
      tasks: [], features: [], sprints: [], blockers: [], activities: [],
    });
    const { container, root } = renderAt('/w/ws-1/projects/p1/timeline', <ProjectTimelinePage />);
    expect(container.textContent).toContain('No timeline activity yet');
    act(() => root.unmount());
  });

  it('renders a not-found state for an unknown project id', () => {
    const { container, root } = renderAt('/w/ws-1/projects/nope/timeline', <ProjectTimelinePage />);
    expect(container.textContent).toContain('Project not found');
    act(() => root.unmount());
  });

  it('has no critical/serious axe violations on a populated page', async () => {
    const { container, root } = renderAt('/w/ws-1/projects/p1/timeline', <ProjectTimelinePage />);
    const violations = await scan(container);
    expect(violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`)).toEqual([]);
    act(() => root.unmount());
  });
});
