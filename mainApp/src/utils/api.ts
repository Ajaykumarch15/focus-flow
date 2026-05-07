// Central API utility — attaches the JWT from localStorage to every request.
// All functions throw on non-2xx so callers can catch and show errors.

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function getToken(): string | null {
  return localStorage.getItem('ff_token');
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
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
    throw new Error((data as { message?: string }).message || `HTTP ${res.status}`);
  }

  return data as T;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const api = {
  auth: {
    register: (name: string, email: string, password: string) =>
      request<{ token: string; user: any }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      }),

    login: (email: string, password: string) =>
      request<{ token: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),

    me: () => request<{ user: any }>('/auth/me'),
  },

  // ── Tasks ───────────────────────────────────────────────────────────────────
  tasks: {
    list:   ()           => request<any[]>('/tasks'),
    create: (body: any)  => request<any>('/tasks',       { method: 'POST',   body: JSON.stringify(body) }),
    update: (id: string, body: any) =>
      request<any>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: string) => request<any>(`/tasks/${id}`, { method: 'DELETE' }),

    addSubtask: (taskId: string, title: string) =>
      request<any>(`/tasks/${taskId}/subtasks`, { method: 'POST', body: JSON.stringify({ title }) }),

    toggleSubtask: (taskId: string, subId: string, completed: boolean) =>
      request<any>(`/tasks/${taskId}/subtasks/${subId}`, {
        method: 'PATCH', body: JSON.stringify({ completed }),
      }),

    deleteSubtask: (taskId: string, subId: string) =>
      request<any>(`/tasks/${taskId}/subtasks/${subId}`, { method: 'DELETE' }),
  },

  // ── Sessions ─────────────────────────────────────────────────────────────────
  sessions: {
    list:   (params?: { taskId?: string; active?: boolean }) => {
      const qs = new URLSearchParams(params as any).toString();
      return request<any[]>(`/sessions${qs ? '?' + qs : ''}`);
    },
    start:  (taskId: string, startTime: number) =>
      request<any>('/sessions', { method: 'POST', body: JSON.stringify({ taskId, startTime }) }),
    pause:  (id: string, pauseTime: number) =>
      request<any>(`/sessions/${id}/pause`,  { method: 'PATCH', body: JSON.stringify({ pauseTime }) }),
    resume: (id: string, resumeTime: number) =>
      request<any>(`/sessions/${id}/resume`, { method: 'PATCH', body: JSON.stringify({ resumeTime }) }),
    stop:   (id: string, endTime: number) =>
      request<any>(`/sessions/${id}/stop`,   { method: 'PATCH', body: JSON.stringify({ endTime }) }),
  },

  // ── Journals ─────────────────────────────────────────────────────────────────
  journals: {
    list:   (taskId?: string) =>
      request<any[]>(`/journals${taskId ? '?taskId=' + taskId : ''}`),
    create: (body: any) =>
      request<any>('/journals', { method: 'POST',   body: JSON.stringify(body) }),
    update: (id: string, body: any) =>
      request<any>(`/journals/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: string) =>
      request<any>(`/journals/${id}`, { method: 'DELETE' }),
  },

  // ── Profile ──────────────────────────────────────────────────────────────────
  profile: {
    get:    ()           => request<any>('/profile'),
    update: (body: any)  => request<any>('/profile', { method: 'PATCH', body: JSON.stringify(body) }),
  },
};
