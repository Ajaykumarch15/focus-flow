import { afterEach, describe, it, expect, vi } from 'vitest';
import { api } from '../api';

describe('collaboration API client (IES-P2-05/06)', () => {
  it('exposes the real, user-scoped notifications surface', () => {
    expect(typeof api.notifications.list).toBe('function');
    expect(typeof api.notifications.unreadCount).toBe('function');
    expect(typeof api.notifications.markRead).toBe('function');
    expect(typeof api.notifications.markAllRead).toBe('function');
  });

  it('exposes the real global + workspace search surface', () => {
    expect(typeof api.search.run).toBe('function');
  });

  it('still exposes the real workspace activity feed', () => {
    expect(typeof api.workspaces.activity).toBe('function');
  });
});

// IES-R1: Phase 3 collaboration routes must be reachable through the typed client.
describe('collaboration API client (IES-R1 Phase 3 routes)', () => {
  const fetchMock = vi.fn();

  function stubOk(body: unknown) {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => body,
    } as unknown as Response);
  }

  afterEach(() => {
    fetchMock.mockReset();
  });

  it('exposes the sprints and features surfaces', () => {
    expect(typeof api.sprints.list).toBe('function');
    expect(typeof api.sprints.create).toBe('function');
    expect(typeof api.sprints.update).toBe('function');
    expect(typeof api.sprints.remove).toBe('function');
    expect(typeof api.sprints.commit).toBe('function');
    expect(typeof api.features.list).toBe('function');
    expect(typeof api.features.create).toBe('function');
    expect(typeof api.features.update).toBe('function');
    expect(typeof api.features.remove).toBe('function');
    expect(typeof api.tasks.patchGit).toBe('function');
  });

  it('lists sprints scoped to a project', async () => {
    stubOk([]);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await api.sprints.list('proj_1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/sprints?projectId=proj_1');
    expect(init.method).toBeUndefined();
  });

  it('creates a sprint with the typed payload', async () => {
    stubOk({ id: 's1', projectId: 'p1', name: 'S1' });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await api.sprints.create({ projectId: 'p1', name: 'S1', startDate: '2026-01-01', endDate: '2026-01-07' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/sprints');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toMatchObject({
      projectId: 'p1',
      name: 'S1',
      startDate: '2026-01-01',
      endDate: '2026-01-07',
    });
  });

  it('commits a sprint through the Owner/Admin commitment endpoint', async () => {
    stubOk({ id: 's1', committed: true, commitmentDate: '2026-08-06T00:00:00.000Z' });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await api.sprints.commit('s1');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/sprints/s1/commit');
    expect(init.method).toBe('POST');
  });

  it('lists features with backlog/sprint/type/status filters', async () => {
    stubOk([]);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await api.features.list({ projectId: 'p1', backlog: true, type: 'bug', status: 'ready' });
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/features?projectId=p1&backlog=true&type=bug&status=ready');
  });

  it('removes a feature via DELETE', async () => {
    stubOk({ message: 'deleted' });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await api.features.remove('f1');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/features/f1');
    expect(init.method).toBe('DELETE');
  });

  it('lists workspace-scoped collaborative tasks', async () => {
    stubOk([]);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await api.tasks.list({ workspaceId: 'w1', projectId: 'p1', sprintId: 's1', featureId: 'f1' });
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/tasks?workspaceId=w1&projectId=p1&sprintId=s1&featureId=f1');
  });

  it('falls back to the personal task list when no collab filters are given', async () => {
    stubOk([]);
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await api.tasks.list();
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/tasks');
  });

  it('persists gitContext via PATCH /tasks/:id/git', async () => {
    stubOk({});
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await api.tasks.patchGit('t1', { repository: 'r', branch: 'main', prNumber: 3 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/tasks/t1/git');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toMatchObject({ repository: 'r', branch: 'main', prNumber: 3 });
  });
});
