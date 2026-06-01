const BASE = (import.meta as any).env.VITE_API_URL || 'http://localhost:5001/api';

function getToken(): string | null {
  return localStorage.getItem('ff_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
      request<{ token: string; user: any }>('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
    login: (email: string, password: string) =>
      request<{ token: string; user: any }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    me: () => request<{ user: any }>('/auth/me'),
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
      const qs = new URLSearchParams(params as any).toString();
      return request<any[]>(`/sessions${qs ? '?' + qs : ''}`);
    },
    start: (taskId: string, startTime: number) =>
      request<any>('/sessions', { method: 'POST', body: JSON.stringify({ taskId, startTime }) }),
    pause: (id: string, pauseTime: number) =>
      request<any>(`/sessions/${id}/pause`, { method: 'PATCH', body: JSON.stringify({ pauseTime }) }),
    resume: (id: string, resumeTime: number) =>
      request<any>(`/sessions/${id}/resume`, { method: 'PATCH', body: JSON.stringify({ resumeTime }) }),
    stop: (id: string, endTime: number) =>
      request<any>(`/sessions/${id}/stop`, { method: 'PATCH', body: JSON.stringify({ endTime }) }),
  },

  journals: {
    list: (taskId?: string) => request<any[]>(`/journals${taskId ? '?taskId=' + taskId : ''}`),
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

    // ── NEW: sync session time into work entries ────────────────────────────
    syncTime: (id: string) =>
      request<any>(`/worklogs/${id}/sync-time`, { method: 'POST' }),

    // ── NEW: update "what I did" text for a specific day ───────────────────
    updateEntry: (id: string, entryId: string, what: string) =>
      request<any>(`/worklogs/${id}/entries/${entryId}`, {
        method: 'PATCH',
        body: JSON.stringify({ what }),
      }),

    addCompleted: (id: string, text: string) =>
      request<any>(`/worklogs/${id}/completed`, { method: 'POST', body: JSON.stringify({ text }) }),
    deleteCompleted: (id: string, itemId: string) =>
      request<any>(`/worklogs/${id}/completed/${itemId}`, { method: 'DELETE' }),
    addLink: (id: string, label: string, url: string) =>
      request<any>(`/worklogs/${id}/links`, { method: 'POST', body: JSON.stringify({ label, url }) }),
    deleteLink: (id: string, linkId: string) =>
      request<any>(`/worklogs/${id}/links/${linkId}`, { method: 'DELETE' }),
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
    day: (date: string) => request<any>(`/reports/day?date=${date}`),
    share: (userId: string, date: string) =>
      fetch(`${BASE}/reports/share/${userId}/${date}`).then(r => r.json()) as Promise<any>,
  },
};
