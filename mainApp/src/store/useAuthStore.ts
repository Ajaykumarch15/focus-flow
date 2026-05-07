import { create } from 'zustand';
import { api } from '../utils/api';

interface AuthUser {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  settings: Record<string, any>;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  error: string | null;

  // Actions
  register:  (name: string, email: string, password: string) => Promise<void>;
  login:     (email: string, password: string) => Promise<void>;
  logout:    () => void;
  restoreSession: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user:    null,
  token:   localStorage.getItem('ff_token'),
  loading: false,
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
    // Also clear app data so next user starts fresh
    localStorage.removeItem('focusflow-storage');
    set({ user: null, token: null });
  },

  // Called once on app boot — validates stored token
  restoreSession: async () => {
    const token = localStorage.getItem('ff_token');
    if (!token) return;
    set({ loading: true });
    try {
      const { user } = await api.auth.me();
      set({ user, token, loading: false });
    } catch {
      // Token expired or invalid — clear it
      localStorage.removeItem('ff_token');
      set({ user: null, token: null, loading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
