import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import axe from 'axe-core';
import { ProjectOverviewPage } from '../ProjectOverviewPage';
import { useCollaborationStore } from '../../../store/useCollaborationStore';
import type {
  CentralBlocker,
  CollaborativeTask,
  Feature,
  Project,
  Sprint,
  WorkspaceMember,
  WorkspaceTeam,
} from '../../../types/collaboration';

function renderAt(path: string, node: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/w/:workspaceId/projects/:projectId" element={node} />
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
  description: 'Engineering overview target',
  members: ['m-1'],
  teamIds: ['t-1'],
  status: 'active',
  milestones: [
    { id: 'ms-1', title: 'Beta release', dueDate: '2026-03-20', status: 'completed', targetPoints: 40 },
    { id: 'ms-2', title: 'General availability', dueDate: '2026-06-01', status: 'planning', targetPoints: 80 },
  ],
  createdAt: '2026-01-01',
  ...overrides,
});

const sprint = (overrides: Partial<Sprint> = {}): Sprint => ({
  id: 's1',
  workspaceId: 'ws-1',
  projectId: 'p1',
  name: 'Sprint 12 — Ship Copilot',
  startDate: '2026-03-01',
  endDate: '2026-03-14',
  goal: 'Ship the assistant to production',
  status: 'active',
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
  estimatedHours: 16,
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

const member = (overrides: Partial<WorkspaceMember> = {}): WorkspaceMember => ({
  id: 'm-1',
  name: 'Ada Lovelace',
  email: 'ada@focusflow.io',
  role: 'Developer',
  teams: [],
  status: 'available',
  joinedAt: '2026-01-01',
  ...overrides,
});

const team = (overrides: Partial<WorkspaceTeam> = {}): WorkspaceTeam => ({
  id: 't-1',
  name: 'AI',
  description: '',
  memberIds: ['m-1'],
  color: '#8b5cf6',
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
  impactDescription: 'Blocks code review',
  createdAt: '2026-03-08',
  ...overrides,
});

describe('ProjectOverviewPage (P1-T1)', () => {
  const originalStore = useCollaborationStore.getState();

  beforeEach(() => {
    useCollaborationStore.setState({
      activeWorkspaceId: 'ws-1',
      projects: [project()],
      sprints: [sprint()],
      features: [feature(), feature({ id: 'f2', name: 'Not active', status: 'backlog' })],
      tasks: [
        task(),
        task({ id: 't2', title: 'Review PR', sprintStatus: 'review', updatedAt: '2026-03-11' }),
        task({ id: 't3', title: 'Shipped validation', sprintStatus: 'done', updatedAt: '2026-03-12' }),
      ],
      members: [member()],
      teams: [team()],
      blockers: [blocker()],
    });
  });

  afterEach(() => {
    useCollaborationStore.setState(originalStore);
  });

  it('renders the living project overview from live store data', () => {
    const { container, root } = renderAt('/w/ws-1/projects/p1', <ProjectOverviewPage />);
    const text = container.textContent ?? '';
    expect(text).toContain('AI Copilot');
    expect(text).toContain('View Timeline');
    expect(text).toContain('Current Sprint');
    expect(text).toContain('Sprint 12 — Ship Copilot');
    expect(text).toContain('Inline completions');
    expect(text).not.toContain('Not active');
    expect(text).toContain('Team Progress');
    expect(text).toContain('Ada Lovelace');
    expect(text).toContain('AI team');
    expect(text).toContain('Recent Work');
    expect(text).toContain('Wire the model endpoint');
    expect(text).toContain('Model latency spikes');
    expect(text).toContain('Releases & Milestones');
    expect(text).toContain('Beta release');
    expect(text).toContain('Released');
    expect(text).toContain('General availability');
    expect(text).toContain('Sprint Velocity');
    expect(text).toContain('Feature Completion');
    expect(text).toContain('Open Blockers');
    expect(text).toContain('Pending Reviews');
    act(() => root.unmount());
  });

  it('shows honest empty states when a project has no sprint, features, or blockers', () => {
    useCollaborationStore.setState({
      projects: [project({ milestones: [] })],
      sprints: [],
      features: [],
      tasks: [],
      blockers: [],
    });
    const { container, root } = renderAt('/w/ws-1/projects/p1', <ProjectOverviewPage />);
    const text = container.textContent ?? '';
    expect(text).toContain('No sprint is active for this project yet.');
    expect(text).toContain('No features are being worked on right now.');
    expect(text).toContain('No recent work yet.');
    expect(text).toContain('No blockers raised for this project.');
    expect(text).toContain('No milestones scheduled yet.');
    act(() => root.unmount());
  });

  it('renders a not-found state for an unknown project id', () => {
    const { container, root } = renderAt('/w/ws-1/projects/nope', <ProjectOverviewPage />);
    const text = container.textContent ?? '';
    expect(text).toContain('Project not found');
    act(() => root.unmount());
  });

  it('has no critical/serious axe violations on a populated page', async () => {
    const { container, root } = renderAt('/w/ws-1/projects/p1', <ProjectOverviewPage />);
    const violations = await scan(container);
    expect(violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`)).toEqual([]);
    act(() => root.unmount());
  });
});
