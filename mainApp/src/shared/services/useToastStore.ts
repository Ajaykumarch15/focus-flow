import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id:       string;
  type:     ToastType;
  title:    string;
  message?: string;
  duration: number;   // ms before auto-dismiss
}

interface ToastState {
  toasts: Toast[];
  addToast:    (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearAll:    () => void;
}

// Convenience helpers — call these anywhere in the app
export const toast = {
  success: (title: string, message?: string) =>
    useToastStore.getState().addToast({ type: 'success', title, message, duration: 4000 }),
  error: (title: string, message?: string) =>
    useToastStore.getState().addToast({ type: 'error',   title, message, duration: 6000 }),
  info: (title: string, message?: string) =>
    useToastStore.getState().addToast({ type: 'info',    title, message, duration: 4000 }),
  warning: (title: string, message?: string) =>
    useToastStore.getState().addToast({ type: 'warning', title, message, duration: 5000 }),
};

const timers = new Map<string, ReturnType<typeof setTimeout>>();

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (toastData) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    set((s) => ({ toasts: [...s.toasts, { ...toastData, id }] }));

    // Auto-dismiss after duration; tracked so manual dismiss can cancel it.
    const timer = setTimeout(() => {
      timers.delete(id);
      useToastStore.getState().removeToast(id);
    }, toastData.duration);
    timers.set(id, timer);
  },

  removeToast: (id) => {
    const timer = timers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.delete(id);
    }
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  clearAll: () => {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    set({ toasts: [] });
  },
}));
