import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCollaborationStore } from '../useCollaborationStore';
import { useAuthStore } from '../useAuthStore';
import type { Feature } from '../../types/collaboration';

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
      get: vi.fn(),
      update: vi.fn(),
    },
    sprints: {
      list: vi.fn(),
      create: vi.fn(),
    },
    features: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    tasks: {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      patchGit: vi.fn(),
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
  projectGet: vi.mocked(api.projects.get),
  projectUpdate: vi.mocked(api.projects.update),
  sprintList: vi.mocked(api.sprints.list),
  sprintCreate: vi.mocked(api.sprints.create),
  featureList: vi.mocked(api.features.list),
  featureCreate: vi.mocked(api.features.create),
  featureUpdate: vi.mocked(api.features.update),
  taskList: vi.mocked(api.tasks.list),
  taskCreate: vi.mocked(api.tasks.create),
  taskUpdate: vi.mocked(api.tasks.update),
  taskPatchGit: vi.mocked(api.tasks.patchGit),
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
    features: [],
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
  useAuthStore.setState({ user: null });
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
    mocks.sprintList.mockResolvedValue([] as any);
    mocks.featureList.mockResolvedValue([] as any);
    mocks.taskList.mockResolvedValue([] as any);

    await useCollaborationStore.getState().loadCollabData();

    expect(mocks.wsList).toHaveBeenCalled();
    expect(mocks.wsMembers).toHaveBeenCalledWith('ws-1');
    expect(mocks.teamList).toHaveBeenCalled();
    expect(mocks.projectList).toHaveBeenCalledWith('ws-1');
    expect(mocks.taskList).toHaveBeenCalledWith({ workspaceId: 'ws-1' });
  });

  // IES-R1 (P5-T1/T2): domain loaders populate sprints/features/tasks.
  const project = { id: 'p1', workspaceId: 'ws-1', name: 'Core', key: 'CORE' } as any;

  it('loadSprints fetches sprints for every workspace project and maps docs', async () => {
    useCollaborationStore.setState({ activeWorkspaceId: 'ws-1', projects: [project] });
    mocks.sprintList.mockResolvedValue([
      { _id: 's1', name: 'Sprint 1', projectRef: 'p1', workspaceRef: 'ws-1', goal: 'g', startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-01-07T00:00:00.000Z', status: 'active', capacityHours: 160, targetVelocity: 80 },
    ] as any);

    await useCollaborationStore.getState().loadSprints();

    expect(mocks.sprintList).toHaveBeenCalledWith('p1');
    const s = useCollaborationStore.getState().sprints[0];
    expect(s).toMatchObject({ id: 's1', projectId: 'p1', workspaceId: 'ws-1', name: 'Sprint 1', status: 'active', capacityHours: 160, targetVelocity: 80 });
    expect(s.startDate).toBe('2026-01-01');
  });

  it('loadFeatures maps docs; backlog features keep sprintId undefined', async () => {
    useCollaborationStore.setState({ activeWorkspaceId: 'ws-1', projects: [project] });
    mocks.featureList.mockResolvedValue([
      { _id: 'f1', name: 'Auth', projectRef: 'p1', workspaceRef: 'ws-1', type: 'feature', status: 'backlog', estimatedHours: 8, order: 1, labels: [], createdAt: '2026-02-01T00:00:00.000Z' },
    ] as any);

    await useCollaborationStore.getState().loadFeatures();

    expect(mocks.featureList).toHaveBeenCalledWith({ projectId: 'p1' });
    const f = useCollaborationStore.getState().features[0];
    expect(f).toMatchObject({ id: 'f1', projectId: 'p1', workspaceId: 'ws-1', name: 'Auth', type: 'feature', status: 'backlog', estimatedHours: 8, order: 1 });
    expect(f.sprintId).toBeUndefined();
  });

  it('loadTasks fetches workspace-scoped tasks and maps collab refs', async () => {
    useCollaborationStore.setState({ activeWorkspaceId: 'ws-1' });
    mocks.taskList.mockResolvedValue([
      { _id: 't1', title: 'Wire API', workspaceRef: 'ws-1', projectRef: 'p1', sprintRef: 's1', featureRef: 'f1', sprintStatus: 'in_progress', labels: ['API'], createdAt: '2026-02-01T00:00:00.000Z' },
    ] as any);

    await useCollaborationStore.getState().loadTasks();

    expect(mocks.taskList).toHaveBeenCalledWith({ workspaceId: 'ws-1' });
    const t = useCollaborationStore.getState().tasks[0];
    expect(t).toMatchObject({ id: 't1', workspaceId: 'ws-1', projectId: 'p1', sprintId: 's1', featureId: 'f1', sprintStatus: 'in_progress', labels: ['API'] });
  });

  it('domain loaders are empty-safe when the workspace has no projects', async () => {
    useCollaborationStore.setState({ activeWorkspaceId: 'ws-1', projects: [] });

    await useCollaborationStore.getState().loadSprints();
    await useCollaborationStore.getState().loadFeatures();

    expect(mocks.sprintList).not.toHaveBeenCalled();
    expect(mocks.featureList).not.toHaveBeenCalled();
    expect(useCollaborationStore.getState().sprints).toEqual([]);
    expect(useCollaborationStore.getState().features).toEqual([]);
  });

  it('domain loaders fall back to empty state on API failure (offline-safe)', async () => {
    useCollaborationStore.setState({ activeWorkspaceId: 'ws-1', projects: [project] });
    mocks.sprintList.mockRejectedValue(new Error('offline'));
    mocks.featureList.mockRejectedValue(new Error('offline'));
    mocks.taskList.mockRejectedValue(new Error('offline'));

    await useCollaborationStore.getState().loadSprints();
    await useCollaborationStore.getState().loadFeatures();
    await useCollaborationStore.getState().loadTasks();

    expect(useCollaborationStore.getState().sprints).toEqual([]);
    expect(useCollaborationStore.getState().features).toEqual([]);
    expect(useCollaborationStore.getState().tasks).toEqual([]);
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

  it('updateProjectMeta applies meta optimistically and calls api.projects.update', async () => {
    useCollaborationStore.setState({
      projects: [{
        id: 'p1', workspaceId: 'ws-1', name: 'Agent Service', key: 'AG', description: 'old',
        members: [], teamIds: [], status: 'active', milestones: [], createdAt: '2026-01-01',
      }],
    });
    mocks.projectUpdate.mockResolvedValue({} as any);

    const promise = useCollaborationStore.getState().updateProjectMeta('p1', { description: 'new', status: 'on_hold' });
    expect(useCollaborationStore.getState().projects[0]).toMatchObject({ description: 'new', status: 'on_hold' });

    await promise;
    expect(mocks.projectUpdate).toHaveBeenCalledWith('p1', { description: 'new', status: 'on_hold' });
  });

  it('updateProjectMeta rolls back on failure', async () => {
    useCollaborationStore.setState({
      projects: [{
        id: 'p1', workspaceId: 'ws-1', name: 'Agent Service', key: 'AG', description: 'old',
        members: [], teamIds: [], status: 'active', milestones: [], createdAt: '2026-01-01',
      }],
    });
    mocks.projectUpdate.mockRejectedValue(new Error('boom'));

    await useCollaborationStore.getState().updateProjectMeta('p1', { description: 'new' });

    expect(useCollaborationStore.getState().projects[0].description).toBe('old');
  });

  it('updateProjectMeta is a no-op for an unknown project', async () => {
    await useCollaborationStore.getState().updateProjectMeta('missing', { description: 'x' });
    expect(mocks.projectUpdate).not.toHaveBeenCalled();
  });

  it('createFeature optimistically adds a backlog feature with a real owner', async () => {
    useAuthStore.setState({ user: { _id: 'u-1', name: 'Ajay Kumar', email: 'a@f.io', role: 'user', settings: {} } });
    useCollaborationStore.setState({ activeWorkspaceId: 'ws-1', features: [] });
    mocks.featureCreate.mockResolvedValue({
      _id: 'f-real', name: 'AI Copilot', projectRef: 'p1', workspaceRef: 'ws-1', sprintRef: null,
      type: 'feature', labels: [], ownerId: 'u-1', estimatedHours: 16, status: 'backlog', order: 0,
      createdAt: '2026-02-10T00:00:00.000Z',
    } as any);

    const promise = useCollaborationStore.getState().createFeature({ projectId: 'p1', name: 'AI Copilot', estimatedHours: 16 });
    const optimistic = useCollaborationStore.getState().features.find((f) => f.id.startsWith('ft-'));
    expect(optimistic).toBeDefined();
    expect(optimistic?.ownerId).toBe('u-1');
    expect(optimistic?.sprintId).toBeUndefined();

    const created = await promise;
    expect(mocks.featureCreate).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'p1', name: 'AI Copilot', estimatedHours: 16, ownerId: 'u-1', status: 'backlog',
    }));
    expect(created?.id).toBe('f-real');
    expect(useCollaborationStore.getState().features[0].id).toBe('f-real');
  });

  it('createFeature rolls back on failure', async () => {
    useCollaborationStore.setState({ activeWorkspaceId: 'ws-1', features: [] });
    mocks.featureCreate.mockRejectedValue(new Error('boom'));

    const created = await useCollaborationStore.getState().createFeature({ projectId: 'p1', name: 'AI Copilot' });

    expect(created).toBeUndefined();
    expect(useCollaborationStore.getState().features).toHaveLength(0);
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

// IES-R1 (P5-T3/T4): API-backed sprint/task actions + real user identity.
describe('useCollaborationStore optimistic collab actions (IES-R1)', () => {
  it('createSprint optimistically adds, persists, then replaces with the server doc', async () => {
    useCollaborationStore.setState({ activeWorkspaceId: 'ws-1', sprints: [] });
    mocks.sprintCreate.mockResolvedValue({
      _id: 's-real', name: 'Sprint 1', projectRef: 'p1', workspaceRef: 'ws-1', goal: 'g',
      startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-01-07T00:00:00.000Z',
      status: 'future', capacityHours: 160, targetVelocity: 80,
    } as any);

    const promise = useCollaborationStore.getState().createSprint('p1', 'Sprint 1', '2026-01-01', '2026-01-07', 'g');
    expect(useCollaborationStore.getState().sprints.some((s) => s.id.startsWith('sp-'))).toBe(true);

    const created = await promise;
    expect(mocks.sprintCreate).toHaveBeenCalledWith({
      projectId: 'p1', name: 'Sprint 1', startDate: '2026-01-01', endDate: '2026-01-07', goal: 'g',
      capacityHours: 160, targetVelocity: 80,
    });
    expect(created?.id).toBe('s-real');
    expect(useCollaborationStore.getState().sprints[0].id).toBe('s-real');
  });

  it('createSprint rolls back and returns undefined on failure', async () => {
    useCollaborationStore.setState({ activeWorkspaceId: 'ws-1', sprints: [] });
    mocks.sprintCreate.mockRejectedValue(new Error('boom'));

    const created = await useCollaborationStore.getState().createSprint('p1', 'Sprint 1', '2026-01-01', '2026-01-07', 'g');

    expect(created).toBeUndefined();
    expect(useCollaborationStore.getState().sprints).toHaveLength(0);
  });

  it('createTask uses the authenticated user for owner/assignee/followers', async () => {
    useAuthStore.setState({ user: { _id: 'u-1', name: 'Ajay Kumar', email: 'a@f.io', role: 'user', settings: {} } });
    useCollaborationStore.setState({ activeWorkspaceId: 'ws-1', tasks: [] });
    mocks.taskCreate.mockResolvedValue({
      _id: 't-real', title: 'Wire API', workspaceRef: 'ws-1', projectRef: 'p1', sprintRef: 's1', featureRef: 'f1',
      sprintStatus: 'backlog', priority: 'medium', labels: [], createdAt: '2026-02-01T00:00:00.000Z',
    } as any);

    const promise = useCollaborationStore.getState().createTask({ title: 'Wire API', projectId: 'p1', sprintId: 's1', featureId: 'f1' });
    const optimistic = useCollaborationStore.getState().tasks.find((t) => t.id.startsWith('ct-'));
    expect(optimistic).toBeDefined();
    expect(optimistic?.ownerId).toBe('u-1');
    expect(optimistic?.assigneeId).toBe('u-1');
    expect(optimistic?.followerIds).toEqual(['u-1']);

    const created = await promise;
    expect(mocks.taskCreate).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Wire API',
      workspaceId: 'ws-1',
      projectId: 'p1',
      sprintId: 's1',
      featureId: 'f1',
      sprintStatus: 'backlog',
    }));
    expect(created?.id).toBe('t-real');
    expect(useCollaborationStore.getState().tasks[0].id).toBe('t-real');
  });

  it('createTask rolls back on failure', async () => {
    useCollaborationStore.setState({ activeWorkspaceId: 'ws-1', tasks: [] });
    mocks.taskCreate.mockRejectedValue(new Error('boom'));

    const created = await useCollaborationStore.getState().createTask({ title: 'Wire API', projectId: 'p1' });

    expect(created).toBeUndefined();
    expect(useCollaborationStore.getState().tasks).toHaveLength(0);
  });

  it('updateTaskStatus optimistically applies and persists sprintStatus', async () => {
    useCollaborationStore.setState({
      tasks: [{
        id: 't1', workspaceId: 'ws-1', projectId: 'p1', title: 'T', description: '', sprintStatus: 'backlog',
        priority: 'medium', ownerId: 'u-1', followerIds: [], labels: [], dependencies: [],
        estimatedHours: 8, actualHours: 0, subtasks: [], createdAt: '2026-01-01', updatedAt: '2026-01-01',
      }],
    });
    mocks.taskUpdate.mockResolvedValue({} as any);

    const promise = useCollaborationStore.getState().updateTaskStatus('t1', 'done');
    expect(useCollaborationStore.getState().tasks[0].sprintStatus).toBe('done');

    await promise;
    expect(mocks.taskUpdate).toHaveBeenCalledWith('t1', { sprintStatus: 'done' });
  });

  it('updateTaskStatus rolls back sprintStatus on failure', async () => {
    useCollaborationStore.setState({
      tasks: [{
        id: 't1', workspaceId: 'ws-1', projectId: 'p1', title: 'T', description: '', sprintStatus: 'review',
        priority: 'medium', ownerId: 'u-1', followerIds: [], labels: [], dependencies: [],
        estimatedHours: 8, actualHours: 0, subtasks: [], createdAt: '2026-01-01', updatedAt: '2026-01-01',
      }],
    });
    mocks.taskUpdate.mockRejectedValue(new Error('boom'));

    await useCollaborationStore.getState().updateTaskStatus('t1', 'done');

    expect(useCollaborationStore.getState().tasks[0].sprintStatus).toBe('review');
  });

  it('updateGitContext persists via PATCH /tasks/:id/git and rolls back on failure', async () => {
    useCollaborationStore.setState({
      tasks: [{
        id: 't1', workspaceId: 'ws-1', projectId: 'p1', title: 'T', description: '', sprintStatus: 'backlog',
        priority: 'medium', ownerId: 'u-1', followerIds: [], labels: [], dependencies: [],
        estimatedHours: 8, actualHours: 0, gitContext: { repository: 'old' }, subtasks: [],
        createdAt: '2026-01-01', updatedAt: '2026-01-01',
      }],
    });
    mocks.taskPatchGit.mockRejectedValue(new Error('boom'));

    await useCollaborationStore.getState().updateGitContext('t1', { branch: 'main' });

    expect(useCollaborationStore.getState().tasks[0].gitContext).toEqual({ repository: 'old' });
    expect(mocks.taskPatchGit).toHaveBeenCalledWith('t1', { branch: 'main' });
  });

  it('addComment and createDoc use the real authenticated user (no m1)', () => {
    useAuthStore.setState({ user: { _id: 'u-1', name: 'Ajay Kumar', email: 'a@f.io', role: 'user', settings: {} } });

    useCollaborationStore.getState().addComment('task', 't1', 'hello');
    const c = useCollaborationStore.getState().discussions[0];
    expect(c.author.id).toBe('u-1');
    expect(c.author.name).toBe('Ajay Kumar');

    useCollaborationStore.getState().createDoc('Doc', 'Architecture', '# hi', []);
    expect(useCollaborationStore.getState().docs[0].authorId).toBe('u-1');
  });

  it('createSprint passes capacity/target from the modal opts (backlog-safe defaults)', async () => {
    useCollaborationStore.setState({ activeWorkspaceId: 'ws-1', sprints: [] });
    mocks.sprintCreate.mockResolvedValue({
      _id: 's-real', name: 'Sprint 1', projectRef: 'p1', workspaceRef: 'ws-1', goal: 'g',
      startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-01-07T00:00:00.000Z',
      status: 'future', capacityHours: 200, targetVelocity: 90,
    } as any);

    await useCollaborationStore.getState().createSprint('p1', 'Sprint 1', '2026-01-01', '2026-01-07', 'g', { capacityHours: 200, targetVelocity: 90 });

    expect(mocks.sprintCreate).toHaveBeenCalledWith({
      projectId: 'p1', name: 'Sprint 1', startDate: '2026-01-01', endDate: '2026-01-07', goal: 'g',
      capacityHours: 200, targetVelocity: 90,
    });
    expect(useCollaborationStore.getState().sprints[0].capacityHours).toBe(200);
    expect(useCollaborationStore.getState().sprints[0].targetVelocity).toBe(90);
  });
});

// IES-R1 (P6-T3): moveFeature persists the sprintRef via PATCH features/:id.
describe('useCollaborationStore moveFeature (IES-R1-P6-T3)', () => {
  const feature = (id: string, sprintId?: string): Feature => ({
    id, workspaceId: 'ws-1', projectId: 'p1', sprintId,
    name: `F ${id}`, description: '', type: 'feature', labels: [], ownerId: 'u-1',
    estimatedHours: 8, status: 'backlog', order: 0, createdAt: '2026-01-01',
  });

  it('optimistically moves a backlog feature into a sprint', async () => {
    useCollaborationStore.setState({ features: [feature('f1'), feature('f2')] });
    mocks.featureUpdate.mockResolvedValue({ _id: 'f1', sprintRef: 's1' } as any);

    const promise = useCollaborationStore.getState().moveFeature('f1', 's1');
    expect(useCollaborationStore.getState().features.find((f) => f.id === 'f1')?.sprintId).toBe('s1');

    await promise;
    expect(mocks.featureUpdate).toHaveBeenCalledWith('f1', { sprintId: 's1' });
  });

  it('un-tethers a feature back to the backlog with sprintId: null', async () => {
    useCollaborationStore.setState({ features: [feature('f1', 's1')] });
    mocks.featureUpdate.mockResolvedValue({ _id: 'f1', sprintRef: null } as any);

    const promise = useCollaborationStore.getState().moveFeature('f1', null);
    expect(useCollaborationStore.getState().features.find((f) => f.id === 'f1')?.sprintId).toBeUndefined();

    await promise;
    expect(mocks.featureUpdate).toHaveBeenCalledWith('f1', { sprintId: null });
  });

  it('rolls the sprintRef back on failure', async () => {
    useCollaborationStore.setState({ features: [feature('f1')] });
    mocks.featureUpdate.mockRejectedValue(new Error('boom'));

    await useCollaborationStore.getState().moveFeature('f1', 's1');

    expect(useCollaborationStore.getState().features.find((f) => f.id === 'f1')?.sprintId).toBeUndefined();
    expect(mocks.featureUpdate).toHaveBeenCalledWith('f1', { sprintId: 's1' });
  });
});
