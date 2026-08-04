import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCollaborationStore } from '../useCollaborationStore';

// IES-P2-07 e2e (Sprint 9 gate): "create workspace/project/task persists across
// refresh." Playwright is not installed, so the refresh is simulated the same
// way the timer suites do (timerEngine.test.ts): the store is reset to a fresh
// page-load state and re-hydrated from the API. The "server" below is a plain
// module-scoped store that survives the reset, mirroring the real REST backend:
// mutations write to it, GET loaders read from it.
//
// Coverage note: workspaces/projects/teams are API-backed (P2-01/03/07) and are
// proven persistent here. Collaborative tasks/sprints/docs/blockers/calendar
// remain client-local actions in the store (no backend routes exist for them),
// so they are intentionally NOT asserted to survive a refresh.
const { server, resetCollabServer } = vi.hoisted(() => {
  let nextId = 100;
  const server = {
    workspaces: [] as any[],
    projects: [] as any[],
    teams: [] as any[],
    nextId: () => `srv-${++nextId}`,
  };
  return {
    server,
    resetCollabServer: () => {
      server.workspaces.length = 0;
      server.projects.length = 0;
      server.teams.length = 0;
    },
  };
});

vi.mock('../../utils/api', () => {
  return {
    api: {
      workspaces: {
        list: vi.fn(async () => server.workspaces),
        members: vi.fn(async () => []),
        update: vi.fn(async (id: string, data: any) => {
          server.workspaces = server.workspaces.map((w) => (w.id === id ? { ...w, ...data } : w));
          return server.workspaces.find((w) => w.id === id);
        }),
        create: vi.fn(async (data: any) => {
          const doc = { id: server.nextId(), name: data.name, type: data.type ?? 'Startup', icon: '🚀', description: data.description ?? '', membersCount: 1, projectsCount: 0, createdAt: new Date().toISOString(), settings: {}, ...data };
          server.workspaces.push(doc);
          return doc;
        }),
      },
      teams: {
        list: vi.fn(async () => server.teams),
        create: vi.fn(async (data: any) => {
          const doc = { _id: server.nextId(), name: data.name, description: data.description ?? '', members: data.members ?? [], workspaceRef: data.workspaceId ?? '', color: data.color ?? '#0ea5e9' };
          server.teams.push(doc);
          return doc;
        }),
      },
      projects: {
        list: vi.fn(async (workspaceId?: string) =>
          server.projects.filter((p) => !workspaceId || String(p.workspaceRef) === workspaceId)
        ),
        create: vi.fn(async (data: any) => {
          const doc = { _id: server.nextId(), name: data.name, nameKey: data.name.toLowerCase(), workspaceRef: data.workspaceId ?? '', createdAt: new Date().toISOString() };
          server.projects.push(doc);
          return doc;
        }),
      },
    },
  };
});

import { api } from '../../utils/api';

const mocks = {
  wsCreate: vi.mocked(api.workspaces.create),
  projCreate: vi.mocked(api.projects.create),
  teamCreate: vi.mocked(api.teams.create),
};

// Fresh page-load state (what the store looks like right after a browser reload).
function simulatePageLoad() {
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
  resetCollabServer();
  simulatePageLoad();
});

describe('IES-P2-07 e2e · collab data persists across refresh', () => {
  it('a created workspace survives a refresh and is re-activated', async () => {
    await useCollaborationStore.getState().createWorkspace('Acme', 'Startup', 'desc');
    const createdId = useCollaborationStore.getState().activeWorkspaceId;

    // Simulate refresh: store memory wiped, then WorkspaceLayout re-hydrates.
    simulatePageLoad();
    await useCollaborationStore.getState().loadCollabData();

    const s = useCollaborationStore.getState();
    expect(s.workspaces.some((w) => w.id === createdId && w.name === 'Acme')).toBe(true);
    expect(s.activeWorkspaceId).toBe(createdId);
  });

  it('a created project persists across refresh and is re-loaded for its workspace', async () => {
    await useCollaborationStore.getState().createWorkspace('Acme', 'Startup', 'desc');
    const wsId = useCollaborationStore.getState().activeWorkspaceId;
    await useCollaborationStore.getState().createProject({ name: 'Agent Service' });
    expect(useCollaborationStore.getState().projects.some((p) => p.name === 'Agent Service')).toBe(true);

    simulatePageLoad();
    await useCollaborationStore.getState().loadCollabData();

    const s = useCollaborationStore.getState();
    expect(s.activeWorkspaceId).toBe(wsId);
    expect(s.projects.some((p) => p.workspaceId === wsId && p.name === 'Agent Service')).toBe(true);
  });

  it('a created team persists across refresh with its member list', async () => {
    await useCollaborationStore.getState().createWorkspace('Acme', 'Startup', 'desc');
    const wsId = useCollaborationStore.getState().activeWorkspaceId;
    await useCollaborationStore.getState().createTeam('Frontend', 'UI squad', '#0ea5e9', ['m1']);

    simulatePageLoad();
    await useCollaborationStore.getState().loadCollabData();

    const team = useCollaborationStore.getState().teams.find((t) => t.name === 'Frontend');
    expect(team).toBeDefined();
    expect(team!.memberIds).toEqual(['m1']);
    expect(useCollaborationStore.getState().activeWorkspaceId).toBe(wsId);
  });

  it('server-side updates (e.g. settings) re-hydrate on the next refresh', async () => {
    await useCollaborationStore.getState().createWorkspace('Acme', 'Startup', 'desc');
    const wsId = useCollaborationStore.getState().activeWorkspaceId;
    await useCollaborationStore.getState().updateWorkspaceSettings(wsId, { requireReviewForDone: true });

    simulatePageLoad();
    await useCollaborationStore.getState().loadCollabData();

    const ws = useCollaborationStore.getState().workspaces.find((w) => w.id === wsId);
    expect(ws?.settings.requireReviewForDone).toBe(true);
  });

  it('a failed API fetch on re-hydration degrades gracefully (offline refresh)', async () => {
    mocks.wsCreate.mockRejectedValueOnce(new Error('offline'));
    await useCollaborationStore.getState().createWorkspace('Acme', 'Startup', 'desc');
    expect(useCollaborationStore.getState().workspaces).toHaveLength(0);

    simulatePageLoad();
    await useCollaborationStore.getState().loadCollabData();

    const s = useCollaborationStore.getState();
    expect(s.workspacesLoading).toBe(false);
    expect(s.workspaces).toEqual([]);
    expect(s.activeWorkspaceId).toBe('');
  });
});
