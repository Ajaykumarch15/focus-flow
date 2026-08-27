import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  useWorkspaceStore: { getState: vi.fn() },
  useAuthStore: { getState: vi.fn() },
}));

vi.mock('../../store/useWorkspaceStore', () => ({ useWorkspaceStore: h.useWorkspaceStore }));
vi.mock('../../store/useAuthStore', () => ({ useAuthStore: h.useAuthStore }));

import { deriveWorkspaceFromPath } from '../workspaceRouting';

describe('deriveWorkspaceFromPath', () => {
  it('maps personal routes to personal', () => {
    expect(deriveWorkspaceFromPath('/personal')).toBe('personal');
    expect(deriveWorkspaceFromPath('/personal/today')).toBe('personal');
    expect(deriveWorkspaceFromPath('/personal/tasks')).toBe('personal');
  });

  it('maps admin routes to admin', () => {
    expect(deriveWorkspaceFromPath('/admin/audit')).toBe('admin');
    expect(deriveWorkspaceFromPath('/admin')).toBe('admin');
  });

  it('maps collaboration routes to collab', () => {
    expect(deriveWorkspaceFromPath('/hub')).toBe('collab');
    expect(deriveWorkspaceFromPath('/leaderboard')).toBe('collab');
    expect(deriveWorkspaceFromPath('/activity')).toBe('collab');
    expect(deriveWorkspaceFromPath('/w/ws-1/projects/p1')).toBe('collab');
    // Dedicated engineering-workspace routes (TeamProjects, CollabDashboard,
    // WorkspaceSelector) must render the Collaboration nav, not WorkLog.
    expect(deriveWorkspaceFromPath('/team')).toBe('collab');
    expect(deriveWorkspaceFromPath('/collab/dashboard')).toBe('collab');
    expect(deriveWorkspaceFromPath('/workspace')).toBe('collab');
  });

  it('maps worklog/card-based routes to work', () => {
    expect(deriveWorkspaceFromPath('/dashboard')).toBe('work');
    expect(deriveWorkspaceFromPath('/tasks')).toBe('work');
    expect(deriveWorkspaceFromPath('/worklog')).toBe('work');
    expect(deriveWorkspaceFromPath('/focus')).toBe('work');
    expect(deriveWorkspaceFromPath('/reports')).toBe('work');
    expect(deriveWorkspaceFromPath('/settings')).toBe('work');
    expect(deriveWorkspaceFromPath('/')).toBe('work');
  });
});

describe('workspace sync (refreshed state)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates both stores to match the current route', async () => {
    h.useWorkspaceStore.getState.mockReturnValue({ setWorkspace: vi.fn() });
    h.useAuthStore.getState.mockReturnValue({ setWorkspace: vi.fn() });

    // Simulate the WorkspaceSync effect body for a card-based route.
    const ws = deriveWorkspaceFromPath('/worklog');
    h.useWorkspaceStore.getState().setWorkspace(ws);
    h.useAuthStore.getState().setWorkspace(ws);

    expect(h.useWorkspaceStore.getState().setWorkspace).toHaveBeenCalledWith('work');
    expect(h.useAuthStore.getState().setWorkspace).toHaveBeenCalledWith('work');
  });
});
