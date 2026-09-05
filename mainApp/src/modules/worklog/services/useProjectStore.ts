import { create } from 'zustand';
import { api } from '@shared/utils/api';

export interface Project {
  _id:                  string;
  name:                 string;
  googleFolderId?:      string;
  workLogsFolderId?:    string;
  designDocsFolderId?:  string;
  meetingNotesFolderId?: string;
  reportsFolderId?:     string;
  createdAt:            string;
  updatedAt:            string;
}

interface ProjectState {
  projects:   Project[];
  loading:    boolean;
  error:      string | null;
  loadProjects: () => Promise<void>;
  createProject: (name: string) => Promise<Project>;
  syncDrive: (id: string) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, _get) => ({
  projects: [],
  loading:  false,
  error:    null,

  loadProjects: async () => {
    set({ loading: true, error: null });
    try {
      const projects = await api.projects.list();
      set({ projects, loading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to load projects', loading: false });
    }
  },

  createProject: async (name: string) => {
    set({ loading: true, error: null });
    try {
      const newProject = await api.projects.create({ name });
      set(state => ({
        projects: [...state.projects, newProject].sort((a, b) => a.name.localeCompare(b.name)),
        loading: false,
      }));
      return newProject;
    } catch (err: any) {
      set({ error: err.message || 'Failed to create project', loading: false });
      throw err;
    }
  },

  syncDrive: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const updatedProject = await api.projects.syncDrive(id);
      set(state => ({
        projects: state.projects.map(p => p._id === id ? updatedProject : p),
        loading: false,
      }));
    } catch (err: any) {
      set({ error: err.message || 'Failed to sync Google Drive folders', loading: false });
      throw err;
    }
  },
}));
