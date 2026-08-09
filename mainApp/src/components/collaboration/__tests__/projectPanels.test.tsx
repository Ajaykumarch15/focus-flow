import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { ProjectInfoForm } from '../ProjectInfoForm';
import { ProjectSettingsPanel } from '../ProjectSettingsPanel';
import { ProjectMembersPanel } from '../ProjectMembersPanel';
import { useCollaborationStore } from '../../../store/useCollaborationStore';
import type { Project, WorkspaceMember, WorkspaceTeam } from '../../../types/collaboration';

// EEP2-P2.2.3 · Project Info panels. Save path goes through
// `updateProjectMeta` → `api.projects.update` (optimistic + rollback).
vi.mock('../../../utils/api', () => ({
  api: {
    projects: { update: vi.fn() },
  },
}));

import { api } from '../../../utils/api';

const projectUpdate = vi.mocked(api.projects.update);

const project: Project = {
  id: 'p1',
  workspaceId: 'ws-1',
  name: 'AI Copilot',
  key: 'FF',
  description: 'Build the copilot',
  members: ['m-1'],
  teamIds: ['t-1'],
  status: 'active',
  milestones: [],
  settings: { allowMemberInvites: true, requireReviewForDone: false, autoSyncTimerWorkLogs: true, defaultVisibility: 'Workspace' },
  createdAt: '2026-01-01',
};

const member: WorkspaceMember = {
  id: 'm-1', name: 'Ada Lovelace', email: 'ada@focusflow.io', role: 'Developer',
  teams: [], status: 'available', joinedAt: '2026-01-01',
};

const team: WorkspaceTeam = {
  id: 't-1', name: 'AI', description: '', memberIds: ['m-1'], color: '#8b5cf6',
};

function render(node: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(node); });
  return { container, root };
}

const originalStore = useCollaborationStore.getState();

beforeEach(() => {
  vi.clearAllMocks();
  useCollaborationStore.setState({
    activeWorkspaceId: 'ws-1',
    projects: [{ ...project }],
    members: [member],
    teams: [team],
  });
});

afterEach(() => {
  useCollaborationStore.setState(originalStore);
});

describe('ProjectInfoForm (EEP2-P2.2.3)', () => {
  it('renders the current description, key and status', () => {
    const { container, root } = render(<ProjectInfoForm projectId="p1" />);
    const text = container.textContent ?? '';
    expect(text).toContain('Project Information');
    expect(text).toContain('Build the copilot');
    expect((container.querySelector('#project-key') as HTMLInputElement).value).toBe('FF');
    expect((container.querySelector('#project-status') as HTMLSelectElement).value).toBe('active');
    act(() => root.unmount());
  });

  it('saves changed meta via updateProjectMeta', () => {
    projectUpdate.mockResolvedValue({} as any);
    const { container, root } = render(<ProjectInfoForm projectId="p1" />);

    const description = container.querySelector('#project-description') as HTMLTextAreaElement;
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    act(() => {
      nativeSetter!.call(description, 'Ship the copilot v2');
      description.dispatchEvent(new Event('input', { bubbles: true }));
    });

    act(() => {
      container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(projectUpdate).toHaveBeenCalledWith('p1', { description: 'Ship the copilot v2' });
    expect(useCollaborationStore.getState().projects[0].description).toBe('Ship the copilot v2');
    act(() => root.unmount());
  });

  it('does not call the API when nothing changed', () => {
    const { container, root } = render(<ProjectInfoForm projectId="p1" />);
    act(() => {
      container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(projectUpdate).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it('disables the form when the caller cannot edit', () => {
    const { container, root } = render(<ProjectInfoForm projectId="p1" canEdit={false} />);
    expect((container.querySelector('#project-description') as HTMLTextAreaElement).disabled).toBe(true);
    expect((container.querySelector('#project-key') as HTMLInputElement).disabled).toBe(true);
    expect((container.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
    act(() => root.unmount());
  });
});

describe('ProjectSettingsPanel (EEP2-P2.2.3)', () => {
  it('renders the project settings toggles and visibility', () => {
    const { container, root } = render(<ProjectSettingsPanel projectId="p1" />);
    const text = container.textContent ?? '';
    expect(text).toContain('Project Settings');
    expect(text).toContain('Allow Member Invitations');
    expect((container.querySelector('#project-visibility') as HTMLSelectElement).value).toBe('Workspace');
    act(() => root.unmount());
  });

  it('saves a changed visibility as a settings patch', () => {
    projectUpdate.mockResolvedValue({} as any);
    const { container, root } = render(<ProjectSettingsPanel projectId="p1" />);

    const visibility = container.querySelector('#project-visibility') as HTMLSelectElement;
    act(() => {
      visibility.value = 'Private';
      visibility.dispatchEvent(new Event('change', { bubbles: true }));
    });
    act(() => {
      container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(projectUpdate).toHaveBeenCalledWith('p1', { settings: expect.objectContaining({ defaultVisibility: 'Private' }) });
    act(() => root.unmount());
  });

  it('disables the controls when the caller cannot manage', () => {
    const { container, root } = render(<ProjectSettingsPanel projectId="p1" canManage={false} />);
    expect((container.querySelector('#project-visibility') as HTMLSelectElement).disabled).toBe(true);
    expect((container.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBe(true);
    act(() => root.unmount());
  });
});

describe('ProjectMembersPanel (EEP2-P2.2.3)', () => {
  it('lists workspace members and teams with current assignments selected', () => {
    const { container, root } = render(<ProjectMembersPanel projectId="p1" />);
    const text = container.textContent ?? '';
    expect(text).toContain('Project Members & Teams');
    expect(text).toContain('Ada Lovelace');
    expect(text).toContain('AI');
    act(() => root.unmount());
  });

  it('adds a member and saves the members patch', () => {
    useCollaborationStore.setState({
      members: [
        member,
        { ...member, id: 'm-2', name: 'Grace Hopper' },
      ],
    });
    const { container, root } = render(<ProjectMembersPanel projectId="p1" />);

    const chips = Array.from(container.querySelectorAll('button'));
    const graceChip = chips.find((b) => b.textContent?.includes('Grace Hopper'));
    expect(graceChip).toBeTruthy();

    act(() => { graceChip!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    const saveButton = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Save Members'));
    expect(saveButton).toBeTruthy();
    act(() => { saveButton!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    expect(projectUpdate).toHaveBeenCalledWith('p1', { members: ['m-1', 'm-2'] });
    act(() => root.unmount());
  });

  it('disables member chips when the caller cannot manage', () => {
    const { container, root } = render(<ProjectMembersPanel projectId="p1" canManage={false} />);
    const chips = Array.from(container.querySelectorAll('button'));
    expect(chips.find((b) => b.textContent?.includes('Ada Lovelace'))?.hasAttribute('disabled')).toBe(true);
    act(() => root.unmount());
  });
});
