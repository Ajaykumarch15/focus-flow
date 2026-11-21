// IES-P0-22: VITE_API_URL is required — no silent localhost fallback.
// The build fails loudly when it is missing (see vite.config.ts requireApiUrl)
// and its type is declared in src/vite-env.d.ts.
import type {
  GitContext,
  SearchResults,
  ProjectPatch,
} from '@shared/types/apiCompat';
import type {
  RoadmapListItem,
  RoadmapDetail,
  RoadmapPhaseDoc,
  RoadmapPhaseStatus,
  RoadmapMilestoneStatus,
  RoadmapMilestoneDoc,
  RoadmapType,
} from '@personal/types/roadmap';
import type { FutureGoal } from '@personal/types/futureGoal';
import type { FocusFlowBackup, BackupImportResult } from '@shared/types/backup';
import type { PublicProfile, ProfileStats } from '@shared/types';

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
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    // Server nests errors as { error: { code, message } } (see errorHandler.js);
    // fall back to a top-level `message` for compatibility.
    const msg =
      (data?.error?.message as string | undefined) ||
      (data?.message as string | undefined) ||
      `HTTP ${res.status}`;
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

  users: {
    list: () => request<any[]>('/users'),
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
    // EEP2-P5.1.2: batch reorder — ids in display order; the server assigns each
    // task's `order` its index (single-scope batches only).
    reorder: (ids: string[]) =>
      request<any[]>(`/tasks/reorder`, { method: 'POST', body: JSON.stringify({ ids }) }),
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
    getPublic: (userId: string) => request<PublicProfile>(`/profile/${userId}`),
    getStats: (userId: string) => request<ProfileStats>(`/profile/${userId}/stats`),
  },

  workLogs: {
    list: (active?: boolean) => {
      const qs = active !== undefined ? `?active=${active}` : '';
      return request<any[]>(`/worklogs${qs}`);
    },
    // EEP2-P5.4.1: task-scoped persisted worklog rows for the sprint board panel.
    byTask: (taskId: string) => request<any[]>(`/worklogs/by-task/${taskId}`),
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

  projects: {
    list: (workspaceId?: string) => {
      const qs = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
      return request<any[]>(`/projects${qs}`);
    },
    create: (data: { name: string; workspaceId?: string; description?: string; members?: Array<{ userId: string; role?: string; isProjectManager?: boolean }> }) =>
      request<any>('/projects', { method: 'POST', body: JSON.stringify(data) }),
    // EEP2-P2.2.1/P2.2.2: single-project read + Project Info PATCH.
    get: (id: string) => request<any>(`/projects/${id}`),
    update: (id: string, data: ProjectPatch) =>
      request<any>(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    syncDrive: (id: string) => request<any>(`/projects/${id}/sync-drive`, { method: 'POST' }),
    addMember: (id: string, data: { email?: string; userId?: string; role: string; isProjectManager?: boolean }) =>
      request<any>(`/projects/${id}/members`, { method: 'POST', body: JSON.stringify(data) }),
    updateMemberRole: (id: string, userId: string, data: { role: string; isProjectManager?: boolean }) =>
      request<any>(`/projects/${id}/members/${userId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    removeMember: (id: string, userId: string) =>
      request<any>(`/projects/${id}/members/${userId}`, { method: 'DELETE' }),
    remove: (id: string) => request<any>(`/projects/${id}`, { method: 'DELETE' }),
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

  // ── Personal Roadmaps (isolated) ───────────────────────────────────────────
  personalRoadmaps: {
    list: () => request<RoadmapListItem[]>('/personal-roadmaps'),
    analytics: (days?: number, from?: string, to?: string) => {
      const params = new URLSearchParams();
      if (from && to) {
        params.set('from', from);
        params.set('to', to);
      } else if (days && days > 0) {
        params.set('days', String(days));
      }
      const q = params.toString() ? `?${params.toString()}` : '';
      return request<any>(`/personal-roadmaps/analytics${q}`);
    },
    get: (id: string) => request<RoadmapDetail>(`/personal-roadmaps/${id}`),
    create: (body: {
      title: string;
      description?: string;
      type?: RoadmapType;
      startDate?: string;
      targetDate?: string;
      icon?: string;
      color?: string;
    }) => request<RoadmapListItem>('/personal-roadmaps', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Record<string, any>) =>
      request<RoadmapListItem>(`/personal-roadmaps/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    remove: (id: string) => request<{ message: string }>(`/personal-roadmaps/${id}`, { method: 'DELETE' }),

    // Phases
    listPhases: (roadmapId: string) =>
      request<RoadmapPhaseDoc[]>(`/personal-roadmaps/${roadmapId}/phases`),
    createPhase: (roadmapId: string, body: {
      title: string;
      description?: string;
      order?: number;
      status?: RoadmapPhaseStatus;
      startDate?: string;
      targetDate?: string;
    }) => request<RoadmapPhaseDoc>(`/personal-roadmaps/${roadmapId}/phases`, { method: 'POST', body: JSON.stringify(body) }),
    updatePhase: (id: string, body: Record<string, any>) =>
      request<RoadmapPhaseDoc>(`/personal-roadmaps/phases/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    removePhase: (id: string) => request<{ message: string }>(`/personal-roadmaps/phases/${id}`, { method: 'DELETE' }),
    reorderPhases: (roadmapId: string, phaseIds: string[]) =>
      request<{ message: string }>(`/personal-roadmaps/${roadmapId}/phases/reorder`, { method: 'POST', body: JSON.stringify({ phaseIds }) }),

    // Milestones
    listMilestones: (phaseId: string) =>
      request<RoadmapMilestoneDoc[]>(`/personal-roadmaps/phases/${phaseId}/milestones`),
    createMilestone: (phaseId: string, body: {
      title: string;
      description?: string;
      order?: number;
      status?: RoadmapMilestoneStatus;
      targetDate?: string;
    }) => request<RoadmapMilestoneDoc>(`/personal-roadmaps/phases/${phaseId}/milestones`, { method: 'POST', body: JSON.stringify(body) }),
    updateMilestone: (id: string, body: Record<string, any>) =>
      request<RoadmapMilestoneDoc>(`/personal-roadmaps/milestones/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    removeMilestone: (id: string) => request<{ message: string }>(`/personal-roadmaps/milestones/${id}`, { method: 'DELETE' }),
    reorderMilestones: (phaseId: string, milestoneIds: string[]) =>
      request<{ message: string }>(`/personal-roadmaps/phases/${phaseId}/milestones/reorder`, { method: 'POST', body: JSON.stringify({ milestoneIds }) }),

    // Task linking
    availableTasks: () => request<any[]>('/personal-roadmaps/available-tasks'),
    linkTask: (body: { taskId: string; roadmapId: string; phaseId: string; milestoneId: string }) =>
      request<any>('/personal-roadmaps/link-task', { method: 'POST', body: JSON.stringify(body) }),
    unlinkTask: (taskId: string) =>
      request<{ message: string }>(`/personal-roadmaps/unlink-task/${taskId}`, { method: 'DELETE' }),

    // Generator
    generate: (body: any) =>
      request<{ plan: any; warnings: any[] }>('/personal-roadmaps/generate', { method: 'POST', body: JSON.stringify(body) }),
    importPlan: (body: { plan: any }) =>
      request<{ roadmapId: string; title: string; phaseCount: number; milestoneCount: number; taskCount: number }>(
        '/personal-roadmaps/import',
        { method: 'POST', body: JSON.stringify(body) }
      ),
  },

  schedules: {
    list: (params?: { date?: string; from?: string; to?: string }) => {
      const qs = new URLSearchParams();
      if (params?.date) qs.set('date', params.date);
      if (params?.from) qs.set('from', params.from);
      if (params?.to) qs.set('to', params.to);
      const query = qs.toString() ? `?${qs.toString()}` : '';
      return request<import('../types').ScheduleItem[]>(`/schedules${query}`);
    },
    listWorkspace: (params: {
      workspaceId: string;
      projectId?: string;
      date?: string;
      from?: string;
      to?: string;
      userIds?: string[];
    }) => {
      const qs = new URLSearchParams();
      qs.set('workspaceId', params.workspaceId);
      if (params.projectId) qs.set('projectId', params.projectId);
      if (params.date) qs.set('date', params.date);
      if (params.from) qs.set('from', params.from);
      if (params.to) qs.set('to', params.to);
      if (params.userIds?.length) qs.set('userIds', params.userIds.join(','));
      return request<import('../types').ScheduleItem[]>(`/schedules?${qs.toString()}`);
    },
    listTeam: (params: { workspaceId: string; date?: string; from?: string; to?: string }) => {
      const qs = new URLSearchParams();
      qs.set('workspaceId', params.workspaceId);
      if (params.date) qs.set('date', params.date);
      if (params.from) qs.set('from', params.from);
      if (params.to) qs.set('to', params.to);
      return request<import('../types').ScheduleItem[]>(`/schedules/team?${qs.toString()}`);
    },
    create: (payload: import('../types').ScheduleCreatePayload) =>
      request<{ schedule: import('../types').ScheduleItem; warning?: string }>('/schedules', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    update: (id: string, payload: import('../types').ScheduleUpdatePayload) =>
      request<{ schedule: import('../types').ScheduleItem; warning?: string }>(`/schedules/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    delete: (id: string) =>
      request<{ success: boolean; message: string }>(`/schedules/${id}`, {
        method: 'DELETE',
      }),
  },

  personalTasks: {
    list: () => request<any[]>('/personal-tasks'),
    create: (body: any) => request<any>('/personal-tasks', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: any) => request<any>(`/personal-tasks/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: string) => request<any>(`/personal-tasks/${id}`, { method: 'DELETE' }),
    patchGit: (id: string, gitContext: GitContext) =>
      request<any>(`/personal-tasks/${id}/git`, { method: 'PATCH', body: JSON.stringify(gitContext) }),
    addSubtask: (taskId: string, title: string) =>
      request<any>(`/personal-tasks/${taskId}/subtasks`, { method: 'POST', body: JSON.stringify({ title }) }),
    toggleSubtask: (taskId: string, subId: string, completed: boolean) =>
      request<any>(`/personal-tasks/${taskId}/subtasks/${subId}`, { method: 'PATCH', body: JSON.stringify({ completed }) }),
    deleteSubtask: (taskId: string, subId: string) =>
      request<any>(`/personal-tasks/${taskId}/subtasks/${subId}`, { method: 'DELETE' }),
    reorder: (ids: string[]) =>
      request<any[]>('/personal-tasks/reorder', { method: 'POST', body: JSON.stringify({ ids }) }),
  },

  personalSessions: {
    list: (params?: { personalTaskId?: string; active?: boolean }) => {
      const qs = params
        ? new URLSearchParams(
            Object.entries(params).reduce<Record<string, string>>((acc, [key, value]) => {
              if (value !== undefined) acc[key] = String(value);
              return acc;
            }, {}),
          ).toString()
        : '';
      return request<any[]>(`/personal-sessions${qs ? '?' + qs : ''}`);
    },
    start: (personalTaskId: string, startTime?: number, opId?: string) =>
      request<any>('/personal-sessions', {
        method: 'POST',
        body: JSON.stringify({
          personalTaskId,
          ...(startTime !== undefined ? { startTime } : {}),
          ...(opId ? { opId } : {}),
        }),
      }),
    pause: (id: string, pauseTime?: number, opId?: string) =>
      request<any>(`/personal-sessions/${id}/pause`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...(pauseTime !== undefined ? { pauseTime } : {}),
          ...(opId ? { opId } : {}),
        }),
      }),
    resume: (id: string, resumeTime?: number, opId?: string) =>
      request<any>(`/personal-sessions/${id}/resume`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...(resumeTime !== undefined ? { resumeTime } : {}),
          ...(opId ? { opId } : {}),
        }),
      }),
    stop: (id: string, endTime?: number, opId?: string) =>
      request<any>(`/personal-sessions/${id}/stop`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...(endTime !== undefined ? { endTime } : {}),
          ...(opId ? { opId } : {}),
        }),
      }),
    heartbeat: (id: string) =>
      request<any>(`/personal-sessions/${id}/heartbeat`, { method: 'PATCH' }),
  },

  officeWorkTime: {
    today: (date: string) => request<any>(`/office-work-time/today?date=${encodeURIComponent(date)}`),
    analytics: (from: string, to: string) => request<Array<{ date: string; totalMs: number }>>(
      `/office-work-time/analytics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),
    toggle: (date: string) => request<any>('/office-work-time/toggle', {
      method: 'POST', body: JSON.stringify({ date }),
    }),
  },

  backup: {
    exportData: () => request<FocusFlowBackup>('/backup/export', { method: 'POST' }),
    importData: (payload: FocusFlowBackup) =>
      request<BackupImportResult>('/backup/import', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },

  personalFutureGoals: {
    list: (params?: { status?: string; category?: string }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set('status', params.status);
      if (params?.category) qs.set('category', params.category);
      const q = qs.toString() ? `?${qs.toString()}` : '';
      return request<FutureGoal[]>(`/personal-future-goals${q}`);
    },
    get: (id: string) => request<FutureGoal>(`/personal-future-goals/${id}`),
    create: (body: { title: string; description?: string; category?: string; color?: string }) =>
      request<FutureGoal>('/personal-future-goals', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Record<string, any>) =>
      request<FutureGoal>(`/personal-future-goals/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    remove: (id: string) =>
      request<{ message: string }>(`/personal-future-goals/${id}`, { method: 'DELETE' }),
    review: (id: string) =>
      request<FutureGoal>(`/personal-future-goals/${id}/review`, { method: 'PATCH' }),
    getReviewGoals: () =>
      request<FutureGoal[]>('/personal-future-goals/review'),
    startGoal: (id: string) =>
      request<{ roadmapId: string; title: string; goal: FutureGoal }>(`/personal-future-goals/${id}/start`, { method: 'POST' }),
  },

  meetings: {
    list: (params?: { from?: string; to?: string; status?: string }) => {
      const qs = new URLSearchParams();
      if (params?.from) qs.set('from', params.from);
      if (params?.to) qs.set('to', params.to);
      if (params?.status) qs.set('status', params.status);
      const query = qs.toString() ? `?${qs.toString()}` : '';
      return request<import('../../modules/meetings/types/meeting').Meeting[]>(`/meetings${query}`);
    },
    today: () => request<import('../../modules/meetings/types/meeting').Meeting[]>('/meetings/today'),
    get: (id: string) => request<import('../../modules/meetings/types/meeting').Meeting>(`/meetings/${id}`),
    create: (body: import('../../modules/meetings/types/meeting').MeetingCreatePayload) =>
      request<import('../../modules/meetings/types/meeting').Meeting>('/meetings', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    update: (id: string, body: import('../../modules/meetings/types/meeting').MeetingUpdatePayload) =>
      request<import('../../modules/meetings/types/meeting').Meeting>(`/meetings/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    updateStatus: (id: string, status: import('../../modules/meetings/types/meeting').MeetingStatus) =>
      request<import('../../modules/meetings/types/meeting').Meeting>(`/meetings/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    addParticipant: (id: string, userId: string) =>
      request<import('../../modules/meetings/types/meeting').Meeting>(`/meetings/${id}/participants`, {
        method: 'POST',
        body: JSON.stringify({ userId }),
      }),
    removeParticipant: (id: string, userId: string) =>
      request<import('../../modules/meetings/types/meeting').Meeting>(`/meetings/${id}/participants/${userId}`, {
        method: 'DELETE',
      }),
    delete: (id: string) =>
      request<{ success: boolean; message: string }>(`/meetings/${id}`, {
        method: 'DELETE',
      }),
  },


};

