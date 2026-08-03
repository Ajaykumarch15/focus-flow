// IES-P0-22: VITE_API_URL is required — no silent localhost fallback.
// The build fails loudly when it is missing (see vite.config.ts requireApiUrl)
// and its type is declared in src/vite-env.d.ts.
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
    console.error(`API Error [${res.status}] ${options.method || 'GET'} ${path}:`, msg);
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
    list: () => request<any[]>('/tasks'),
    create: (body: any) => request<any>('/tasks', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: any) => request<any>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: string) => request<any>(`/tasks/${id}`, { method: 'DELETE' }),
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
    updateUser: (userId: string, data: { name?: string; email?: string; role?: string }) =>
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
    create: (data: { name: string; description?: string; members?: string[] }) => 
      request<any>('/teams', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { name?: string; description?: string; members?: string[] }) => 
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
    list: () => request<any[]>('/projects'),
    create: (name: string) => request<any>('/projects', { method: 'POST', body: JSON.stringify({ name }) }),
    syncDrive: (id: string) => request<any>(`/projects/${id}/sync-drive`, { method: 'POST' }),
  },

  google: {
    getUrl: () => request<{ url: string }>('/auth/google/url'),
    disconnect: () => request<any>('/auth/google/disconnect', { method: 'POST' }),
  },
};
