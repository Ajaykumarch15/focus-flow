import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAuthStore } from '../useAuthStore';
import { api } from '../../utils/api';

// EEP2-P1.1.2 · Identity & Session — store-level behavior: boot-time session
// restore, workspace-switcher reset on logout, and workspace selection.
// The store clears timer/local caches on logout, so those modules are mocked
// out of the equation (they have their own suites).

const USER = { _id: 'u-1', name: 'Ajay Kumar', email: 'a@f.io', role: 'user' as const, settings: {} };
const ADMIN = { _id: 'a-1', name: 'Admin', email: 'admin@f.io', role: 'admin' as const, settings: {} };

vi.mock('../../utils/api', () => ({
  api: {
    auth: {
      register: vi.fn(),
      login: vi.fn(),
      me: vi.fn(),
      logout: vi.fn(),
    },
  },
}));

vi.mock('../../utils/timerPersist', () => ({ clearTimer: vi.fn(), clearTodayMs: vi.fn() }));
vi.mock('../../utils/timerEngine', () => ({ timerEngine: { hydrate: vi.fn() } }));

const apiMock = api.auth as unknown as {
  register: ReturnType<typeof vi.fn>;
  login: ReturnType<typeof vi.fn>;
  me: ReturnType<typeof vi.fn>;
  logout: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useAuthStore.setState({ user: null, loading: true, error: null, workspace: null });
});

afterEach(() => {
  useAuthStore.setState({ user: null, loading: true, error: null, workspace: null });
});

describe('restoreSession (boot-time /auth/me)', () => {
  it('sets the user and leaves workspace selection untouched on success', async () => {
    apiMock.me.mockResolvedValue({ user: USER });
    useAuthStore.setState({ workspace: 'personal' });

    await useAuthStore.getState().restoreSession();

    expect(apiMock.me).toHaveBeenCalledOnce();
    expect(useAuthStore.getState().user).toEqual(USER);
    expect(useAuthStore.getState().loading).toBe(false);
    expect(useAuthStore.getState().workspace).toBe('personal');
  });

  it('resets to anonymous (user null, workspace null) when /auth/me fails', async () => {
    apiMock.me.mockRejectedValue(new Error('Token invalid or expired'));
    useAuthStore.setState({ user: USER, workspace: 'personal' });

    await useAuthStore.getState().restoreSession();

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().workspace).toBeNull();
    expect(useAuthStore.getState().loading).toBe(false);
  });
});

describe('register / login', () => {
  it('register stores the returned user and clears error/loading', async () => {
    apiMock.register.mockResolvedValue({ user: USER });
    await useAuthStore.getState().register('Ajay Kumar', 'a@f.io', 'correct-horse-battery');

    expect(apiMock.register).toHaveBeenCalledWith('Ajay Kumar', 'a@f.io', 'correct-horse-battery');
    expect(useAuthStore.getState().user).toEqual(USER);
    expect(useAuthStore.getState().error).toBeNull();
    expect(useAuthStore.getState().loading).toBe(false);
  });

  it('login stores the returned user', async () => {
    apiMock.login.mockResolvedValue({ user: USER });
    await useAuthStore.getState().login('a@f.io', 'secret123');

    expect(apiMock.login).toHaveBeenCalledWith('a@f.io', 'secret123');
    expect(useAuthStore.getState().user).toEqual(USER);
    expect(useAuthStore.getState().loading).toBe(false);
  });

  it('surfaces the API error message and rethrows', async () => {
    apiMock.login.mockRejectedValue(new Error('Invalid email or password'));
    await expect(useAuthStore.getState().login('a@f.io', 'wrong')).rejects.toThrow('Invalid email or password');
    expect(useAuthStore.getState().error).toBe('Invalid email or password');
    expect(useAuthStore.getState().user).toBeNull();
  });
});

describe('logout (workspace-switcher reset)', () => {
  it('best-effort revokes server-side, clears caches + workspace, resets to anonymous', () => {
    apiMock.logout.mockRejectedValue(new Error('network'));
    localStorage.setItem('focusflow-storage', 'x');
    localStorage.setItem('ff_theme_cache', 'dark');
    useAuthStore.setState({ user: ADMIN, workspace: 'admin' });

    expect(() => useAuthStore.getState().logout()).not.toThrow();
    // void-ed promise: the failure must never throw synchronously.
    expect(apiMock.logout).toHaveBeenCalledOnce();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.workspace).toBeNull();
    expect(state.loading).toBe(false);
    expect(localStorage.getItem('focusflow-storage')).toBeNull();
    expect(localStorage.getItem('ff_theme_cache')).toBeNull();
  });

  it('clears the workspace switcher while keeping the session if revoke succeeds', () => {
    apiMock.logout.mockResolvedValue({ message: 'Logged out' });
    useAuthStore.setState({ user: USER, workspace: 'personal' });

    useAuthStore.getState().logout();

    expect(apiMock.logout).toHaveBeenCalledOnce();
    expect(useAuthStore.getState().workspace).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });
});

describe('setWorkspace (workspace switcher)', () => {
  it('persists the chosen layer in store state', () => {
    useAuthStore.getState().setWorkspace('personal');
    expect(useAuthStore.getState().workspace).toBe('personal');

    useAuthStore.getState().setWorkspace('admin');
    expect(useAuthStore.getState().workspace).toBe('admin');

    useAuthStore.getState().setWorkspace(null);
    expect(useAuthStore.getState().workspace).toBeNull();
  });
});
