import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import axe from 'axe-core';
import { BacklogPage } from '../BacklogPage';
import { useCollaborationStore } from '../../../store/useCollaborationStore';
import type { Feature, Project, Sprint, WorkspaceMember } from '../../../types/collaboration';

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

const project = (id: string): Project => ({
  id, workspaceId: 'ws-1', name: `Project ${id}`, key: 'PRJ', description: '',
  members: [], teamIds: [], status: 'active', milestones: [], createdAt: '2026-01-01',
});

const sprint = (id: string): Sprint => ({
  id, workspaceId: 'ws-1', projectId: 'p1', name: `Sprint ${id}`,
  startDate: '2026-01-01', endDate: '2026-01-07', goal: '',
  status: 'active', capacityHours: 160, targetVelocity: 80,
});

const feature = (overrides: Partial<Feature>): Feature => ({
  id: 'f-1', projectId: 'p1', workspaceId: 'ws-1', name: 'Auth Gateway', description: '',
  type: 'feature', labels: [], ownerId: 'm-1', estimatedHours: 8, status: 'backlog',
  order: 0, createdAt: '2026-01-01', ...overrides,
});

const member = (id: string): WorkspaceMember => ({
  id, name: 'Ada', email: 'ada@focusflow.io', role: 'Developer',
  teams: [], status: 'available', joinedAt: '2026-01-01',
});

describe('BacklogPage (S4-T1)', () => {
  const originalStore = useCollaborationStore.getState();
  const moveFeatureSpy = vi.fn().mockResolvedValue(undefined);
  const createFeatureSpy = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    moveFeatureSpy.mockClear();
    createFeatureSpy.mockClear();
    useCollaborationStore.setState({
      activeWorkspaceId: 'ws-1',
      projects: [project('p1')],
      sprints: [sprint('s1')],
      members: [member('m-1')],
      features: [feature({}), feature({ id: 'f-2', name: 'Billing Webhooks', sprintId: 's1' })],
      moveFeature: moveFeatureSpy,
      createFeature: createFeatureSpy,
    });
  });

  afterEach(() => {
    useCollaborationStore.setState(originalStore);
  });

  it('renders the page header and the Project Backlog board', () => {
    const { container, root } = render(<BacklogPage />);
    const text = container.textContent ?? '';
    expect(text).toContain('Backlog');
    expect(text).toContain('Project Backlog');
    expect(text).toContain('Auth Gateway');
    act(() => root.unmount());
  });

  it('shows only sprint-less features on the backlog board', () => {
    const { container, root } = render(<BacklogPage />);
    const text = container.textContent ?? '';
    expect(text).toContain('Auth Gateway');
    expect(text).not.toContain('Billing Webhooks');
    act(() => root.unmount());
  });

  it('opens the Create Feature modal from the New Feature button', () => {
    const { container, root } = render(<BacklogPage />);
    const button = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('New Feature'));
    expect(button).toBeTruthy();
    act(() => { button!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(container.textContent).toContain('Create Feature');
    act(() => root.unmount());
  });

  it('renders an honest empty state when the backlog is empty', () => {
    useCollaborationStore.setState({ features: [feature({ sprintId: 's1' })] });
    const { container, root } = render(<BacklogPage />);
    expect(container.textContent).toContain('No features in the backlog');
    act(() => root.unmount());
  });

  it('has no critical/serious axe violations on a populated backlog', async () => {
    const { container, root } = render(<BacklogPage />);
    const violations = await scan(container);
    expect(violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`)).toEqual([]);
    act(() => root.unmount());
  });
});
