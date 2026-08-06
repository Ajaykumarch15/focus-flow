import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCollaborationStore } from '../useCollaborationStore';
import { useAuthStore } from '../useAuthStore';
import type { Feature, Sprint } from '../../types/collaboration';

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
      update: vi.fn(),
      commit: vi.fn(),
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
      addSubtask: vi.fn(),
      toggleSubtask: vi.fn(),
      deleteSubtask: vi.fn(),
      reorder: vi.fn(),
    },
    comments: {
      list: vi.fn(),
      create: vi.fn(),
      addReaction: vi.fn(),
      resolve: vi.fn(),
      remove: vi.fn(),
    },
    attachments: {
      list: vi.fn(),
      create: vi.fn(),
      remove: vi.fn(),
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
  sprintUpdate: vi.mocked(api.sprints.update),
  sprintCommit: vi.mocked(api.sprints.commit),
  featureList: vi.mocked(api.features.list),
  featureCreate: vi.mocked(api.features.create),
  featureUpdate: vi.mocked(api.features.update),
  taskList: vi.mocked(api.tasks.list),
  taskCreate: vi.mocked(api.tasks.create),
  taskUpdate: vi.mocked(api.tasks.update),
  taskPatchGit: vi.mocked(api.tasks.patchGit),
  taskAddSubtask: vi.mocked(api.tasks.addSubtask),
  taskToggleSubtask: vi.mocked(api.tasks.toggleSubtask),
  taskDeleteSubtask: vi.mocked(api.tasks.deleteSubtask),
  taskReorder: vi.mocked(api.tasks.reorder),
  commentList: vi.mocked(api.comments.list),
  commentCreate: vi.mocked(api.comments.create),
  commentReaction: vi.mocked(api.comments.addReaction),
  commentResolve: vi.mocked(api.comments.resolve),
  commentRemove: vi.mocked(api.comments.remove),
  attachmentList: vi.mocked(api.attachments.list),
  attachmentCreate: vi.mocked(api.attachments.create),
  attachmentRemove: vi.mocked(api.attachments.remove),
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
    attachments: [],
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
      status: 'draft', capacityHours: 160, targetVelocity: 80,
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

  // EEP2-P5.1.2 · assignTask (DDS §4.9 assignee).
  it('assignTask optimistically applies and persists the assignee', async () => {
    useCollaborationStore.setState({
      tasks: [{
        id: 't1', workspaceId: 'ws-1', projectId: 'p1', title: 'T', description: '', sprintStatus: 'backlog',
        priority: 'medium', ownerId: 'u-1', assigneeId: 'm-1', followerIds: [], labels: [], dependencies: [],
        estimatedHours: 8, actualHours: 0, subtasks: [], createdAt: '2026-01-01', updatedAt: '2026-01-01',
      }],
    });
    mocks.taskUpdate.mockResolvedValue({} as any);

    const promise = useCollaborationStore.getState().assignTask('t1', 'm-2');
    expect(useCollaborationStore.getState().tasks[0].assigneeId).toBe('m-2');

    await promise;
    expect(mocks.taskUpdate).toHaveBeenCalledWith('t1', { assigneeId: 'm-2' });
  });

  it('assignTask rolls back the assignee on failure', async () => {
    useCollaborationStore.setState({
      tasks: [{
        id: 't1', workspaceId: 'ws-1', projectId: 'p1', title: 'T', description: '', sprintStatus: 'backlog',
        priority: 'medium', ownerId: 'u-1', assigneeId: 'm-1', followerIds: [], labels: [], dependencies: [],
        estimatedHours: 8, actualHours: 0, subtasks: [], createdAt: '2026-01-01', updatedAt: '2026-01-01',
      }],
    });
    mocks.taskUpdate.mockRejectedValue(new Error('boom'));

    await useCollaborationStore.getState().assignTask('t1', 'm-2');

    expect(useCollaborationStore.getState().tasks[0].assigneeId).toBe('m-1');
  });

  // EEP2-P5.1.3 · subtask CRUD + toggle (DDS §4.10).
  it('addSubtask optimistically appends a subtask and persists', async () => {
    useCollaborationStore.setState({
      tasks: [{
        id: 't1', workspaceId: 'ws-1', projectId: 'p1', title: 'T', description: '', sprintStatus: 'backlog',
        priority: 'medium', ownerId: 'u-1', followerIds: [], labels: [], dependencies: [],
        estimatedHours: 8, actualHours: 0, subtasks: [], createdAt: '2026-01-01', updatedAt: '2026-01-01',
      }],
    });
    mocks.taskAddSubtask.mockResolvedValue({} as any);

    const promise = useCollaborationStore.getState().addSubtask('t1', 'Write tests');
    const optimistic = useCollaborationStore.getState().tasks[0].subtasks[0];
    expect(optimistic).toMatchObject({ title: 'Write tests', completed: false });

    await promise;
    expect(mocks.taskAddSubtask).toHaveBeenCalledWith('t1', 'Write tests');
  });

  it('addSubtask rolls back on failure', async () => {
    useCollaborationStore.setState({
      tasks: [{
        id: 't1', workspaceId: 'ws-1', projectId: 'p1', title: 'T', description: '', sprintStatus: 'backlog',
        priority: 'medium', ownerId: 'u-1', followerIds: [], labels: [], dependencies: [],
        estimatedHours: 8, actualHours: 0, subtasks: [], createdAt: '2026-01-01', updatedAt: '2026-01-01',
      }],
    });
    mocks.taskAddSubtask.mockRejectedValue(new Error('boom'));

    await useCollaborationStore.getState().addSubtask('t1', 'Write tests');

    expect(useCollaborationStore.getState().tasks[0].subtasks).toHaveLength(0);
  });

  it('toggleSubtask optimistically updates completed and persists', async () => {
    useCollaborationStore.setState({
      tasks: [{
        id: 't1', workspaceId: 'ws-1', projectId: 'p1', title: 'T', description: '', sprintStatus: 'backlog',
        priority: 'medium', ownerId: 'u-1', followerIds: [], labels: [], dependencies: [],
        estimatedHours: 8, actualHours: 0,
        subtasks: [{ id: 's1', title: 'Write tests', completed: false }],
        createdAt: '2026-01-01', updatedAt: '2026-01-01',
      }],
    });
    mocks.taskToggleSubtask.mockResolvedValue({} as any);

    const promise = useCollaborationStore.getState().toggleSubtask('t1', 's1', true);
    expect(useCollaborationStore.getState().tasks[0].subtasks[0].completed).toBe(true);

    await promise;
    expect(mocks.taskToggleSubtask).toHaveBeenCalledWith('t1', 's1', true);
  });

  it('deleteSubtask optimistically removes a subtask and persists', async () => {
    useCollaborationStore.setState({
      tasks: [{
        id: 't1', workspaceId: 'ws-1', projectId: 'p1', title: 'T', description: '', sprintStatus: 'backlog',
        priority: 'medium', ownerId: 'u-1', followerIds: [], labels: [], dependencies: [],
        estimatedHours: 8, actualHours: 0,
        subtasks: [{ id: 's1', title: 'Write tests', completed: false }],
        createdAt: '2026-01-01', updatedAt: '2026-01-01',
      }],
    });
    mocks.taskDeleteSubtask.mockResolvedValue({} as any);

    const promise = useCollaborationStore.getState().deleteSubtask('t1', 's1');
    expect(useCollaborationStore.getState().tasks[0].subtasks).toHaveLength(0);

    await promise;
    expect(mocks.taskDeleteSubtask).toHaveBeenCalledWith('t1', 's1');
  });

  it('deleteSubtask rolls back on failure', async () => {
    useCollaborationStore.setState({
      tasks: [{
        id: 't1', workspaceId: 'ws-1', projectId: 'p1', title: 'T', description: '', sprintStatus: 'backlog',
        priority: 'medium', ownerId: 'u-1', followerIds: [], labels: [], dependencies: [],
        estimatedHours: 8, actualHours: 0,
        subtasks: [{ id: 's1', title: 'Write tests', completed: false }],
        createdAt: '2026-01-01', updatedAt: '2026-01-01',
      }],
    });
    mocks.taskDeleteSubtask.mockRejectedValue(new Error('boom'));

    await useCollaborationStore.getState().deleteSubtask('t1', 's1');

    expect(useCollaborationStore.getState().tasks[0].subtasks).toHaveLength(1);
  });

  // EEP2-P5.2.2 · setDependencies (DDS §4.9 dependency list).
  it('setDependencies optimistically replaces the dependency list and persists', async () => {
    useCollaborationStore.setState({
      tasks: [{
        id: 't1', workspaceId: 'ws-1', projectId: 'p1', title: 'T', description: '', sprintStatus: 'backlog',
        priority: 'medium', ownerId: 'u-1', followerIds: [], labels: [], dependencies: ['t-old'],
        estimatedHours: 8, actualHours: 0, subtasks: [], createdAt: '2026-01-01', updatedAt: '2026-01-01',
      }],
    });
    mocks.taskUpdate.mockResolvedValue({} as any);

    const promise = useCollaborationStore.getState().setDependencies('t1', ['t2', 't3']);
    expect(useCollaborationStore.getState().tasks[0].dependencies).toEqual(['t2', 't3']);

    await promise;
    expect(mocks.taskUpdate).toHaveBeenCalledWith('t1', { dependencies: ['t2', 't3'] });
  });

  it('setDependencies rolls back the list on failure', async () => {
    useCollaborationStore.setState({
      tasks: [{
        id: 't1', workspaceId: 'ws-1', projectId: 'p1', title: 'T', description: '', sprintStatus: 'backlog',
        priority: 'medium', ownerId: 'u-1', followerIds: [], labels: [], dependencies: ['t-old'],
        estimatedHours: 8, actualHours: 0, subtasks: [], createdAt: '2026-01-01', updatedAt: '2026-01-01',
      }],
    });
    mocks.taskUpdate.mockRejectedValue(new Error('cycle'));

    await useCollaborationStore.getState().setDependencies('t1', ['t2']);

    expect(useCollaborationStore.getState().tasks[0].dependencies).toEqual(['t-old']);
  });

  it('addComment and createDoc use the real authenticated user (no m1)', async () => {
    useAuthStore.setState({ user: { _id: 'u-1', name: 'Ajay Kumar', email: 'a@f.io', role: 'user', settings: {} } });
    mocks.commentCreate.mockResolvedValue({
      id: 'c-1', workspaceId: 'ws-1', targetType: 'task', targetRef: 't1', parentId: null,
      author: { id: 'u-1', name: 'Ajay Kumar' }, content: 'hello',
      createdAt: '2026-01-01T00:00:00.000Z', reactions: {}, replies: [], isResolved: false,
    } as any);

    await useCollaborationStore.getState().addComment('task', 't1', 'hello');
    const c = useCollaborationStore.getState().discussions[0];
    expect(c.author.id).toBe('u-1');
    expect(c.author.name).toBe('Ajay Kumar');
    expect(c.targetId).toBe('t1');
    expect(mocks.commentCreate).toHaveBeenCalledWith({ targetType: 'task', targetRef: 't1', content: 'hello', parentId: undefined });

    useCollaborationStore.getState().createDoc('Doc', 'Architecture', '# hi', []);
    expect(useCollaborationStore.getState().docs[0].authorId).toBe('u-1');
  });

  // EEP2-P5.3.1: comments are persisted — loadDiscussions maps the paginated
  // server page into DiscussionComments (targetRef → targetId, nested replies).
  it('loadDiscussions maps persisted thread docs into DiscussionComments', async () => {
    mocks.commentList.mockResolvedValue({
      items: [
        { id: 'c-1', workspaceId: 'ws-1', targetType: 'task', targetRef: 't1', parentId: null,
          author: { id: 'u-1', name: 'Ajay' }, content: 'root', createdAt: '2026-01-02T00:00:00.000Z',
          reactions: { '👍': ['u-1'] }, replies: [
            { id: 'c-2', workspaceId: 'ws-1', targetType: 'task', targetRef: 't1', parentId: 'c-1',
              author: { id: 'u-2', name: 'Bo' }, content: 'reply', createdAt: '2026-01-03T00:00:00.000Z',
              reactions: {}, replies: [], isResolved: false },
          ], isResolved: false },
      ],
      hasMore: true,
      nextCursor: 'abc',
    } as any);

    await useCollaborationStore.getState().loadDiscussions('task', 't1');

    const s = useCollaborationStore.getState();
    expect(s.discussions).toHaveLength(1);
    expect(s.discussions[0]).toMatchObject({ id: 'c-1', targetId: 't1', content: 'root' });
    expect(s.discussions[0].reactions).toEqual({ '👍': ['u-1'] });
    expect(s.discussions[0].replies[0].targetId).toBe('t1');
    expect(s.discussions[0].replies[0].content).toBe('reply');
    expect(s.discussionsHasMore).toBe(true);
    expect(s.discussionsNextCursor).toBe('abc');
  });

  it('loadDiscussions appends the next cursor page without duplicating roots', async () => {
    mocks.commentList
      .mockResolvedValueOnce({ items: [{ id: 'c-1', workspaceId: 'ws-1', targetType: 'task', targetRef: 't1', parentId: null, author: { id: 'u-1', name: 'A' }, content: 'first', createdAt: '2026-01-03T00:00:00.000Z', reactions: {}, replies: [], isResolved: false }], hasMore: true, nextCursor: 'cur-2' } as any)
      .mockResolvedValueOnce({ items: [{ id: 'c-0', workspaceId: 'ws-1', targetType: 'task', targetRef: 't1', parentId: null, author: { id: 'u-1', name: 'A' }, content: 'second', createdAt: '2026-01-02T00:00:00.000Z', reactions: {}, replies: [], isResolved: false }], hasMore: false, nextCursor: null } as any);

    await useCollaborationStore.getState().loadDiscussions('task', 't1');
    await useCollaborationStore.getState().loadDiscussions('task', 't1', { cursor: 'cur-2', append: true });

    expect(mocks.commentList).toHaveBeenNthCalledWith(2, 'task', 't1', { cursor: 'cur-2' });
    expect(useCollaborationStore.getState().discussions.map((d) => d.id)).toEqual(['c-1', 'c-0']);
    expect(useCollaborationStore.getState().discussionsHasMore).toBe(false);
  });

  it('addComment rolls back the optimistic comment when persistence fails', async () => {
    mocks.commentCreate.mockRejectedValue(new Error('boom'));

    await useCollaborationStore.getState().addComment('task', 't1', 'will-fail');

    expect(useCollaborationStore.getState().discussions).toEqual([]);
  });

  it('addReaction toggles the current user and persists via PATCH', async () => {
    mocks.commentReaction.mockResolvedValue({
      id: 'c-1', workspaceId: 'ws-1', targetType: 'task', targetRef: 't1', parentId: null,
      author: { id: 'u-1', name: 'A' }, content: 'x', createdAt: '2026-01-01T00:00:00.000Z',
      reactions: { '👍': ['u-1'] }, replies: [], isResolved: false,
    } as any);
    useCollaborationStore.setState({
      discussions: [{ id: 'c-1', workspaceId: 'ws-1', targetType: 'task', targetId: 't1', author: { id: 'u-1', name: 'A' }, content: 'x', createdAt: '2026-01-01T00:00:00.000Z', reactions: {}, replies: [] }],
    });

    await useCollaborationStore.getState().addReaction('c-1', '👍');

    expect(mocks.commentReaction).toHaveBeenCalledWith('c-1', '👍');
    expect(useCollaborationStore.getState().discussions[0].reactions['👍']).toEqual(['u-1']);
  });

  it('resolveThread persists the resolved flag', async () => {
    mocks.commentResolve.mockResolvedValue({
      id: 'c-1', workspaceId: 'ws-1', targetType: 'task', targetRef: 't1', parentId: null,
      author: { id: 'u-1', name: 'A' }, content: 'x', createdAt: '2026-01-01T00:00:00.000Z',
      reactions: {}, replies: [], isResolved: true,
    } as any);
    useCollaborationStore.setState({
      discussions: [{ id: 'c-1', workspaceId: 'ws-1', targetType: 'task', targetId: 't1', author: { id: 'u-1', name: 'A' }, content: 'x', createdAt: '2026-01-01T00:00:00.000Z', reactions: {}, replies: [] }],
    });

    await useCollaborationStore.getState().resolveThread('c-1');

    expect(mocks.commentResolve).toHaveBeenCalledWith('c-1');
    expect(useCollaborationStore.getState().discussions[0].isResolved).toBe(true);
  });

  it('deleteComment removes the comment and its replies optimistically', async () => {
    mocks.commentRemove.mockResolvedValue({ message: 'deleted' } as any);
    useCollaborationStore.setState({
      discussions: [{ id: 'c-1', workspaceId: 'ws-1', targetType: 'task', targetId: 't1', author: { id: 'u-1', name: 'A' }, content: 'x', createdAt: '2026-01-01T00:00:00.000Z', reactions: {}, replies: [{ id: 'c-2', workspaceId: 'ws-1', targetType: 'task', targetId: 't1', author: { id: 'u-2', name: 'B' }, content: 'y', createdAt: '2026-01-01T00:00:00.000Z', reactions: {}, replies: [] }] }],
    });

    await useCollaborationStore.getState().deleteComment('c-1');

    expect(mocks.commentRemove).toHaveBeenCalledWith('c-1');
    expect(useCollaborationStore.getState().discussions).toEqual([]);
  });

  // EEP2-P5.3.2: attachments are persisted — loadAttachments maps the paginated
  // server page into TaskAttachments (targetRef → targetId, real uploader).
  it('loadAttachments maps persisted docs into TaskAttachments', async () => {
    mocks.attachmentList.mockResolvedValue({
      items: [
        { id: 'a-1', workspaceId: 'ws-1', targetType: 'task', targetRef: 't1',
          name: 'Auth flow', type: 'image', url: 'https://x.test/a.png', sizeBytes: 2048,
          description: 'diagram', uploadedBy: { id: 'u-1', name: 'Ajay' },
          createdAt: '2026-01-02T00:00:00.000Z' },
      ],
      hasMore: true,
      nextCursor: 'abc',
    } as any);

    await useCollaborationStore.getState().loadAttachments('task', 't1');

    const s = useCollaborationStore.getState();
    expect(s.attachments).toHaveLength(1);
    expect(s.attachments[0]).toMatchObject({ id: 'a-1', targetId: 't1', name: 'Auth flow', url: 'https://x.test/a.png' });
    expect(s.attachments[0].uploadedBy).toEqual({ id: 'u-1', name: 'Ajay' });
    expect(s.attachmentsHasMore).toBe(true);
    expect(s.attachmentsNextCursor).toBe('abc');
  });

  it('loadAttachments appends the next cursor page without duplicating', async () => {
    mocks.attachmentList
      .mockResolvedValueOnce({ items: [{ id: 'a-1', workspaceId: 'ws-1', targetType: 'task', targetRef: 't1', name: 'one', type: 'file', url: 'https://x.test/1', sizeBytes: 1, description: '', uploadedBy: { id: 'u-1', name: 'A' }, createdAt: '2026-01-03T00:00:00.000Z' }], hasMore: true, nextCursor: 'cur-2' } as any)
      .mockResolvedValueOnce({ items: [{ id: 'a-2', workspaceId: 'ws-1', targetType: 'task', targetRef: 't1', name: 'two', type: 'file', url: 'https://x.test/2', sizeBytes: 1, description: '', uploadedBy: { id: 'u-1', name: 'A' }, createdAt: '2026-01-02T00:00:00.000Z' }], hasMore: false, nextCursor: null } as any);

    await useCollaborationStore.getState().loadAttachments('task', 't1');
    await useCollaborationStore.getState().loadAttachments('task', 't1', { cursor: 'cur-2', append: true });

    expect(mocks.attachmentList).toHaveBeenNthCalledWith(2, 'task', 't1', { cursor: 'cur-2' });
    expect(useCollaborationStore.getState().attachments.map((a) => a.id)).toEqual(['a-1', 'a-2']);
    expect(useCollaborationStore.getState().attachmentsHasMore).toBe(false);
  });

  it('uploadAttachment optimistically adds then adopts the server doc (real uploader)', async () => {
    useAuthStore.setState({ user: { _id: 'u-1', name: 'Ajay Kumar', email: 'a@f.io', role: 'user', settings: {} } });
    mocks.attachmentCreate.mockResolvedValue({
      id: 'a-1', workspaceId: 'ws-1', targetType: 'task', targetRef: 't1',
      name: 'Diagram', type: 'image', url: 'https://x.test/d.png', sizeBytes: 4096,
      description: 'auth flow', uploadedBy: { id: 'u-1', name: 'Ajay Kumar' },
      createdAt: '2026-01-01T00:00:00.000Z',
    } as any);

    await useCollaborationStore.getState().uploadAttachment('task', 't1', {
      name: 'Diagram', url: 'https://x.test/d.png', description: 'auth flow',
    });

    expect(mocks.attachmentCreate).toHaveBeenCalledWith({ targetType: 'task', targetRef: 't1', name: 'Diagram', url: 'https://x.test/d.png', description: 'auth flow' });
    const a = useCollaborationStore.getState().attachments[0];
    expect(a.id).toBe('a-1');
    expect(a.uploadedBy).toEqual({ id: 'u-1', name: 'Ajay Kumar' });
  });

  it('uploadAttachment rolls back the optimistic attachment when persistence fails', async () => {
    mocks.attachmentCreate.mockRejectedValue(new Error('boom'));

    await useCollaborationStore.getState().uploadAttachment('task', 't1', { name: 'x', url: 'https://x.test/x' });

    expect(useCollaborationStore.getState().attachments).toEqual([]);
  });

  it('deleteAttachment removes the attachment optimistically', async () => {
    mocks.attachmentRemove.mockResolvedValue({ message: 'deleted' } as any);
    useCollaborationStore.setState({
      attachments: [{ id: 'a-1', workspaceId: 'ws-1', targetType: 'task', targetId: 't1', name: 'x', type: 'file', url: 'https://x.test/x', sizeBytes: 1, description: '', uploadedBy: { id: 'u-1', name: 'A' }, createdAt: '2026-01-01T00:00:00.000Z' }],
    });

    await useCollaborationStore.getState().deleteAttachment('a-1');

    expect(mocks.attachmentRemove).toHaveBeenCalledWith('a-1');
    expect(useCollaborationStore.getState().attachments).toEqual([]);
  });

  it('createSprint passes capacity/target from the modal opts (backlog-safe defaults)', async () => {
    useCollaborationStore.setState({ activeWorkspaceId: 'ws-1', sprints: [] });
    mocks.sprintCreate.mockResolvedValue({
      _id: 's-real', name: 'Sprint 1', projectRef: 'p1', workspaceRef: 'ws-1', goal: 'g',
      startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-01-07T00:00:00.000Z',
      status: 'draft', capacityHours: 200, targetVelocity: 90,
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

// EEP2-P4.3.2: planning-page persistence actions (DDS §10).
describe('useCollaborationStore sprint planning actions (EEP2-P4.3.2)', () => {
  const sprint = (overrides: Record<string, any> = {}): Sprint => ({
    id: 's1', workspaceId: 'ws-1', projectId: 'p1', name: 'Sprint 1',
    startDate: '2026-01-01', endDate: '2026-01-07', goal: 'Ship the alpha',
    status: 'draft', capacityHours: 160, targetVelocity: 80, ...overrides,
  });

  it('updateSprint applies goal/capacity optimistically and PATCHes', async () => {
    useCollaborationStore.setState({ sprints: [sprint()] });
    mocks.sprintUpdate.mockResolvedValue({ _id: 's1', goal: 'new goal' } as any);

    const promise = useCollaborationStore.getState().updateSprint('s1', { goal: 'new goal', capacityHours: 200 });
    expect(useCollaborationStore.getState().sprints[0]).toMatchObject({ goal: 'new goal', capacityHours: 200 });

    await promise;
    expect(mocks.sprintUpdate).toHaveBeenCalledWith('s1', { goal: 'new goal', capacityHours: 200 });
  });

  it('updateSprint normalizes date inputs to the client ISO-day shape', async () => {
    useCollaborationStore.setState({ sprints: [sprint()] });
    mocks.sprintUpdate.mockResolvedValue({} as any);

    await useCollaborationStore.getState().updateSprint('s1', { startDate: '2026-02-01T00:00:00.000Z' });

    expect(useCollaborationStore.getState().sprints[0].startDate).toBe('2026-02-01');
  });

  it('updateSprint rolls back on failure', async () => {
    useCollaborationStore.setState({ sprints: [sprint({ goal: 'old goal' })] });
    mocks.sprintUpdate.mockRejectedValue(new Error('boom'));

    await useCollaborationStore.getState().updateSprint('s1', { goal: 'new goal' });

    expect(useCollaborationStore.getState().sprints[0].goal).toBe('old goal');
  });

  it('updateSprint is a no-op for an unknown sprint', async () => {
    await useCollaborationStore.getState().updateSprint('missing', { goal: 'x' });
    expect(mocks.sprintUpdate).not.toHaveBeenCalled();
  });

  it('advanceSprintState delegates to updateSprint with the target status', async () => {
    useCollaborationStore.setState({ sprints: [sprint()] });
    mocks.sprintUpdate.mockResolvedValue({} as any);

    await useCollaborationStore.getState().advanceSprintState('s1', 'planned');

    expect(mocks.sprintUpdate).toHaveBeenCalledWith('s1', { status: 'planned' });
  });

  it('commitSprint latches committed and advances draft → planned', async () => {
    useCollaborationStore.setState({ sprints: [sprint()] });
    mocks.sprintCommit.mockResolvedValue({
      _id: 's1', committed: true, commitmentDate: '2026-01-01T00:00:00.000Z', status: 'planned',
    } as any);

    const promise = useCollaborationStore.getState().commitSprint('s1');
    expect(useCollaborationStore.getState().sprints[0]).toMatchObject({ committed: true, status: 'planned' });

    await promise;
    expect(mocks.sprintCommit).toHaveBeenCalledWith('s1');
  });

  it('commitSprint rolls back the committed latch on failure', async () => {
    useCollaborationStore.setState({ sprints: [sprint()] });
    mocks.sprintCommit.mockRejectedValue(new Error('boom'));

    await useCollaborationStore.getState().commitSprint('s1');

    const s = useCollaborationStore.getState().sprints[0];
    expect(s.committed).toBeFalsy();
    expect(s.status).toBe('draft');
  });
});
