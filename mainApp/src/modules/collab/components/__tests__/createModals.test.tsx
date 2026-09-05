import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { CreateSprintModal } from '../CreateSprintModal';
import { CreateTaskModal } from '../CreateTaskModal';
import { CreateFeatureModal } from '../CreateFeatureModal';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { useAuthStore } from '@shared/services/useAuthStore';
import type { Project, Sprint, Feature, WorkspaceMember } from '@collab/types/collaboration';

// IES-R1 (P6-T4): modal forms persist real members — never the removed 'm1'.

function render(node: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(node); });
  return { container, root };
}

function setValue(container: HTMLElement, name: string, value: string) {
  const el = container.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`);
  if (!el) throw new Error(`No [name="${name}"]`);
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}

async function submitForm(container: HTMLElement) {
  const form = container.querySelector('form');
  if (!form) throw new Error('No form');
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}

const project = (id: string): Project => ({
  id, workspaceId: 'ws-1', name: `Project ${id}`, key: 'PRJ', description: '',
  members: [], teamIds: [], status: 'active', milestones: [], createdAt: '2026-01-01',
});

const sprint = (id: string): Sprint => ({
  id, workspaceId: 'ws-1', projectId: 'p1', name: `Sprint ${id}`,
  startDate: '2026-01-01', endDate: '2026-01-07', goal: '',
  status: 'draft', capacityHours: 160, targetVelocity: 80,
});

const feature = (id: string): Feature => ({
  id, projectId: 'p1', workspaceId: 'ws-1', name: `Feature ${id}`, description: '',
  type: 'feature', labels: [], ownerId: 'm-1', estimatedHours: 8, status: 'backlog',
  order: 0, createdAt: '2026-01-01',
});

const member = (id: string, name: string): WorkspaceMember => ({
  id, name, email: `${name}@focusflow.io`, role: 'Developer',
  teams: [], status: 'available', joinedAt: '2026-01-01',
});

describe('CreateSprintModal (R1-P6-T4)', () => {
  const originalStore = useCollaborationStore.getState();
  const createSprintSpy = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();

  beforeEach(() => {
    createSprintSpy.mockClear();
    onClose.mockClear();
    useCollaborationStore.setState({
      activeWorkspaceId: 'ws-1',
      projects: [project('p1')],
      createSprint: createSprintSpy,
    });
  });

  afterEach(() => {
    useCollaborationStore.setState(originalStore);
  });

  it('persists the project, name, capacity and target velocity', async () => {
    const { container } = render(<CreateSprintModal isOpen onClose={onClose} />);

    setValue(container, 'projectId', 'p1');
    setValue(container, 'name', 'Sprint 24 — AI Copilot');
    setValue(container, 'capacityHours', '200');
    setValue(container, 'targetVelocity', '90');
    await submitForm(container);

    expect(createSprintSpy).toHaveBeenCalledWith(
      'p1', 'Sprint 24 — AI Copilot',
      expect.any(String), expect.any(String), '',
      { capacityHours: 200, targetVelocity: 90 },
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('does not submit when the sprint name is empty', async () => {
    const { container } = render(<CreateSprintModal isOpen onClose={onClose} />);
    await submitForm(container);
    expect(createSprintSpy).not.toHaveBeenCalled();
  });
});

describe('CreateTaskModal (R1-P6-T4)', () => {
  const originalStore = useCollaborationStore.getState();
  const originalAuth = useAuthStore.getState();
  const createTaskSpy = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();

  beforeEach(() => {
    createTaskSpy.mockClear();
    onClose.mockClear();
    useAuthStore.setState({ user: { _id: 'u-1', name: 'Ajay Kumar', email: 'ajay@focusflow.io', role: 'user', settings: {} } });
    useCollaborationStore.setState({
      activeWorkspaceId: 'ws-1',
      projects: [project('p1')],
      sprints: [sprint('s1')],
      features: [feature('f1')],
      members: [member('m-2', 'Sara Lee'), member('m-3', 'Dev Rao'), member('u-1', 'Ajay Kumar')],
      createTask: createTaskSpy,
    });
  });

  afterEach(() => {
    useCollaborationStore.setState(originalStore);
    useAuthStore.setState(originalAuth);
  });

  it('persists a real assignee/reviewer and links the feature (no m1)', async () => {
    const { container } = render(<CreateTaskModal isOpen onClose={onClose} />);

    setValue(container, 'title', 'Implement OAuth refresh flow');
    setValue(container, 'projectId', 'p1');
    setValue(container, 'sprintId', 's1');
    setValue(container, 'featureId', 'f1');
    setValue(container, 'assigneeId', 'm-2');
    setValue(container, 'reviewerId', 'm-3');
    await submitForm(container);

    expect(createTaskSpy).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Implement OAuth refresh flow',
      projectId: 'p1',
      sprintId: 's1',
      featureId: 'f1',
      assigneeId: 'm-2',
      reviewerId: 'm-3',
      sprintStatus: 'backlog',
      priority: 'medium',
    }));
    expect(onClose).toHaveBeenCalled();
  });

  it('defaults the assignee to the authenticated user, not a mock id', () => {
    const { container } = render(<CreateTaskModal isOpen onClose={onClose} />);
    const assignee = container.querySelector<HTMLSelectElement>('[name="assigneeId"]');
    expect(assignee?.value).toBe('u-1');
  });

  it('does not render any leftover m1 mock owner', () => {
    const { container } = render(<CreateTaskModal isOpen onClose={onClose} />);
    expect(container.textContent).not.toContain('m1');
  });

  it('does not submit without a title', async () => {
    const { container } = render(<CreateTaskModal isOpen onClose={onClose} />);
    setValue(container, 'projectId', 'p1');
    await submitForm(container);
    expect(createTaskSpy).not.toHaveBeenCalled();
  });
});

describe('CreateFeatureModal (R1-P6-T5/UX)', () => {
  const originalStore = useCollaborationStore.getState();
  const originalAuth = useAuthStore.getState();
  const createFeatureSpy = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();

  beforeEach(() => {
    createFeatureSpy.mockClear();
    onClose.mockClear();
    useAuthStore.setState({ user: { _id: 'u-1', name: 'Ajay Kumar', email: 'ajay@focusflow.io', role: 'user', settings: {} } });
    useCollaborationStore.setState({
      activeWorkspaceId: 'ws-1',
      projects: [project('p1')],
      members: [member('m-2', 'Sara Lee')],
      createFeature: createFeatureSpy,
    });
  });

  afterEach(() => {
    useCollaborationStore.setState(originalStore);
    useAuthStore.setState(originalAuth);
  });

  it('creates a backlog feature with a real member owner (no m1)', async () => {
    const { container } = render(<CreateFeatureModal isOpen onClose={onClose} />);

    setValue(container, 'projectId', 'p1');
    setValue(container, 'name', 'AI Copilot autocomplete');
    setValue(container, 'type', 'bug');
    setValue(container, 'ownerId', 'm-2');
    setValue(container, 'estimatedHours', '16');
    await submitForm(container);

    expect(createFeatureSpy).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'p1',
      name: 'AI Copilot autocomplete',
      type: 'bug',
      ownerId: 'm-2',
      estimatedHours: 16,
    }));
    expect(onClose).toHaveBeenCalled();
  });

  it('does not submit without a feature name', async () => {
    const { container } = render(<CreateFeatureModal isOpen onClose={onClose} />);
    setValue(container, 'projectId', 'p1');
    await submitForm(container);
    expect(createFeatureSpy).not.toHaveBeenCalled();
  });
});
