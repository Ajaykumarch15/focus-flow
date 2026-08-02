import { create } from 'zustand';
import { api } from '../utils/api';
import { runMutation } from '../utils/mutation';
import { mapLog } from '../lib/dataMapper';

const WORKLOG_CACHE_KEY = 'ff_worklog_cache';

export type WorkLogStatus = 'planning' | 'in-progress' | 'reviewing' | 'blocked' | 'done';

export interface TimelineEntry {
  _id: string;
  timestamp: number;
  type: 'timer_start' | 'timer_pause' | 'timer_resume' | 'timer_stop' | 'note' | 'snapshot' | 'completed_item' | 'decision' | 'blocker';
  title: string;
  description: string;
  category: string;
  metadata?: Record<string, any>;
}

export interface DecisionItem {
  _id: string;
  title: string;
  context: string;
  decision: string;
  alternatives: string;
  rationale: string;
  timestamp: number;
}

export interface StructuredBlocker {
  _id: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'blocked' | 'resolved';
  notes: string;
  resolvedAt?: number;
  createdAt: number;
}

export interface ProgressSnapshot {
  _id: string;
  period: 'Morning' | 'Afternoon' | 'Evening' | 'Custom';
  text: string;
  timestamp: number;
}

export interface WorkEntry {
  _id: string;
  date: string;
  what: string;
  startedAt?: number;
  endedAt?: number;
  activeMs: number;
  sessionIds?: string[];
}

export interface CompletedItem {
  _id: string;
  text: string;
  category: 'feature' | 'bug' | 'refactor' | 'research' | 'documentation' | 'general';
  done: boolean;
  completedAt: number;
  createdAt: number;
}

export interface WorkLink {
  _id: string;
  label: string;
  url: string;
  category: 'Figma' | 'GitHub' | 'Jira' | 'Linear' | 'Documentation' | 'API' | 'Database' | 'PR' | 'Meeting Notes' | 'General';
}

export interface WorkAttachment {
  _id: string;
  name: string;
  type: string;
  url: string;
  sizeBytes: number;
  uploadDate: number;
  description: string;
}

export interface ProblemFlow {
  problem: string;
  investigation: string;
  rootCause: string;
  solution: string;
  lessonsLearned: string;
}

export interface GitRef {
  repository: string;
  branch: string;
  commitIds: string[];
  prNumber: string;
  issueNumber: string;
}

export interface TomorrowPlan {
  topPriority: string;
  unfinishedItems: string[];
  attentionRequired: string;
}

export interface DailyReflection {
  wentWell: string;
  slowedDown: string;
  learned: string;
  improvement: string;
  rating: number;
}

export interface MoodMetrics {
  energy: number;
  focus: number;
  stress: number;
  confidence: number;
  motivation: number;
}

export interface LinkedTask {
  _id: string;
  title: string;
  color: string;
  category: string;
  totalTime: number;
}

export interface LinkedProject {
  _id: string;
  name: string;
  googleFolderId?: string;
  workLogsFolderId?: string;
}

export interface WorkLog {
  _id: string;
  title: string;
  taskRef?: LinkedTask;
  projectRef?: LinkedProject;
  googleDocId?: string;
  googleDocUrl?: string;

  problemFlow: ProblemFlow;
  problem: string;
  gitBranch: string;
  currentWork: string;
  plan: string;
  designNotes: string;
  blockers: string;

  gitRef: GitRef;
  timelineEntries: TimelineEntry[];
  decisions: DecisionItem[];
  blockerList: StructuredBlocker[];
  progressSnapshots: ProgressSnapshot[];
  completedItems: CompletedItem[];
  links: WorkLink[];
  attachments: WorkAttachment[];
  workEntries: WorkEntry[];

  tomorrowPlan: TomorrowPlan;
  reflection: DailyReflection;
  moodMetrics: MoodMetrics;

  status: WorkLogStatus;
  isActive: boolean;
  closedAt?: string;
  reopenedAt?: string;
  mood: number;
  tags: string[];
  totalActiveMs: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkLogFilterOptions {
  searchQuery: string;
  status?: string;
  tag?: string;
  startDate?: string;
  endDate?: string;
  hasBlocker?: boolean;
}

interface WorkLogState {
  activeLogs: WorkLog[];
  closedLogs: WorkLog[];
  todayLog: WorkLog | null;
  selectedLogId: string | null;
  filters: WorkLogFilterOptions;

  loading: boolean;
  creating: boolean;
  error: string | null;

  loadActive: () => Promise<void>;
  loadClosed: () => Promise<void>;
  loadAll: () => Promise<void>;
  loadToday: () => Promise<void>;
  refreshLog: (id: string) => Promise<void>;
  setSelectedLogId: (id: string | null) => void;
  setFilters: (filters: Partial<WorkLogFilterOptions>) => void;

  createLog: (title: string, taskRefId?: string, projectId?: string) => Promise<WorkLog>;
  updateField: (id: string, field: string, value: any) => Promise<void>;
  updateNestedField: (id: string, parentField: string, childField: string, value: any) => Promise<void>;
  linkTask: (id: string, taskRefId?: string) => Promise<void>;
  updateEntry: (id: string, entryId: string, what: string) => Promise<void>;
  syncTime: (id: string) => Promise<void>;
  deleteLog: (id: string) => Promise<void>;
  closeLog: (id: string) => Promise<void>;
  continueLog: (id: string) => Promise<void>;

  addCompleted: (id: string, text: string, category?: string) => Promise<void>;
  deleteCompleted: (id: string, itemId: string) => Promise<void>;
  addLink: (id: string, label: string, url: string, category?: string) => Promise<void>;
  deleteLink: (id: string, linkId: string) => Promise<void>;

  // Sub-document actions
  addTimelineEntry: (id: string, entry: Omit<TimelineEntry, '_id'>) => Promise<void>;
  addDecision: (id: string, decision: Omit<DecisionItem, '_id' | 'timestamp'>) => Promise<void>;
  deleteDecision: (id: string, decId: string) => Promise<void>;
  addBlocker: (id: string, blocker: Omit<StructuredBlocker, '_id' | 'createdAt'>) => Promise<void>;
  updateBlocker: (id: string, blkId: string, updates: Partial<StructuredBlocker>) => Promise<void>;
  deleteBlocker: (id: string, blkId: string) => Promise<void>;
  addSnapshot: (id: string, period: ProgressSnapshot['period'], text: string) => Promise<void>;
  deleteSnapshot: (id: string, snapId: string) => Promise<void>;
  addAttachment: (id: string, attachment: Omit<WorkAttachment, '_id' | 'uploadDate'>) => Promise<void>;
  deleteAttachment: (id: string, attId: string) => Promise<void>;
}

function patchList(logs: WorkLog[], id: string, updated: WorkLog): WorkLog[] {
  return logs.map(l => l._id === id ? updated : l);
}

function getTodayLog(logs: WorkLog[]): WorkLog | null {
  const today = new Date().toDateString();
  return logs.find(log =>
    log.workEntries?.some(e => new Date(e.date).toDateString() === today)
  ) || logs[0] || null;
}

function readCachedLogs(): Pick<WorkLogState, 'activeLogs' | 'closedLogs' | 'todayLog'> {
  try {
    const raw = localStorage.getItem(WORKLOG_CACHE_KEY);
    if (!raw) return { activeLogs: [], closedLogs: [], todayLog: null };
    const parsed = JSON.parse(raw);
    const activeLogs = Array.isArray(parsed.activeLogs) ? parsed.activeLogs : [];
    const closedLogs = Array.isArray(parsed.closedLogs) ? parsed.closedLogs : [];
    return {
      activeLogs,
      closedLogs,
      todayLog: parsed.todayLog ?? getTodayLog(activeLogs),
    };
  } catch {
    return { activeLogs: [], closedLogs: [], todayLog: null };
  }
}

function cacheLogs(activeLogs: WorkLog[], closedLogs: WorkLog[], todayLog = getTodayLog(activeLogs)): void {
  try {
    localStorage.setItem(WORKLOG_CACHE_KEY, JSON.stringify({ activeLogs, closedLogs, todayLog }));
  } catch { /* ignore */ }
}

const cachedLogs = readCachedLogs();

export const useWorkLogStore = create<WorkLogState>((set, get) => ({
  activeLogs: cachedLogs.activeLogs,
  closedLogs: cachedLogs.closedLogs,
  todayLog: cachedLogs.todayLog,
  selectedLogId: cachedLogs.todayLog?._id || null,
  filters: { searchQuery: '' },

  loading: false,
  creating: false,
  error: null,

  setSelectedLogId: (id) => set({ selectedLogId: id }),
  setFilters: (newFilters) => set(s => ({ filters: { ...s.filters, ...newFilters } })),

  // ── Load ─────────────────────────────────────────────────────────────────────
  loadActive: async () => {
    set({ loading: true, error: null });
    try {
      const docs = await api.workLogs.list(true);
      const activeLogs = docs.map(mapLog);
      const { closedLogs } = get();
      const todayLog = getTodayLog(activeLogs);
      cacheLogs(activeLogs, closedLogs, todayLog);
      set({ activeLogs, todayLog, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  loadClosed: async () => {
    try {
      const docs = await api.workLogs.list(false);
      const closedLogs = docs.map(mapLog);
      cacheLogs(get().activeLogs, closedLogs, get().todayLog);
      set({ closedLogs });
    } catch (err: any) {
      console.error('loadClosed failed:', err);
    }
  },

  loadAll: async () => {
    set({ loading: true, error: null });
    try {
      const docs = await api.workLogs.list();
      const all = docs.map(mapLog);
      const activeLogs = all.filter(l => l.isActive);
      const closedLogs = all.filter(l => !l.isActive);
      const todayLog = getTodayLog(activeLogs);
      cacheLogs(activeLogs, closedLogs, todayLog);
      set({
        activeLogs,
        closedLogs,
        todayLog,
        selectedLogId: get().selectedLogId || todayLog?._id || activeLogs[0]?._id || null,
        loading: false
      });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  loadToday: async () => {
    set({ loading: true, error: null });
    try {
      const docs = await api.workLogs.list(true);
      const logs = docs.map(mapLog);
      const today = new Date().toDateString();
      const todayLog = logs.find(log =>
        log.workEntries?.some(e => new Date(e.date).toDateString() === today)
      ) || logs[0] || null;
      const { closedLogs } = get();
      cacheLogs(logs, closedLogs, todayLog);
      set({
        activeLogs: logs,
        todayLog,
        selectedLogId: get().selectedLogId || todayLog?._id || null,
        loading: false,
      });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  refreshLog: async (id) => {
    try {
      const doc = await api.workLogs.get(id);
      const updated = mapLog(doc);
      set(s => {
        const activeLogs = patchList(s.activeLogs, id, updated);
        const closedLogs = patchList(s.closedLogs, id, updated);
        const todayLog = s.todayLog?._id === id ? updated : getTodayLog(activeLogs);
        cacheLogs(activeLogs, closedLogs, todayLog);
        return { activeLogs, closedLogs, todayLog };
      });
    } catch (err) {
      console.error('refreshLog failed:', err);
    }
  },

  // ── Create ────────────────────────────────────────────────────────────────────
  createLog: async (title, taskRefId, projectId) => {
    set({ creating: true });
    try {
      const doc = await api.workLogs.create({
        title,
        status: 'in-progress',
        isActive: true,
        taskRef: taskRefId || undefined,
        projectId: projectId || undefined,
      });
      const log = mapLog(doc);
      set(s => {
        const activeLogs = [log, ...s.activeLogs];
        const todayLog = getTodayLog(activeLogs);
        cacheLogs(activeLogs, s.closedLogs, todayLog);
        return { activeLogs, todayLog, selectedLogId: log._id, creating: false };
      });
      return log;
    } catch (err: any) {
      set({ creating: false });
      throw err;
    }
  },

  // ── Field updates (auto-save) ──────────────────────────────────────────────────
  updateField: async (id, field, value) => {
    const patch = { [field]: value };
    const prev = get();
    await runMutation(
      () => {
        set(s => {
          const activeLogs = s.activeLogs.map(l => l._id === id ? { ...l, ...patch } : l);
          const closedLogs = s.closedLogs.map(l => l._id === id ? { ...l, ...patch } : l);
          const todayLog = s.todayLog?._id === id ? { ...s.todayLog, ...patch } : getTodayLog(activeLogs);
          cacheLogs(activeLogs, closedLogs, todayLog);
          return { activeLogs, closedLogs, todayLog };
        });
        return () => {
          cacheLogs(prev.activeLogs, prev.closedLogs, prev.todayLog);
          set({ activeLogs: prev.activeLogs, closedLogs: prev.closedLogs, todayLog: prev.todayLog });
        };
      },
      () => api.workLogs.update(id, patch),
      { errorTitle: 'Failed to save changes' },
    );
  },

  updateNestedField: async (id, parentField, childField, value) => {
    set(s => {
      const updateObj = (l: WorkLog) => {
        if (l._id !== id) return l;
        const parent = { ...((l[parentField as keyof WorkLog] as Record<string, unknown> | undefined) || {}), [childField]: value };
        return { ...l, [parentField as keyof WorkLog]: parent };
      };
      const activeLogs = s.activeLogs.map(updateObj);
      const closedLogs = s.closedLogs.map(updateObj);
      const todayLog = s.todayLog?._id === id
        ? activeLogs.find(l => l._id === id) ?? s.todayLog
        : getTodayLog(activeLogs);
      cacheLogs(activeLogs, closedLogs, todayLog);
      return { activeLogs, closedLogs, todayLog };
    });
    await api.workLogs.update(id, { [`${parentField}.${childField}`]: value });
  },

  linkTask: async (id, taskRefId) => {
    const doc = await api.workLogs.linkTask(id, taskRefId || undefined);
    const updated = mapLog(doc);
    set(s => {
      const activeLogs = patchList(s.activeLogs, id, updated);
      const closedLogs = patchList(s.closedLogs, id, updated);
      const todayLog = s.todayLog?._id === id ? updated : getTodayLog(activeLogs);
      cacheLogs(activeLogs, closedLogs, todayLog);
      return { activeLogs, closedLogs, todayLog };
    });
  },

  updateEntry: async (id, entryId, what) => {
    const prev = get();
    await runMutation(
      () => {
        set(s => {
          const activeLogs = s.activeLogs.map(l =>
            l._id === id
              ? { ...l, workEntries: l.workEntries.map(e => e._id === entryId ? { ...e, what } : e) }
              : l
          );
          const closedLogs = s.closedLogs.map(l =>
            l._id === id
              ? { ...l, workEntries: l.workEntries.map(e => e._id === entryId ? { ...e, what } : e) }
              : l
          );
          const todayLog = s.todayLog?._id === id
            ? activeLogs.find(l => l._id === id) ?? closedLogs.find(l => l._id === id) ?? s.todayLog
            : getTodayLog(activeLogs);
          cacheLogs(activeLogs, closedLogs, todayLog);
          return { activeLogs, closedLogs, todayLog };
        });
        return () => {
          cacheLogs(prev.activeLogs, prev.closedLogs, prev.todayLog);
          set({ activeLogs: prev.activeLogs, closedLogs: prev.closedLogs, todayLog: prev.todayLog });
        };
      },
      () => api.workLogs.updateEntry(id, entryId, what),
      { errorTitle: 'Failed to save entry' },
    );
  },

  syncTime: async (id) => {
    const doc = await api.workLogs.syncTime(id);
    const updated = mapLog(doc);
    set(s => {
      const activeLogs = patchList(s.activeLogs, id, updated);
      const closedLogs = patchList(s.closedLogs, id, updated);
      const todayLog = s.todayLog?._id === id ? updated : getTodayLog(activeLogs);
      cacheLogs(activeLogs, closedLogs, todayLog);
      return { activeLogs, closedLogs, todayLog };
    });
  },

  deleteLog: async (id) => {
    const prev = get();
    await runMutation(
      () => {
        set(s => {
          const activeLogs = s.activeLogs.filter(l => l._id !== id);
          const closedLogs = s.closedLogs.filter(l => l._id !== id);
          const todayLog = s.todayLog?._id === id ? getTodayLog(activeLogs) : s.todayLog;
          const selectedLogId = s.selectedLogId === id ? (todayLog?._id || activeLogs[0]?._id || null) : s.selectedLogId;
          cacheLogs(activeLogs, closedLogs, todayLog);
          return { activeLogs, closedLogs, todayLog, selectedLogId };
        });
        return () => {
          cacheLogs(prev.activeLogs, prev.closedLogs, prev.todayLog);
          set({
            activeLogs: prev.activeLogs,
            closedLogs: prev.closedLogs,
            todayLog: prev.todayLog,
            selectedLogId: prev.selectedLogId,
          });
        };
      },
      () => api.workLogs.delete(id),
      { errorTitle: 'Failed to delete work log' },
    );
  },

  closeLog: async (id) => {
    const doc = await api.workLogs.close(id);
    const closed = mapLog(doc);
    set(s => {
      const activeLogs = s.activeLogs.filter(l => l._id !== id);
      const closedLogs = [closed, ...s.closedLogs];
      const todayLog = s.todayLog?._id === id ? getTodayLog(activeLogs) : s.todayLog;
      cacheLogs(activeLogs, closedLogs, todayLog);
      return { activeLogs, closedLogs, todayLog };
    });
  },

  continueLog: async (id) => {
    const doc = await api.workLogs.continue(id);
    const active = mapLog(doc);
    set(s => {
      const closedLogs = s.closedLogs.filter(l => l._id !== id);
      const activeLogs = [active, ...s.activeLogs];
      const todayLog = getTodayLog(activeLogs);
      cacheLogs(activeLogs, closedLogs, todayLog);
      return { activeLogs, closedLogs, todayLog };
    });
  },

  addCompleted: async (id, text, category = 'feature') => {
    const doc = await api.workLogs.addCompleted(id, text, category);
    const updated = mapLog(doc);
    set(s => {
      const activeLogs = patchList(s.activeLogs, id, updated);
      const closedLogs = patchList(s.closedLogs, id, updated);
      const todayLog = s.todayLog?._id === id ? updated : getTodayLog(activeLogs);
      cacheLogs(activeLogs, closedLogs, todayLog);
      return { activeLogs, closedLogs, todayLog };
    });
  },

  deleteCompleted: async (id, itemId) => {
    const patch = (logs: WorkLog[]) => logs.map(l =>
      l._id === id ? { ...l, completedItems: l.completedItems.filter(i => i._id !== itemId) } : l
    );
    set(s => {
      const activeLogs = patch(s.activeLogs);
      const closedLogs = patch(s.closedLogs);
      const todayLog = s.todayLog?._id === id
        ? activeLogs.find(l => l._id === id) ?? closedLogs.find(l => l._id === id) ?? s.todayLog
        : getTodayLog(activeLogs);
      cacheLogs(activeLogs, closedLogs, todayLog);
      return { activeLogs, closedLogs, todayLog };
    });
    await api.workLogs.deleteCompleted(id, itemId);
  },

  addLink: async (id, label, url, category = 'General') => {
    const doc = await api.workLogs.addLink(id, label, url, category);
    const updated = mapLog(doc);
    set(s => {
      const activeLogs = patchList(s.activeLogs, id, updated);
      const closedLogs = patchList(s.closedLogs, id, updated);
      const todayLog = s.todayLog?._id === id ? updated : getTodayLog(activeLogs);
      cacheLogs(activeLogs, closedLogs, todayLog);
      return { activeLogs, closedLogs, todayLog };
    });
  },

  deleteLink: async (id, linkId) => {
    const patch = (logs: WorkLog[]) => logs.map(l =>
      l._id === id ? { ...l, links: l.links.filter(lk => lk._id !== linkId) } : l
    );
    set(s => {
      const activeLogs = patch(s.activeLogs);
      const closedLogs = patch(s.closedLogs);
      const todayLog = s.todayLog?._id === id
        ? activeLogs.find(l => l._id === id) ?? closedLogs.find(l => l._id === id) ?? s.todayLog
        : getTodayLog(activeLogs);
      cacheLogs(activeLogs, closedLogs, todayLog);
      return { activeLogs, closedLogs, todayLog };
    });
    await api.workLogs.deleteLink(id, linkId);
  },

  // ── Sub-Document Actions ─────────────────────────────────────────────────

  addTimelineEntry: async (id, entry) => {
    const doc = await api.workLogs.addTimeline(id, entry);
    const updated = mapLog(doc);
    set(s => ({
      activeLogs: patchList(s.activeLogs, id, updated),
      closedLogs: patchList(s.closedLogs, id, updated),
      todayLog: s.todayLog?._id === id ? updated : s.todayLog,
    }));
  },

  addDecision: async (id, decision) => {
    const doc = await api.workLogs.addDecision(id, decision);
    const updated = mapLog(doc);
    set(s => ({
      activeLogs: patchList(s.activeLogs, id, updated),
      closedLogs: patchList(s.closedLogs, id, updated),
      todayLog: s.todayLog?._id === id ? updated : s.todayLog,
    }));
  },

  deleteDecision: async (id, decId) => {
    const doc = await api.workLogs.deleteDecision(id, decId);
    const updated = mapLog(doc);
    set(s => ({
      activeLogs: patchList(s.activeLogs, id, updated),
      closedLogs: patchList(s.closedLogs, id, updated),
      todayLog: s.todayLog?._id === id ? updated : s.todayLog,
    }));
  },

  addBlocker: async (id, blocker) => {
    const doc = await api.workLogs.addBlocker(id, blocker);
    const updated = mapLog(doc);
    set(s => ({
      activeLogs: patchList(s.activeLogs, id, updated),
      closedLogs: patchList(s.closedLogs, id, updated),
      todayLog: s.todayLog?._id === id ? updated : s.todayLog,
    }));
  },

  updateBlocker: async (id, blkId, updates) => {
    const doc = await api.workLogs.updateBlocker(id, blkId, updates);
    const updated = mapLog(doc);
    set(s => ({
      activeLogs: patchList(s.activeLogs, id, updated),
      closedLogs: patchList(s.closedLogs, id, updated),
      todayLog: s.todayLog?._id === id ? updated : s.todayLog,
    }));
  },

  deleteBlocker: async (id, blkId) => {
    const doc = await api.workLogs.deleteBlocker(id, blkId);
    const updated = mapLog(doc);
    set(s => ({
      activeLogs: patchList(s.activeLogs, id, updated),
      closedLogs: patchList(s.closedLogs, id, updated),
      todayLog: s.todayLog?._id === id ? updated : s.todayLog,
    }));
  },

  addSnapshot: async (id, period, text) => {
    const doc = await api.workLogs.addSnapshot(id, { period, text });
    const updated = mapLog(doc);
    set(s => ({
      activeLogs: patchList(s.activeLogs, id, updated),
      closedLogs: patchList(s.closedLogs, id, updated),
      todayLog: s.todayLog?._id === id ? updated : s.todayLog,
    }));
  },

  deleteSnapshot: async (id, snapId) => {
    const doc = await api.workLogs.deleteSnapshot(id, snapId);
    const updated = mapLog(doc);
    set(s => ({
      activeLogs: patchList(s.activeLogs, id, updated),
      closedLogs: patchList(s.closedLogs, id, updated),
      todayLog: s.todayLog?._id === id ? updated : s.todayLog,
    }));
  },

  addAttachment: async (id, attachment) => {
    const doc = await api.workLogs.addAttachment(id, attachment);
    const updated = mapLog(doc);
    set(s => ({
      activeLogs: patchList(s.activeLogs, id, updated),
      closedLogs: patchList(s.closedLogs, id, updated),
      todayLog: s.todayLog?._id === id ? updated : s.todayLog,
    }));
  },

  deleteAttachment: async (id, attId) => {
    const doc = await api.workLogs.deleteAttachment(id, attId);
    const updated = mapLog(doc);
    set(s => ({
      activeLogs: patchList(s.activeLogs, id, updated),
      closedLogs: patchList(s.closedLogs, id, updated),
      todayLog: s.todayLog?._id === id ? updated : s.todayLog,
    }));
  },
}));
