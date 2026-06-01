import { create } from 'zustand';
import { api } from '../utils/api';
import { clearTimer } from '../utils/timerPersist';

interface AuthUser {
  _id:      string;
  name:     string;
  email:    string;
  avatar?:  string;
  settings: Record<string, any>;
}

interface AuthState {
  user:    AuthUser | null;
  token:   string | null;
  loading: boolean;
  error:   string | null;

  register:       (name: string, email: string, password: string) => Promise<void>;
  login:          (email: string, password: string) => Promise<void>;
  logout:         () => void;
  restoreSession: () => Promise<void>;
  clearError:     () => void;
}

// ── Key fix ────────────────────────────────────────────────────────────────────
// If a token already exists in localStorage, start with loading: true.
// This makes ProtectedRoute show the spinner instead of redirecting to /login
// while restoreSession() is still running the async /auth/me call.
const existingToken = localStorage.getItem('ff_token');

export const useAuthStore = create<AuthState>((set) => ({
  user:    null,
  token:   existingToken,
  loading: !!existingToken,   // ← THE FIX: true when token exists, false when not
  error:   null,

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
    localStorage.removeItem('ff_today_ms');
    clearTimer();
    set({ user: null, token: null, loading: false });
  },

  restoreSession: async () => {
    const token = localStorage.getItem('ff_token');

    // No token — nothing to restore, stay on loading: false
    if (!token) {
      set({ loading: false });
      return;
    }

    // Token exists — loading was already set to true at initialization.
    // Validate it with the server.
    try {
      const { user } = await api.auth.me();
      set({ user, token, loading: false });
    } catch {
      // Token expired or invalid — clear everything
      localStorage.removeItem('ff_token');
      set({ user: null, token: null, loading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
