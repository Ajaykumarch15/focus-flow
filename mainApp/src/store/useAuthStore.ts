import { create } from 'zustand';
import { api } from '../utils/api';
import { clearTimer } from '../utils/timerPersist';
import { timerEngine } from '../utils/timerEngine';

interface AuthUser {
  _id:      string;
  name:     string;
  email:    string;
  role:     'user' | 'admin';
  avatar?:  string;
  settings: Record<string, any>;
  googleConnected?: boolean;
}

export type Workspace = 'personal' | 'admin';

interface AuthState {
  user:    AuthUser | null;
  token:   string | null;
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

const existingToken = localStorage.getItem('ff_token');

export const useAuthStore = create<AuthState>((set) => ({
  user:      null,
  token:     existingToken,
  loading:   !!existingToken,
  error:     null,
  workspace: null,

  register: async (name, email, password) => {
    set({ loading: true, error: null });
    try {
      const { token, user } = await api.auth.register(name, email, password);
      localStorage.setItem('ff_token', token);
      set({ token, user, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const { token, user } = await api.auth.login(email, password);
      localStorage.setItem('ff_token', token);
      set({ token, user, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem('ff_token');
    localStorage.removeItem('focusflow-storage');
    localStorage.removeItem('ff_profile_cache');
    localStorage.removeItem('ff_theme_cache');
    localStorage.removeItem('ff_worklog_cache');
    localStorage.removeItem('ff_habit_cache');
    localStorage.removeItem('ff_habit_timer');
    localStorage.removeItem('ff_today_ms');
    clearTimer();
    timerEngine.hydrate(null);
    set({ user: null, token: null, loading: false, workspace: null });
  },

  restoreSession: async () => {
    const token = localStorage.getItem('ff_token');
    if (!token) {
      set({ loading: false });
      return;
    }
    try {
      const { user } = await api.auth.me();
      set({ user, token, loading: false });
    } catch {
      localStorage.removeItem('ff_token');
      clearTimer();
      timerEngine.hydrate(null);
      set({ user: null, token: null, loading: false, workspace: null });
    }
  },

  clearError: () => set({ error: null }),

  setWorkspace: (w) => set({ workspace: w }),
}));
