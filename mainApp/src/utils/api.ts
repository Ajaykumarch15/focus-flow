// IES-P0-22: VITE_API_URL is required — no silent localhost fallback.
// The build fails loudly when it is missing (see vite.config.ts requireApiUrl)
// and its type is declared in src/vite-env.d.ts.
import type {
  Feature,
  GitContext,
  Sprint,
  WorkspaceActivity,
  NotificationItem,
  SearchResults,
} from '../types/collaboration';

const BASE = import.meta.env.VITE_API_URL;

type ApiUser = {
  _id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  avatar?: string;
  settings: Record<string, any>;
};

// IES-P1-18: admin list endpoints are cursor-paginated.
type Paginated<T> = {
  items: T[];
  hasMore: boolean;
  nextCursor: string | null;
};

// ── IES-R1: Phase 3 collaboration payloads (routes in server/routes). ─────────
// Collaborative task refs mirror CollaborativeTask in src/types/collaboration.ts;
// only id refs are sent to the API — workspaceId/projectId/sprintId/featureId.
export type TaskCollabRefs = {
  workspaceId?: string;
  projectId?: string;
  sprintId?: string;
  featureId?: string;
};

export type TaskListParams = TaskCollabRefs;

export type SprintCreatePayload = {
  projectId: string;
  name: string;
  startDate: string | number;
  endDate: string | number;
  goal?: string;
  capacityHours?: number;
  targetVelocity?: number;
};

export type SprintUpdatePayload = Partial<Omit<SprintCreatePayload, 'projectId'>> & {
  status?: 'future' | 'active' | 'completed';
};

export type FeatureCreatePayload = {
  projectId: string;
  name: string;
  description?: string;
  type?: Feature['type'];
  labels?: string[];
  ownerId?: string;
  estimatedHours?: number;
  status?: Feature['status'];
  order?: number;
  sprintId?: string | null;
};

export type FeatureUpdatePayload = Partial<Omit<FeatureCreatePayload, 'projectId'>> & {
  sprintId?: string | null;
};

// IES-P0-12: the session JWT lives in an httpOnly cookie; `credentials: 'include'`
// makes the browser attach it to every request (cross-origin in dev).
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (data as { message?: string }).message || `HTTP ${res.status}`;
    // A 401 is the routine "no session / not authenticated" signal (e.g. the
    // boot-time /auth/me check on the public landing page). It is handled by the
    // caller (useAuthStore.restoreSession) and represents an anonymous visitor,
    // not a real error — so keep the console quiet instead of spamming it.
    if (res.status !== 401) {
      console.error(`API Error [${res.status}] ${options.method || 'GET'} ${path}:`, msg);
    }
    throw new Error(msg);
  }
  return data as T;
}

export const api = {
  auth: {
    register: (name: string, email: string, password: string) =>
      request<{ user: ApiUser }>('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
    login: (email: string, password: string) =>
      request<{ user: ApiUser }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    me: () => request<{ user: ApiUser }>('/auth/me'),
    logout: () => request<{ message: string }>('/auth/logout', { method: 'POST' }),
  },

  tasks: {
    // IES-R1: optional collab filters hit the workspace-scoped GET /tasks
    // (member-gated); omitted, it stays the personal task list.
    list: (params?: TaskListParams) => {
      const qs = new URLSearchParams();
      if (params?.workspaceId) qs.set('workspaceId', params.workspaceId);
      if (params?.projectId) qs.set('projectId', params.projectId);
      if (params?.sprintId) qs.set('sprintId', params.sprintId);
      if (params?.featureId) qs.set('featureId', params.featureId);
      const s = qs.toString();
      return request<any[]>(`/tasks${s ? '?' + s : ''}`);
    },
    create: (body: any) => request<any>('/tasks', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: any) => request<any>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: string) => request<any>(`/tasks/${id}`, { method: 'DELETE' }),
    // IES-R1: persist gitContext on a collaborative task (PATCH /tasks/:id/git).
    patchGit: (id: string, gitContext: GitContext) =>
      request<any>(`/tasks/${id}/git`, { method: 'PATCH', body: JSON.stringify(gitContext) }),
    addSubtask: (taskId: string, title: string) =>
      request<any>(`/tasks/${taskId}/subtasks`, { method: 'POST', body: JSON.stringify({ title }) }),
    toggleSubtask: (taskId: string, subId: string, completed: boolean) =>
      request<any>(`/tasks/${taskId}/subtasks/${subId}`, { method: 'PATCH', body: JSON.stringify({ completed }) }),
    deleteSubtask: (taskId: string, subId: string) =>
      request<any>(`/tasks/${taskId}/subtasks/${subId}`, { method: 'DELETE' }),
  },

  sessions: {
    list: (params?: { taskId?: string; active?: boolean }) => {
      const qs = params
        ? new URLSearchParams(
            Object.entries(params).reduce<Record<string, string>>((acc, [key, value]) => {
              if (value !== undefined) acc[key] = String(value);
              return acc;
            }, {}),
          ).toString()
        : '';
      return request<any[]>(`/sessions${qs ? '?' + qs : ''}`);
    },
    // IES-P1-05: optional `opId` is the idempotency key offline replays reuse;
    // omitting a timestamp lets the server clock govern (no fabricated time).
    start: (taskId: string, startTime?: number, opId?: string) =>
      request<any>('/sessions', {
        method: 'POST',
        body: JSON.stringify({
          taskId,
          ...(startTime !== undefined ? { startTime } : {}),
          ...(opId ? { opId } : {}),
        }),
      }),
    pause: (id: string, pauseTime?: number, opId?: string) =>
      request<any>(`/sessions/${id}/pause`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...(pauseTime !== undefined ? { pauseTime } : {}),
          ...(opId ? { opId } : {}),
        }),
      }),
    resume: (id: string, resumeTime?: number, opId?: string) =>
      request<any>(`/sessions/${id}/resume`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...(resumeTime !== undefined ? { resumeTime } : {}),
          ...(opId ? { opId } : {}),
        }),
      }),
    stop: (id: string, endTime?: number, opId?: string) =>
      request<any>(`/sessions/${id}/stop`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...(endTime !== undefined ? { endTime } : {}),
          ...(opId ? { opId } : {}),
        }),
      }),
    // IES-P1-26: liveness beat so the server's reaper never closes a live timer
    // as a zombie. Fire-and-forget; a dropped beat is retried on the next tick.
    heartbeat: (id: string) =>
      request<any>(`/sessions/${id}/heartbeat`, { method: 'PATCH' }),
  },

  journals: {
    list: (taskId?: string) => {
      const qs = new URLSearchParams();
      if (taskId) qs.set('taskId', taskId);
      return request<any[]>(`/journals${qs.size ? '?' + qs : ''}`);
    },
    create: (body: any) => request<any>('/journals', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: any) => request<any>(`/journals/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: string) => request<any>(`/journals/${id}`, { method: 'DELETE' }),
  },

  profile: {
    get: () => request<any>('/profile'),
    update: (body: any) => request<any>('/profile', { method: 'PATCH', body: JSON.stringify(body) }),
  },

  workLogs: {
    list: (active?: boolean) => {
      const qs = active !== undefined ? `?active=${active}` : '';
      return request<any[]>(`/worklogs${qs}`);
    },
    get: (id: string) => request<any>(`/worklogs/${id}`),
    create: (body: any) => request<any>('/worklogs', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: any) => request<any>(`/worklogs/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: string) => request<any>(`/worklogs/${id}`, { method: 'DELETE' }),
    close: (id: string) => request<any>(`/worklogs/${id}/close`, { method: 'POST' }),
    continue: (id: string) => request<any>(`/worklogs/${id}/continue`, { method: 'POST' }),
    linkTask: (id: string, taskRef?: string) =>
      request<any>(`/worklogs/${id}/task`, { method: 'PATCH', body: JSON.stringify({ taskRef }) }),

    // ── NEW: sync session time into work entries ────────────────────────────
    syncTime: (id: string) =>
      request<any>(`/worklogs/${id}/sync-time`, { method: 'POST' }),

    // ── NEW: update "what I did" text for a specific day ───────────────────
    updateEntry: (id: string, entryId: string, what: string) =>
      request<any>(`/worklogs/${id}/entries/${entryId}`, {
        method: 'PATCH',
        body: JSON.stringify({ what }),
      }),

    addCompleted: (id: string, text: string, category?: string) =>
      request<any>(`/worklogs/${id}/completed`, { method: 'POST', body: JSON.stringify({ text, category }) }),
    deleteCompleted: (id: string, itemId: string) =>
      request<any>(`/worklogs/${id}/completed/${itemId}`, { method: 'DELETE' }),
    addLink: (id: string, label: string, url: string, category?: string) =>
      request<any>(`/worklogs/${id}/links`, { method: 'POST', body: JSON.stringify({ label, url, category }) }),
    deleteLink: (id: string, linkId: string) =>
      request<any>(`/worklogs/${id}/links/${linkId}`, { method: 'DELETE' }),

    // ── Phase X Sub-documents ──────────────────────────────────────────────
    addTimeline: (id: string, entry: any) =>
      request<any>(`/worklogs/${id}/timeline`, { method: 'POST', body: JSON.stringify(entry) }),
    addDecision: (id: string, decision: any) =>
      request<any>(`/worklogs/${id}/decisions`, { method: 'POST', body: JSON.stringify(decision) }),
    deleteDecision: (id: string, decId: string) =>
      request<any>(`/worklogs/${id}/decisions/${decId}`, { method: 'DELETE' }),
    addBlocker: (id: string, blocker: any) =>
      request<any>(`/worklogs/${id}/blockers`, { method: 'POST', body: JSON.stringify(blocker) }),
    updateBlocker: (id: string, blkId: string, updates: any) =>
      request<any>(`/worklogs/${id}/blockers/${blkId}`, { method: 'PATCH', body: JSON.stringify(updates) }),
    deleteBlocker: (id: string, blkId: string) =>
      request<any>(`/worklogs/${id}/blockers/${blkId}`, { method: 'DELETE' }),
    addSnapshot: (id: string, snapshot: any) =>
      request<any>(`/worklogs/${id}/snapshots`, { method: 'POST', body: JSON.stringify(snapshot) }),
    deleteSnapshot: (id: string, snapId: string) =>
      request<any>(`/worklogs/${id}/snapshots/${snapId}`, { method: 'DELETE' }),
    addAttachment: (id: string, attachment: any) =>
      request<any>(`/worklogs/${id}/attachments`, { method: 'POST', body: JSON.stringify(attachment) }),
    deleteAttachment: (id: string, attId: string) =>
      request<any>(`/worklogs/${id}/attachments/${attId}`, { method: 'DELETE' }),
  },

  habits: {
    list: () => request<any[]>('/habits'),
    create: (body: any) => request<any>('/habits', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: any) => request<any>(`/habits/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: string) => request<any>(`/habits/${id}`, { method: 'DELETE' }),
    addChecklistItem: (id: string, text: string) =>
      request<any>(`/habits/${id}/checklist`, { method: 'POST', body: JSON.stringify({ text }) }),
    updateChecklistItem: (id: string, itemId: string, body: any) =>
      request<any>(`/habits/${id}/checklist/${itemId}`, { method: 'PATCH', body: JSON.stringify(body) }),
    deleteChecklistItem: (id: string, itemId: string) =>
      request<any>(`/habits/${id}/checklist/${itemId}`, { method: 'DELETE' }),
    updateToday: (id: string, body: any) =>
      request<any>(`/habits/${id}/today`, { method: 'PATCH', body: JSON.stringify(body) }),
  },

  reports: {
    summary: (from?: string, to?: string) => {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      return request<any[]>(`/reports/summary?${params}`);
    },
    day: (date: string) => {
      const params = new URLSearchParams({ date });
      return request<any>(`/reports/day?${params}`);
    },
    createShare: (date: string, expiresInDays = 30) =>
      request<any>('/reports/share', { method: 'POST', body: JSON.stringify({ date, expiresInDays }) }),
    revokeShare: (token: string) =>
      request<any>(`/reports/share/${encodeURIComponent(token)}/revoke`, { method: 'POST' }),
    shareToken: (token: string) =>
      request<any>(`/reports/share/token/${encodeURIComponent(token)}`),
    leaderboard: () => request<any[]>('/reports/leaderboard'),
  },

  admin: {
    getStats: () => request<any>('/admin/stats'),
    listUsers: (includeDeleted?: boolean, cursor?: string, limit?: number) => {
      const params = new URLSearchParams();
      if (includeDeleted) params.set('includeDeleted', 'true');
      if (cursor) params.set('cursor', cursor);
      if (limit) params.set('limit', String(limit));
      const qs = params.toString();
      return request<Paginated<any>>(`/admin/users${qs ? '?' + qs : ''}`);
    },
    listDeletedUsers: (cursor?: string, limit?: number) => {
      const params = new URLSearchParams();
      if (cursor) params.set('cursor', cursor);
      if (limit) params.set('limit', String(limit));
      const qs = params.toString();
      return request<Paginated<any>>(`/admin/users/deleted${qs ? '?' + qs : ''}`);
    },
    createUser: (data: { name: string; email: string; password?: string; role?: string; teamId?: string; projectId?: string }) =>
      request<any>('/admin/users', { method: 'POST', body: JSON.stringify(data) }),
    updateUser: (userId: string, data: { name?: string; email?: string; role?: string; status?: string; teamId?: string }) =>
      request<any>(`/admin/users/${userId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteUser: (userId: string) =>
      request<any>(`/admin/users/${userId}`, { method: 'DELETE' }),
    restoreUser: (userId: string) =>
      request<any>(`/admin/users/${userId}/restore`, { method: 'POST' }),
    getSystemAnalytics: (period?: string) => {
      const qs = period ? `?period=${period}` : '';
      return request<any>(`/admin/system-analytics${qs}`);
    },
    getActivity: (limit?: number, cursor?: string, action?: string, before?: string) => {
      const params = new URLSearchParams();
      if (limit) params.set('limit', String(limit));
      if (cursor) params.set('cursor', cursor);
      else if (before) params.set('before', before);
      if (action) params.set('action', action);
      const qs = params.toString();
      return request<Paginated<any>>(`/admin/activity${qs ? '?' + qs : ''}`);
    },
    getUserAnalytics: (userId: string, from?: number, to?: number) => {
      const params = new URLSearchParams();
      if (from) params.set('from', String(from));
      if (to)   params.set('to', String(to));
      const qs = params.toString();
      return request<any>(`/admin/users/${userId}/analytics${qs ? '?' + qs : ''}`);
    },
    getUserReportsSummary: (userId: string, from?: string, to?: string) => {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to)   params.set('to', to);
      const qs = params.toString();
      return request<any[]>(`/admin/users/${userId}/reports/summary${qs ? '?' + qs : ''}`);
    },
    getUserReportDay: (userId: string, date: string) => {
      const params = new URLSearchParams({ date });
      return request<any>(`/admin/users/${userId}/reports/day?${params}`);
    },
  },

  teams: {
    list: () => request<any[]>('/teams'),
    create: (data: { name: string; description?: string; members?: string[]; workspaceId?: string; leaderId?: string; color?: string }) => 
      request<any>('/teams', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { name?: string; description?: string; members?: string[]; leaderId?: string; color?: string }) => 
      request<any>(`/teams/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => 
      request<any>(`/teams/${id}`, { method: 'DELETE' }),
    getAnalytics: (id: string, from?: number, to?: number) => {
      const params = new URLSearchParams();
      if (from) params.set('from', String(from));
      if (to)   params.set('to', String(to));
      const qs = params.toString();
      return request<any>(`/teams/${id}/analytics${qs ? '?' + qs : ''}`);
    },
  },

  projects: {
    list: (workspaceId?: string) => {
      const qs = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
      return request<any[]>(`/projects${qs}`);
    },
    create: (data: { name: string; workspaceId?: string }) =>
      request<any>('/projects', { method: 'POST', body: JSON.stringify(data) }),
    syncDrive: (id: string) => request<any>(`/projects/${id}/sync-drive`, { method: 'POST' }),
  },

  // IES-R1: real Sprint CRUD backed by the Phase 3 route (server/routes/sprints.js).
  sprints: {
    list: (projectId: string) =>
      request<Sprint[]>(`/sprints?projectId=${encodeURIComponent(projectId)}`),
    create: (body: SprintCreatePayload) =>
      request<Sprint>('/sprints', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: SprintUpdatePayload) =>
      request<Sprint>(`/sprints/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    remove: (id: string) =>
      request<{ message: string }>(`/sprints/${id}`, { method: 'DELETE' }),
  },

  // IES-R1: real Feature CRUD backed by the Phase 3 route (server/routes/features.js).
  // Backlog = omit/leave null sprintId; use backlog:true to list backlog features.
  features: {
    list: (params: { projectId: string; sprintId?: string; backlog?: boolean; type?: Feature['type']; status?: Feature['status'] }) => {
      const qs = new URLSearchParams({ projectId: params.projectId });
      if (params.sprintId) qs.set('sprintId', params.sprintId);
      if (params.backlog !== undefined) qs.set('backlog', String(params.backlog));
      if (params.type) qs.set('type', params.type);
      if (params.status) qs.set('status', params.status);
      return request<Feature[]>(`/features?${qs.toString()}`);
    },
    create: (body: FeatureCreatePayload) =>
      request<Feature>('/features', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: FeatureUpdatePayload) =>
      request<Feature>(`/features/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    remove: (id: string) =>
      request<{ message: string }>(`/features/${id}`, { method: 'DELETE' }),
  },

  // IES-P2-01: real workspace CRUD + membership surface (IES-P2-07 wiring).
  workspaces: {
    list: () => request<any[]>('/workspaces'),
    get: (id: string) => request<any>(`/workspaces/${id}`),
    create: (data: { name: string; type?: string; icon?: string; description?: string; settings?: Record<string, any> }) =>
      request<any>('/workspaces', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, any>) =>
      request<any>(`/workspaces/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: string) => request<any>(`/workspaces/${id}`, { method: 'DELETE' }),
    members: (id: string) => request<any[]>(`/workspaces/${id}/members`),
    invite: (id: string, data: { userId?: string; email?: string; role?: string }) =>
      request<any[]>(`/workspaces/${id}/members`, { method: 'POST', body: JSON.stringify(data) }),
    join: (id: string) => request<any>(`/workspaces/${id}/join`, { method: 'POST' }),
    setRole: (id: string, userId: string, role: string) =>
      request<any[]>(`/workspaces/${id}/members/${userId}`, { method: 'PATCH', body: JSON.stringify({ role }) }),
    removeMember: (id: string, userId: string) =>
      request<any[]>(`/workspaces/${id}/members/${userId}`, { method: 'DELETE' }),

    // IES-P2-04: real, workspace-scoped activity feed.
    activity: (id: string, limit?: number, cursor?: string) => {
      const params = new URLSearchParams();
      if (limit) params.set('limit', String(limit));
      if (cursor) params.set('cursor', cursor);
      const qs = params.toString();
      return request<Paginated<WorkspaceActivity>>(`/workspaces/${id}/activity${qs ? '?' + qs : ''}`);
    },
  },

  // IES-P2-05: real, per-user notifications (invite / role change / removal).
  notifications: {
    list: (opts?: { limit?: number; cursor?: string; unreadOnly?: boolean }) => {
      const params = new URLSearchParams();
      if (opts?.limit) params.set('limit', String(opts.limit));
      if (opts?.cursor) params.set('cursor', opts.cursor);
      if (opts?.unreadOnly) params.set('unreadOnly', 'true');
      const qs = params.toString();
      return request<Paginated<NotificationItem>>(`/notifications${qs ? '?' + qs : ''}`);
    },
    unreadCount: () => request<{ count: number }>('/notifications/unread-count'),
    markRead: (id: string) =>
      request<NotificationItem>(`/notifications/${id}/read`, { method: 'PATCH' }),
    markAllRead: () =>
      request<{ updated: number }>('/notifications/read-all', { method: 'PATCH' }),
  },

  // IES-P2-06: global (personal) + workspace-scoped search.
  search: {
    run: (query: string, opts?: { workspaceId?: string; limit?: number }) => {
      const params = new URLSearchParams({ q: query });
      if (opts?.workspaceId) params.set('workspaceId', opts.workspaceId);
      if (opts?.limit) params.set('limit', String(opts.limit));
      return request<SearchResults>(`/search?${params.toString()}`);
    },
  },

  google: {
    getUrl: () => request<{ url: string }>('/auth/google/url'),
    disconnect: () => request<any>('/auth/google/disconnect', { method: 'POST' }),
  },
};
