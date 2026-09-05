import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import axe from 'axe-core';
import { SprintPlanningPage } from '../SprintPlanningPage';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import type { Sprint, Feature, CollaborativeTask, Project } from '@collab/types/collaboration';

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

function setValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  act(() => {
    const proto = el instanceof HTMLTextAreaElement
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    setter?.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const project = (): Project => ({
  id: 'p1', workspaceId: 'ws-1', name: 'Core Web App', key: 'CWA', description: '',
  members: [], teamIds: [], status: 'active', milestones: [], createdAt: '2026-01-01',
});

const sprint = (overrides: Partial<Sprint>): Sprint => ({
  id: 's1', workspaceId: 'ws-1', projectId: 'p1', name: 'Sprint 1',
  startDate: '2026-01-01', endDate: '2026-01-07', goal: 'Ship the alpha',
  status: 'draft', capacityHours: 160, targetVelocity: 80,
  ...overrides,
});

const feature = (overrides: Partial<Feature>): Feature => ({
  id: 'f1', projectId: 'p1', workspaceId: 'ws-1', name: 'Auth',
  description: '', type: 'feature', labels: [], ownerId: 'm1',
  estimatedHours: 8, status: 'backlog', order: 0, createdAt: '2026-01-01',
  ...overrides,
});

const task = (overrides: Partial<CollaborativeTask>): CollaborativeTask => ({
  id: 't1', workspaceId: 'ws-1', projectId: 'p1', title: 'Wire API',
  description: '', sprintStatus: 'backlog', priority: 'high', ownerId: 'm1',
  followerIds: [], labels: [], dependencies: [], estimatedHours: 4, actualHours: 0,
  subtasks: [], createdAt: '2026-01-01', updatedAt: '2026-01-01',
  ...overrides,
});

describe('SprintPlanningPage (EEP2-P4.3.2)', () => {
  const originalStore = useCollaborationStore.getState();
  const updateSprintSpy = vi.fn().mockResolvedValue(undefined);
  const commitSprintSpy = vi.fn().mockResolvedValue(undefined);
  const moveFeatureSpy = vi.fn().mockResolvedValue(undefined);
  const advanceSprintStateSpy = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    useCollaborationStore.setState({
      activeWorkspaceId: 'ws-1',
      projects: [project()],
      sprints: [sprint({ id: 's-draft', status: 'draft' })],
      features: [],
      tasks: [],
      updateSprint: updateSprintSpy,
      commitSprint: commitSprintSpy,
      moveFeature: moveFeatureSpy,
      advanceSprintState: advanceSprintStateSpy,
    });
  });

  afterEach(() => {
    useCollaborationStore.setState(originalStore);
  });

  it('shows an honest empty state when the workspace has no sprints', () => {
    useCollaborationStore.setState({ sprints: [], features: [], tasks: [] });
    const { container, root } = render(<SprintPlanningPage />);
    const text = container.textContent ?? '';
    expect(text).toContain('No sprints in this workspace yet');
    expect(text).toContain('New Sprint');
    act(() => root.unmount());
  });

  it('renders the lifecycle stepper with all four sprint states', () => {
    useCollaborationStore.setState({
      sprints: [
        sprint({ id: 's1', status: 'draft' }),
        sprint({ id: 's2', status: 'planned' }),
        sprint({ id: 's3', status: 'active' }),
        sprint({ id: 's4', status: 'completed' }),
      ],
    });
    const { container, root } = render(<SprintPlanningPage />);
    const text = container.textContent ?? '';
    expect(text).toContain('draft');
    expect(text).toContain('planned');
    expect(text).toContain('active');
    expect(text).toContain('completed');
    act(() => root.unmount());
  });

  it('defaults to the active sprint and pre-fills goal/capacity', () => {
    useCollaborationStore.setState({
      sprints: [
        sprint({ id: 's-draft', status: 'draft' }),
        sprint({ id: 's-active', status: 'active', goal: 'Ship alpha', capacityHours: 120, targetVelocity: 60 }),
      ],
    });
    const { container, root } = render(<SprintPlanningPage />);
    const picker = container.querySelector<HTMLSelectElement>('#sprint-picker');
    expect(picker?.value).toBe('s-active');
    const goal = container.querySelector<HTMLTextAreaElement>('#plan-goal');
    expect(goal?.value).toBe('Ship alpha');
    const capacity = container.querySelector<HTMLInputElement>('#plan-capacity');
    expect(capacity?.value).toBe('120');
    act(() => root.unmount());
  });

  it('saves only the changed form fields via updateSprint', () => {
    useCollaborationStore.setState({
      sprints: [sprint({ id: 's-draft', status: 'draft', goal: 'Old goal', capacityHours: 160, targetVelocity: 80 })],
    });
    const { container, root } = render(<SprintPlanningPage />);
    const goal = container.querySelector<HTMLTextAreaElement>('#plan-goal');
    expect(goal).toBeTruthy();
    setValue(goal!, 'New goal');

    const save = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Save plan'));
    expect(save?.disabled).toBe(false);
    act(() => save!.click());

    expect(updateSprintSpy).toHaveBeenCalledWith('s-draft', { goal: 'New goal' });
    expect(updateSprintSpy).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ capacityHours: expect.anything() }));
    act(() => root.unmount());
  });

  it('renders the capacity bar, remaining hours, and completed-only velocity', () => {
    useCollaborationStore.setState({
      sprints: [sprint({ id: 's-active', status: 'active', capacityHours: 100 })],
      features: [
        feature({ id: 'f-plan1', sprintId: 's-active', estimatedHours: 40 }),
        feature({ id: 'f-plan2', sprintId: 's-active', estimatedHours: 20 }),
      ],
      tasks: [
        task({ id: 't-done', sprintId: 's-active', sprintStatus: 'done', estimatedHours: 10 }),
        task({ id: 't-review', sprintId: 's-active', sprintStatus: 'review', estimatedHours: 5 }),
      ],
    });
    const { container, root } = render(<SprintPlanningPage />);
    const text = container.textContent ?? '';
    expect(text).toContain('75h / 100h');
    expect(text).toContain('25h remaining');
    expect(text).toContain('10h'); // velocity = done task only
    const bar = container.querySelector<HTMLDivElement>('[data-testid="capacity-bar"]');
    expect(bar?.style.width).toBe('75%');
    act(() => root.unmount());
  });

  it('plans and unplans features through the backlog builder', () => {
    useCollaborationStore.setState({
      sprints: [sprint({ id: 's-draft', status: 'draft' })],
      features: [
        feature({ id: 'f-planned', sprintId: 's-draft', name: 'In sprint' }),
        feature({ id: 'f-backlog', name: 'In backlog' }),
      ],
    });
    const { container, root } = render(<SprintPlanningPage />);
    const text = container.textContent ?? '';
    expect(text).toContain('In sprint');
    expect(text).toContain('In backlog');

    const planBtn = container.querySelector<HTMLButtonElement>('[aria-label="Plan In backlog"]');
    expect(planBtn).toBeTruthy();
    act(() => planBtn!.click());
    expect(moveFeatureSpy).toHaveBeenCalledWith('f-backlog', 's-draft');

    const unplanBtn = container.querySelector<HTMLButtonElement>('[aria-label="Unassign In sprint"]');
    expect(unplanBtn).toBeTruthy();
    act(() => unplanBtn!.click());
    expect(moveFeatureSpy).toHaveBeenCalledWith('f-planned', null);
    act(() => root.unmount());
  });

  it('commits the sprint and freezes the form once committed', () => {
    useCollaborationStore.setState({
      sprints: [sprint({ id: 's-draft', status: 'draft' })],
    });
    const { container, root } = render(<SprintPlanningPage />);
    const commitBtn = [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Commit');
    expect(commitBtn).toBeTruthy();
    act(() => commitBtn!.click());
    expect(commitSprintSpy).toHaveBeenCalledWith('s-draft');
    act(() => root.unmount());
  });

  it('disables the plan form and builder once committed (scope frozen)', () => {
    useCollaborationStore.setState({
      sprints: [sprint({ id: 's-committed', status: 'planned', committed: true, commitmentDate: '2026-01-01T00:00:00.000Z' })],
      features: [feature({ id: 'f-backlog', name: 'Backlog item' })],
    });
    const { container, root } = render(<SprintPlanningPage />);
    const text = container.textContent ?? '';
    expect(text).toContain('Committed');
    expect((container.querySelector<HTMLTextAreaElement>('#plan-goal'))?.disabled).toBe(true);
    expect((container.querySelector<HTMLInputElement>('#plan-capacity'))?.disabled).toBe(true);
    const save = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Save plan'));
    expect(save?.disabled).toBe(true);
    const planBtn = container.querySelector<HTMLButtonElement>('[aria-label="Plan Backlog item"]');
    expect(planBtn?.disabled).toBe(true);
    act(() => root.unmount());
  });

  it('shows honest empty builder states when there is nothing to plan', () => {
    useCollaborationStore.setState({
      sprints: [sprint({ id: 's-draft', status: 'draft' })],
      features: [],
      tasks: [],
    });
    const { container, root } = render(<SprintPlanningPage />);
    const text = container.textContent ?? '';
    expect(text).toContain('Nothing planned yet');
    expect(text).toContain('Every feature is planned or this project has no backlog yet.');
    act(() => root.unmount());
  });

  it('has no critical/serious axe violations on a populated planning page', async () => {
    useCollaborationStore.setState({
      sprints: [sprint({ id: 's-active', status: 'active', capacityHours: 100 })],
      features: [
        feature({ id: 'f-plan1', sprintId: 's-active', estimatedHours: 40 }),
        feature({ id: 'f-backlog', estimatedHours: 20 }),
      ],
      tasks: [task({ id: 't-done', sprintId: 's-active', sprintStatus: 'done', estimatedHours: 10 })],
    });
    const { container, root } = render(<SprintPlanningPage />);
    const violations = await scan(container);
    expect(violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`)).toEqual([]);
    act(() => root.unmount());
  });
});
