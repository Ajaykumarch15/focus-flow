import { create } from 'zustand';
import { api } from '@shared/utils/api';
import { toast } from '@shared/services/useToastStore';
import type { FutureGoal, FutureGoalCategory, FutureGoalStatus } from '../types/futureGoal';

interface FutureGoalState {
  goals: FutureGoal[];
  reviewGoals: FutureGoal[];
  loading: boolean;
  reviewLoading: boolean;
  error: string | null;

  loadGoals: (params?: { status?: string; category?: string }) => Promise<void>;
  createGoal: (data: {
    title: string;
    description?: string;
    category?: FutureGoalCategory;
    color?: string;
  }) => Promise<FutureGoal>;
  updateGoal: (id: string, updates: Record<string, any>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  changeStatus: (id: string, status: FutureGoalStatus) => Promise<void>;
  reviewGoal: (id: string) => Promise<void>;
  loadReviewGoals: () => Promise<void>;
  startGoal: (id: string) => Promise<string>;
}

export const useFutureGoalStore = create<FutureGoalState>((set) => ({
  goals: [],
  reviewGoals: [],
  loading: false,
  reviewLoading: false,
  error: null,

  loadGoals: async (params) => {
    set({ loading: true, error: null });
    try {
      const goals = await api.personalFutureGoals.list(params);
      set({ goals, loading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to load goals', loading: false });
    }
  },

  createGoal: async (data) => {
    const goal = await api.personalFutureGoals.create(data);
    set(s => ({ goals: [goal, ...s.goals] }));
    toast.success('Goal captured');
    return goal;
  },

  updateGoal: async (id, updates) => {
    try {
      const updated = await api.personalFutureGoals.update(id, updates);
      set(s => ({
        goals: s.goals.map(g => g._id === id ? { ...g, ...updated } : g),
      }));
      toast.success('Goal updated');
    } catch (err: any) {
      toast.error('Failed to update goal', err.message);
      throw err;
    }
  },

  deleteGoal: async (id) => {
    try {
      await api.personalFutureGoals.remove(id);
      set(s => ({
        goals: s.goals.filter(g => g._id !== id),
        reviewGoals: s.reviewGoals.filter(g => g._id !== id),
      }));
      toast.success('Goal deleted');
    } catch (err: any) {
      toast.error('Failed to delete goal', err.message);
      throw err;
    }
  },

  changeStatus: async (id, status) => {
    try {
      const updated = await api.personalFutureGoals.update(id, { status });
      set(s => ({
        goals: s.goals.map(g => g._id === id ? { ...g, ...updated } : g),
        reviewGoals: s.reviewGoals.filter(g => g._id !== id),
      }));
      const label = status === 'dropped' ? 'Goal dropped' : `Goal moved to ${status}`;
      toast.success(label);
    } catch (err: any) {
      toast.error('Failed to update goal', err.message);
      throw err;
    }
  },

  reviewGoal: async (id) => {
    try {
      const updated = await api.personalFutureGoals.review(id);
      set(s => ({
        goals: s.goals.map(g => g._id === id ? { ...g, ...updated } : g),
        reviewGoals: s.reviewGoals.filter(g => g._id !== id),
      }));
    } catch (err: any) {
      toast.error('Failed to review goal', err.message);
      throw err;
    }
  },

  loadReviewGoals: async () => {
    set({ reviewLoading: true });
    try {
      const reviewGoals = await api.personalFutureGoals.getReviewGoals();
      set({ reviewGoals, reviewLoading: false });
    } catch (err: any) {
      set({ reviewLoading: false });
    }
  },

  startGoal: async (id) => {
    try {
      const result = await api.personalFutureGoals.startGoal(id);
      set(s => ({
        goals: s.goals.map(g => g._id === id ? { ...g, ...result.goal } : g),
        reviewGoals: s.reviewGoals.filter(g => g._id !== id),
      }));
      toast.success('Goal activated — Roadmap created');
      return result.roadmapId;
    } catch (err: any) {
      toast.error('Failed to start goal', err.message);
      throw err;
    }
  },
}));
