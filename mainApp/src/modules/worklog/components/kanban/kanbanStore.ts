import { create } from 'zustand';
import type { KanbanTask, KanbanStatus, KanbanView, KanbanLabel, SortBy } from './types';
import { SAMPLE_KANBAN_TASKS } from './types';

interface KanbanState {
  tasks: KanbanTask[];
  searchQuery: string;
  activeView: KanbanView;
  sortBy: SortBy;
  filters: {
    status: KanbanStatus | 'all';
    priority: string;
    label: string;
    assignee: string;
  };
  selectedTaskId: string | null;
  showAddModal: boolean;
  addModalDefaultStatus: KanbanStatus;
  showDetailsPanel: boolean;

  setSearch: (q: string) => void;
  setActiveView: (v: KanbanView) => void;
  setSortBy: (s: SortBy) => void;
  setFilter: (key: keyof KanbanState['filters'], value: string) => void;
  clearFilters: () => void;
  selectTask: (id: string | null) => void;
  openAddModal: (status?: KanbanStatus) => void;
  closeAddModal: () => void;
  openDetailsPanel: (id: string) => void;
  closeDetailsPanel: () => void;
  addTask: (task: Omit<KanbanTask, 'id' | 'createdAt' | 'order'>) => void;
  updateTask: (id: string, updates: Partial<KanbanTask>) => void;
  deleteTask: (id: string) => void;
  moveTask: (taskId: string, toStatus: KanbanStatus, toIndex: number) => void;
  reorderInColumn: (status: KanbanStatus, fromIndex: number, toIndex: number) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  addLabelToTask: (taskId: string, label: KanbanLabel) => void;
  removeLabelFromTask: (taskId: string, labelName: string) => void;
}

export const useKanbanStore = create<KanbanState>((set) => ({
  tasks: SAMPLE_KANBAN_TASKS,
  searchQuery: '',
  activeView: 'board',
  sortBy: 'default',
  filters: { status: 'all', priority: '', label: '', assignee: '' },
  selectedTaskId: null,
  showAddModal: false,
  addModalDefaultStatus: 'todo',
  showDetailsPanel: false,

  setSearch: (q) => set({ searchQuery: q }),
  setActiveView: (v) => set({ activeView: v }),
  setSortBy: (s) => set({ sortBy: s }),
  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value } })),
  clearFilters: () =>
    set({ filters: { status: 'all', priority: '', label: '', assignee: '' } }),
  selectTask: (id) => set({ selectedTaskId: id }),
  openAddModal: (status = 'todo') => set({ showAddModal: true, addModalDefaultStatus: status }),
  closeAddModal: () => set({ showAddModal: false }),
  openDetailsPanel: (id) => set({ showDetailsPanel: true, selectedTaskId: id }),
  closeDetailsPanel: () => set({ showDetailsPanel: false, selectedTaskId: null }),

  addTask: (taskData) =>
    set((state) => {
      const colTasks = state.tasks.filter((t) => t.status === taskData.status);
      const maxOrder = colTasks.reduce((max, t) => Math.max(max, t.order), -1);
      const newTask: KanbanTask = {
        ...taskData,
        id: `kt-${Date.now()}`,
        createdAt: new Date().toISOString(),
        order: maxOrder + 1,
      };
      return { tasks: [...state.tasks, newTask] };
    }),

  updateTask: (id, updates) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),

  deleteTask: (id) =>
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
      selectedTaskId: state.selectedTaskId === id ? null : state.selectedTaskId,
      showDetailsPanel: state.selectedTaskId === id ? false : state.showDetailsPanel,
    })),

  moveTask: (taskId, toStatus, toIndex) =>
    set((state) => {
      const task = state.tasks.find((t) => t.id === taskId);
      if (!task) return state;

      const tasks = state.tasks.filter((t) => t.id !== taskId);
      const destTasks = tasks.filter((t) => t.status === toStatus);

      const updatedTask = { ...task, status: toStatus };

      const colTasks = destTasks.sort((a, b) => a.order - b.order);
      colTasks.splice(toIndex, 0, updatedTask);
      const reordered = colTasks.map((t, i) => ({ ...t, order: i }));

      const otherTasks = tasks.filter((t) => t.status !== toStatus);

      return { tasks: [...otherTasks, ...reordered] };
    }),

  reorderInColumn: (status, fromIndex, toIndex) =>
    set((state) => {
      const colTasks = state.tasks
        .filter((t) => t.status === status)
        .sort((a, b) => a.order - b.order);
      const otherTasks = state.tasks.filter((t) => t.status !== status);

      const [moved] = colTasks.splice(fromIndex, 1);
      colTasks.splice(toIndex, 0, moved);
      const reordered = colTasks.map((t, i) => ({ ...t, order: i }));

      return { tasks: [...otherTasks, ...reordered] };
    }),

  toggleSubtask: (taskId, subtaskId) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              subtasks: t.subtasks.map((s) =>
                s.id === subtaskId ? { ...s, completed: !s.completed } : s
              ),
            }
          : t
      ),
    })),

  addLabelToTask: (taskId, label) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId && !t.labels.find((l) => l.name === label.name)
          ? { ...t, labels: [...t.labels, label] }
          : t
      ),
    })),

  removeLabelFromTask: (taskId, labelName) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId
          ? { ...t, labels: t.labels.filter((l) => l.name !== labelName) }
          : t
      ),
    })),
}));
