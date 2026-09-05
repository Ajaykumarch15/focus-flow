import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WorkspaceType } from '@shared/types/workspace';

interface WorkspaceState {
  activeWorkspace: WorkspaceType;
  setWorkspace: (ws: WorkspaceType) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      activeWorkspace: 'personal' as WorkspaceType,

      setWorkspace: (ws: WorkspaceType) => set({ activeWorkspace: ws }),
    }),
    {
      name: 'ff-workspace',
      partialize: (state) => ({ activeWorkspace: state.activeWorkspace }),
    },
  ),
);
