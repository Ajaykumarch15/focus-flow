import { create } from 'zustand';
import { api } from '../utils/api';
import { clearTimer, clearTodayMs } from '../utils/timerPersist';
import { timerEngine } from '../utils/timerEngine';

interface AuthUser {
  _id:      string;
  name:     string;
  email:    string;
  role:     'user' | 'admin';
  avatar?:  string;
  settings: Record<string, any>;
  googleConnected?: boolean;
  driveSyncError?: string;
}

export type Workspace = 'personal' | 'admin' | 'work' | 'collab';

interface AuthState {
  user:    AuthUser | null;
  loading: boolean;
  error:   string | null;
  workspace: Workspace | null;

  register:       (name: string, email: string, password: string) => Promise<void>;
  login:          (email: string, password: string) => Promise<void>;
  logout:         () => void;
  restoreSession: () => Promise<void>;
  clearError:     () => void;
  setWorkspace:   (w: Workspace | null) => void;
}

// IES-P0-12: the session JWT is held in an httpOnly cookie — the browser
// attaches it automatically. There is no token in JS or localStorage, so the
// initial state is "unknown" until /auth/me resolves on boot.
export const useAuthStore = create<AuthState>((set) => ({
  user:      null,
  loading:   true,
  error:     null,
  workspace: null,

  register: async (name, email, password) => {
    set({ loading: true, error: null });
    try {
      const { user } = await api.auth.register(name, email, password);
      set({ user, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const { user } = await api.auth.login(email, password);
      set({ user, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  logout: () => {
    // Best-effort server-side revocation; the local session is cleared regardless.
    void api.auth.logout().catch(() => {});
    localStorage.removeItem('focusflow-storage');
    localStorage.removeItem('ff_profile_cache');
    localStorage.removeItem('ff_theme_cache');
    localStorage.removeItem('ff_worklog_cache');
    localStorage.removeItem('ff_habit_cache');
    localStorage.removeItem('ff_habit_timer');
    clearTodayMs();
    clearTimer();
    timerEngine.hydrate(null);
    set({ user: null, loading: false, workspace: null });
  },

  restoreSession: async () => {
    try {
      const { user } = await api.auth.me();
      set({ user, loading: false });
    } catch {
      clearTimer();
      timerEngine.hydrate(null);
      set({ user: null, loading: false, workspace: null });
    }
  },

  clearError: () => set({ error: null }),

  setWorkspace: (w) => set({ workspace: w }),
}));
