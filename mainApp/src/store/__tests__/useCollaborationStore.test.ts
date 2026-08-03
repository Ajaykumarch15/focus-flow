import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCollaborationStore } from '../useCollaborationStore';

// IES-P2-07: the store must be fully API-backed — no seed data. Loaders map
// server docs into client models; mutations are optimistic with rollback.
vi.mock('../../utils/api', () => ({
  api: {
    workspaces: {
      list: vi.fn(),
      members: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    teams: {
      list: vi.fn(),
      create: vi.fn(),
    },
    projects: {
      list: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { api } from '../../utils/api';

const mocks = {
  wsList: vi.mocked(api.workspaces.list),
  wsMembers: vi.mocked(api.workspaces.members),
  wsUpdate: vi.mocked(api.workspaces.update),
  wsCreate: vi.mocked(api.workspaces.create),
  teamList: vi.mocked(api.teams.list),
  projectList: vi.mocked(api.projects.list),
  projectCreate: vi.mocked(api.projects.create),
};

function reset() {
  useCollaborationStore.setState({
    workspaces: [],
    workspacesLoading: false,
    activeWorkspaceId: '',
    members: [],
    teams: [],
    projects: [],
    sprints: [],
    tasks: [],
    activities: [],
    discussions: [],
    notifications: [],
    docs: [],
    blockers: [],
    events: [],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  reset();
});

describe('useCollaborationStore loaders (IES-P2-07)', () => {
  it('starts empty — no seed workspaces', () => {
    expect(useCollaborationStore.getState().workspaces).toEqual([]);
    expect(useCollaborationStore.getState().members).toEqual([]);
    expect(useCollaborationStore.getState().teams).toEqual([]);
    expect(useCollaborationStore.getState().projects).toEqual([]);
    expect(useCollaborationStore.getState().activeWorkspaceId).toBe('');
  });

  it('loadWorkspaces maps server docs and activates the first workspace', async () => {
    mocks.wsList.mockResolvedValue([
      { id: 'ws-1', name: 'Acme', type: 'Startup', icon: '⚡', description: 'd', membersCount: 3, projectsCount: 2, createdAt: '2026-01-01T00:00:00.000Z', settings: { allowMemberInvites: true, requireReviewForDone: false, autoSyncTimerWorkLogs: true, defaultVisibility: 'Workspace' } },
    ] as any);

    await useCollaborationStore.getState().loadWorkspaces();

    const s = useCollaborationStore.getState();
    expect(s.workspaces).toHaveLength(1);
    expect(s.workspaces[0]).toMatchObject({ id: 'ws-1', name: 'Acme', membersCount: 3, projectsCount: 2 });
    expect(s.activeWorkspaceId).toBe('ws-1');
  });

  it('loadWorkspaces keeps an active workspace that still exists', async () => {
    useCollaborationStore.setState({ activeWorkspaceId: 'ws-2' });
    mocks.wsList.mockResolvedValue([
      { id: 'ws-2', name: 'B', type: 'Startup' },
      { id: 'ws-1', name: 'A', type: 'Startup' },
    ] as any);

    await useCollaborationStore.getState().loadWorkspaces();

    expect(useCollaborationStore.getState().activeWorkspaceId).toBe('ws-2');
  });

  it('loadMembers maps member docs', async () => {
    mocks.wsMembers.mockResolvedValue([
      { id: 'm1', name: 'Ajay', email: 'a@f.io', role: 'Owner', joinedAt: '2026-01-15T00:00:00.000Z' },
    ] as any);

    await useCollaborationStore.getState().loadMembers('ws-1');

    const m = useCollaborationStore.getState().members[0];
    expect(m).toMatchObject({ id: 'm1', name: 'Ajay', role: 'Owner', status: 'available' });
    expect(m.joinedAt).toBe('2026-01-15');
  });

  it('loadTeams only keeps teams of the active workspace', async () => {
    useCollaborationStore.setState({ activeWorkspaceId: 'ws-1' });
    mocks.teamList.mockResolvedValue([
      { _id: 't1', name: 'Frontend', description: 'd', workspaceRef: 'ws-1', members: [{ _id: 'm1' }], color: '#0ea5e9' },
      { _id: 't2', name: 'Other', description: 'd', workspaceRef: 'ws-2', members: [] },
    ] as any);

    await useCollaborationStore.getState().loadTeams();

    const teams = useCollaborationStore.getState().teams;
    expect(teams).toHaveLength(1);
    expect(teams[0].id).toBe('t1');
    expect(teams[0].memberIds).toEqual(['m1']);
  });

  it('loadProjects requests the active workspace and maps docs', async () => {
    useCollaborationStore.setState({ activeWorkspaceId: 'ws-1' });
    mocks.projectList.mockResolvedValue([
      { _id: 'p1', name: 'Core Web App', nameKey: 'core web app', workspaceRef: 'ws-1', createdAt: '2026-01-16T00:00:00.000Z' },
    ] as any);

    await useCollaborationStore.getState().loadProjects();

    expect(mocks.projectList).toHaveBeenCalledWith('ws-1');
    const p = useCollaborationStore.getState().projects[0];
    expect(p).toMatchObject({ id: 'p1', workspaceId: 'ws-1', name: 'Core Web App', key: 'CORE WEB APP' });
  });

  it('loadCollabData loads the whole workspace graph', async () => {
    useCollaborationStore.setState({ activeWorkspaceId: 'ws-1' });
    mocks.wsList.mockResolvedValue([{ id: 'ws-1', name: 'A' }] as any);
    mocks.wsMembers.mockResolvedValue([] as any);
    mocks.teamList.mockResolvedValue([] as any);
    mocks.projectList.mockResolvedValue([] as any);

    await useCollaborationStore.getState().loadCollabData();

    expect(mocks.wsList).toHaveBeenCalled();
    expect(mocks.wsMembers).toHaveBeenCalledWith('ws-1');
    expect(mocks.teamList).toHaveBeenCalled();
    expect(mocks.projectList).toHaveBeenCalledWith('ws-1');
  });
});

describe('useCollaborationStore optimistic mutations (IES-P2-07)', () => {
  it('createWorkspace optimistically adds, then replaces with the server doc', async () => {
    mocks.wsCreate.mockResolvedValue({
      id: 'ws-real', name: 'Acme', type: 'Startup', icon: '⚡', description: 'desc',
      membersCount: 1, projectsCount: 0, createdAt: '2026-01-01T00:00:00.000Z', settings: {},
    } as any);

    const promise = useCollaborationStore.getState().createWorkspace('Acme', 'Startup', 'desc');
    expect(useCollaborationStore.getState().workspaces.some((w) => w.id.startsWith('ws-tmp'))).toBe(true);

    const created = await promise;
    expect(created?.id).toBe('ws-real');
    expect(useCollaborationStore.getState().workspaces[0].id).toBe('ws-real');
    expect(useCollaborationStore.getState().activeWorkspaceId).toBe('ws-real');
  });

  it('createWorkspace rolls back and returns undefined on failure', async () => {
    mocks.wsCreate.mockRejectedValue(new Error('boom'));

    const created = await useCollaborationStore.getState().createWorkspace('Acme', 'Startup', 'desc');

    expect(created).toBeUndefined();
    expect(useCollaborationStore.getState().workspaces).toHaveLength(0);
    expect(useCollaborationStore.getState().activeWorkspaceId).toBe('');
  });

  it('createProject optimistically adds, then replaces with the server doc', async () => {
    useCollaborationStore.setState({ activeWorkspaceId: 'ws-1' });
    mocks.projectCreate.mockResolvedValue({
      _id: 'p-real', name: 'Agent Service', nameKey: 'agent service', workspaceRef: 'ws-1', createdAt: '2026-02-10T00:00:00.000Z',
    } as any);

    const promise = useCollaborationStore.getState().createProject({ name: 'Agent Service' });
    expect(useCollaborationStore.getState().projects.some((p) => p.id.startsWith('proj-'))).toBe(true);

    const created = await promise;
    expect(created?.id).toBe('p-real');
    expect(useCollaborationStore.getState().projects[0].id).toBe('p-real');
  });

  it('createProject rolls back on failure', async () => {
    useCollaborationStore.setState({ activeWorkspaceId: 'ws-1' });
    mocks.projectCreate.mockRejectedValue(new Error('boom'));

    const created = await useCollaborationStore.getState().createProject({ name: 'Agent Service' });

    expect(created).toBeUndefined();
    expect(useCollaborationStore.getState().projects).toHaveLength(0);
  });

  it('updateWorkspaceSettings optimistically applies and rolls back on failure', async () => {
    useCollaborationStore.setState({
      activeWorkspaceId: 'ws-1',
      workspaces: [{
        id: 'ws-1', name: 'A', type: 'Startup', icon: '⚡', description: '', membersCount: 1, projectsCount: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        settings: { allowMemberInvites: true, requireReviewForDone: false, autoSyncTimerWorkLogs: true, defaultVisibility: 'Workspace' },
      }],
    });
    mocks.wsUpdate.mockRejectedValue(new Error('boom'));

    await useCollaborationStore.getState().updateWorkspaceSettings('ws-1', { requireReviewForDone: true });

    expect(useCollaborationStore.getState().workspaces[0].settings.requireReviewForDone).toBe(false);
  });
});
