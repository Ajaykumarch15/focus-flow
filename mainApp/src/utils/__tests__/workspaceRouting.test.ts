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
    expect(deriveWorkspaceFromPath('/personal/roadmaps')).toBe('personal');
    expect(deriveWorkspaceFromPath('/personal/analytics')).toBe('personal');
  });

  it('maps admin routes to admin', () => {
    expect(deriveWorkspaceFromPath('/admin/audit')).toBe('admin');
    expect(deriveWorkspaceFromPath('/admin')).toBe('admin');
  });

  it('maps collaboration routes to collab', () => {
    expect(deriveWorkspaceFromPath('/collab/leaderboard')).toBe('collab');
    expect(deriveWorkspaceFromPath('/collab/activity')).toBe('collab');
    expect(deriveWorkspaceFromPath('/w/ws-1/projects/p1')).toBe('collab');
    expect(deriveWorkspaceFromPath('/team')).toBe('collab');
    expect(deriveWorkspaceFromPath('/collab/dashboard')).toBe('collab');
    expect(deriveWorkspaceFromPath('/workspace')).toBe('collab');
  });

  it('returns null for the homepage (workspace switcher)', () => {
    expect(deriveWorkspaceFromPath('/home')).toBeNull();
  });

  it('maps worklog/card-based routes to work', () => {
    expect(deriveWorkspaceFromPath('/worklog/dashboard')).toBe('work');
    expect(deriveWorkspaceFromPath('/worklog/tasks')).toBe('work');
    expect(deriveWorkspaceFromPath('/worklog/logs')).toBe('work');
    expect(deriveWorkspaceFromPath('/worklog/focus')).toBe('work');
    expect(deriveWorkspaceFromPath('/worklog/reports')).toBe('work');
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
    const ws = deriveWorkspaceFromPath('/worklog/logs');
    h.useWorkspaceStore.getState().setWorkspace(ws);
    h.useAuthStore.getState().setWorkspace(ws);

    expect(h.useWorkspaceStore.getState().setWorkspace).toHaveBeenCalledWith('work');
    expect(h.useAuthStore.getState().setWorkspace).toHaveBeenCalledWith('work');
  });
});
