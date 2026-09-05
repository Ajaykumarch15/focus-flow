import { create } from 'zustand';
import { api } from '@shared/utils/api';
import { useWorkspaceStore } from '@shared/services/useWorkspaceStore';
import { toast } from '@shared/services/useToastStore';
import type {
  RoadmapListItem,
  RoadmapDetail,
  RoadmapType,
  RoadmapPhaseStatus,
  RoadmapMilestoneStatus,
} from '../types/roadmap';

interface RoadmapState {
  roadmaps: RoadmapListItem[];
  activeRoadmap: RoadmapDetail | null;
  loading: boolean;
  detailLoading: boolean;
  error: string | null;

  loadRoadmaps: () => Promise<void>;
  getRoadmap: (id: string) => Promise<void>;
  createRoadmap: (data: {
    title: string;
    description?: string;
    type?: RoadmapType;
    startDate?: string;
    targetDate?: string;
    icon?: string;
    color?: string;
    workspaceContext?: string;
  }) => Promise<RoadmapListItem>;
  updateRoadmap: (id: string, updates: Record<string, any>) => Promise<void>;
  deleteRoadmap: (id: string) => Promise<void>;

  createPhase: (roadmapId: string, data: {
    title: string;
    description?: string;
    order?: number;
    status?: RoadmapPhaseStatus;
    startDate?: string;
    targetDate?: string;
  }) => Promise<void>;
  updatePhase: (id: string, updates: Record<string, any>) => Promise<void>;
  deletePhase: (id: string) => Promise<void>;
  reorderPhases: (roadmapId: string, orderedIds: string[]) => Promise<void>;

  createMilestone: (phaseId: string, data: {
    title: string;
    description?: string;
    order?: number;
    status?: RoadmapMilestoneStatus;
    targetDate?: string;
  }) => Promise<void>;
  updateMilestone: (id: string, updates: Record<string, any>) => Promise<void>;
  deleteMilestone: (id: string) => Promise<void>;
  reorderMilestones: (phaseId: string, orderedIds: string[]) => Promise<void>;

  clearActiveRoadmap: () => void;
  refreshIfLinked: (roadmapId?: string | null) => Promise<void>;
  linkTask: (data: { taskId: string; roadmapId: string; phaseId: string; milestoneId: string }) => Promise<void>;
  unlinkTask: (taskId: string) => Promise<void>;
}

export const useRoadmapStore = create<RoadmapState>((set, get) => ({
  roadmaps: [],
  activeRoadmap: null,
  loading: false,
  detailLoading: false,
  error: null,

  loadRoadmaps: async () => {
    set({ loading: true, error: null });
    try {
      const roadmaps = await api.personalRoadmaps.list();
      set({ roadmaps, loading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to load roadmaps', loading: false });
    }
  },

  getRoadmap: async (id: string) => {
    // Only show the full skeleton on a cold load (no active roadmap or different roadmap).
    // Background refreshes (same roadmap already loaded) must NOT set detailLoading so the
    // page doesn't blank out while progress bars silently update.
    const isBackground = get().activeRoadmap?._id === id;
    if (!isBackground) set({ detailLoading: true, error: null });
    try {
      const roadmap = await api.personalRoadmaps.get(id);
      set({ activeRoadmap: roadmap, detailLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to load roadmap', detailLoading: false });
    }
  },

  createRoadmap: async (data) => {
    const wsCtx = useWorkspaceStore.getState().activeWorkspace;
    const roadmap = await api.personalRoadmaps.create({ ...data, workspaceContext: data.workspaceContext || wsCtx } as any);
    set(s => ({ roadmaps: [roadmap, ...s.roadmaps] }));
    toast.success('Roadmap created');
    return roadmap;
  },

  updateRoadmap: async (id, updates) => {
    try {
      const updated = await api.personalRoadmaps.update(id, updates);
      set(s => ({
        roadmaps: s.roadmaps.map(r => r._id === id ? { ...r, ...updated } : r),
        activeRoadmap: s.activeRoadmap?._id === id
          ? { ...s.activeRoadmap, ...updated } as RoadmapDetail
          : s.activeRoadmap,
      }));
      toast.success('Roadmap updated');
    } catch (err: any) {
      toast.error('Failed to update roadmap', err.message);
      throw err;
    }
  },

  deleteRoadmap: async (id) => {
    try {
      await api.personalRoadmaps.remove(id);
      set(s => ({
        roadmaps: s.roadmaps.filter(r => r._id !== id),
        activeRoadmap: s.activeRoadmap?._id === id ? null : s.activeRoadmap,
      }));
      toast.success('Roadmap deleted');
    } catch (err: any) {
      toast.error('Failed to delete roadmap', err.message);
      throw err;
    }
  },

  createPhase: async (roadmapId, data) => {
    try {
      await api.personalRoadmaps.createPhase(roadmapId, data);
      await get().getRoadmap(roadmapId);
      await get().loadRoadmaps();
      toast.success('Phase created');
    } catch (err: any) {
      toast.error('Failed to create phase', err.message);
      throw err;
    }
  },

  updatePhase: async (id, updates) => {
    try {
      await api.personalRoadmaps.updatePhase(id, updates);
      const roadmap = get().activeRoadmap;
      if (roadmap) await get().getRoadmap(roadmap._id);
      await get().loadRoadmaps();
      toast.success('Phase updated');
    } catch (err: any) {
      toast.error('Failed to update phase', err.message);
      throw err;
    }
  },

  deletePhase: async (id) => {
    try {
      await api.personalRoadmaps.removePhase(id);
      const roadmap = get().activeRoadmap;
      if (roadmap) await get().getRoadmap(roadmap._id);
      await get().loadRoadmaps();
      toast.success('Phase deleted');
    } catch (err: any) {
      toast.error('Failed to delete phase', err.message);
      throw err;
    }
  },

  reorderPhases: async (roadmapId, orderedIds) => {
    try {
      await api.personalRoadmaps.reorderPhases(roadmapId, orderedIds);
      const roadmap = get().activeRoadmap;
      if (roadmap && roadmap._id === roadmapId) await get().getRoadmap(roadmapId);
      await get().loadRoadmaps();
    } catch (err: any) {
      toast.error('Failed to reorder phases', err.message);
      throw err;
    }
  },

  createMilestone: async (phaseId, data) => {
    try {
      await api.personalRoadmaps.createMilestone(phaseId, data);
      const roadmap = get().activeRoadmap;
      if (roadmap) await get().getRoadmap(roadmap._id);
      await get().loadRoadmaps();
      toast.success('Milestone created');
    } catch (err: any) {
      toast.error('Failed to create milestone', err.message);
      throw err;
    }
  },

  updateMilestone: async (id, updates) => {
    try {
      await api.personalRoadmaps.updateMilestone(id, updates);
      const roadmap = get().activeRoadmap;
      if (roadmap) await get().getRoadmap(roadmap._id);
      await get().loadRoadmaps();
      toast.success('Milestone updated');
    } catch (err: any) {
      toast.error('Failed to update milestone', err.message);
      throw err;
    }
  },

  deleteMilestone: async (id) => {
    try {
      await api.personalRoadmaps.removeMilestone(id);
      const roadmap = get().activeRoadmap;
      if (roadmap) await get().getRoadmap(roadmap._id);
      await get().loadRoadmaps();
      toast.success('Milestone deleted');
    } catch (err: any) {
      toast.error('Failed to delete milestone', err.message);
      throw err;
    }
  },

  reorderMilestones: async (phaseId, orderedIds) => {
    try {
      await api.personalRoadmaps.reorderMilestones(phaseId, orderedIds);
      const roadmap = get().activeRoadmap;
      if (roadmap) await get().getRoadmap(roadmap._id);
      await get().loadRoadmaps();
    } catch (err: any) {
      toast.error('Failed to reorder milestones', err.message);
      throw err;
    }
  },

  clearActiveRoadmap: () => set({ activeRoadmap: null }),

  refreshIfLinked: async (roadmapId) => {
    if (!roadmapId) return;
    const current = get().activeRoadmap;
    if (current && current._id === roadmapId) {
      await get().getRoadmap(roadmapId);
    }
    // Always refresh the list so card progress stays current
    await get().loadRoadmaps();
  },

  linkTask: async (data) => {
    try {
      await api.personalRoadmaps.linkTask(data);
      const roadmap = get().activeRoadmap;
      if (roadmap && roadmap._id === data.roadmapId) {
        await get().getRoadmap(data.roadmapId);
      }
      await get().loadRoadmaps();
      toast.success('Task linked to milestone');
    } catch (err: any) {
      toast.error('Failed to link task', err.message);
      throw err;
    }
  },

  unlinkTask: async (taskId) => {
    try {
      await api.personalRoadmaps.unlinkTask(taskId);
      const roadmap = get().activeRoadmap;
      if (roadmap) await get().getRoadmap(roadmap._id);
      await get().loadRoadmaps();
      toast.success('Task unlinked');
    } catch (err: any) {
      toast.error('Failed to unlink task', err.message);
      throw err;
    }
  },
}));
