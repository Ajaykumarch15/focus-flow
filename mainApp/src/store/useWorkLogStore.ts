import { create } from 'zustand';
import { api } from '../utils/api';

const WORKLOG_CACHE_KEY = 'ff_worklog_cache';

export type WorkLogStatus = 'planning' | 'in-progress' | 'reviewing' | 'blocked' | 'done';

export interface WorkEntry {
  _id:       string;
  date:      string;       // ISO string
  what:      string;       // what was done this day
  startedAt?: number;      // epoch ms
  endedAt?:   number;      // epoch ms
  activeMs:   number;      // focused ms this day
}

export interface CompletedItem {
  _id: string; text: string; done: boolean; createdAt: number;
}

export interface WorkLink {
  _id: string; label: string; url: string;
}

export interface LinkedTask {
  _id:       string;
  title:     string;
  color:     string;
  category:  string;
  totalTime: number;       // total ms tracked via timer (all time, all sessions)
}

export interface WorkLog {
  _id:          string;
  title:        string;
  taskRef?:     LinkedTask;   // populated Task reference
  problem:      string;
  gitBranch:    string;
  currentWork:  string;
  plan:         string;
  designNotes:  string;
  blockers:     string;
  workEntries:  WorkEntry[];  // per-day history
  totalActiveMs:number;       // sum of all workEntries.activeMs
  completedItems: CompletedItem[];
  links:        WorkLink[];
  status:       WorkLogStatus;
  isActive:     boolean;
  closedAt?:    string;
  reopenedAt?:  string;
  mood:         number;
  tags:         string[];
  createdAt:    string;
  updatedAt:    string;
}

interface WorkLogState {
  activeLogs: WorkLog[];
  closedLogs: WorkLog[];
  todayLog: WorkLog | null;
  loadToday: () => Promise<void>;
  loading:    boolean;
  creating:   boolean;
  error:      string | null;

  loadActive:   () => Promise<void>;
  loadClosed:   () => Promise<void>;
  loadAll:      () => Promise<void>;
  refreshLog:   (id: string) => Promise<void>;    // re-fetch one log (after timer stop)

  createLog:    (title: string, taskRefId?: string) => Promise<WorkLog>;
  updateField:  (id: string, field: string, value: any) => Promise<void>;
  linkTask:     (id: string, taskRefId?: string) => Promise<void>;
  updateEntry:  (id: string, entryId: string, what: string) => Promise<void>;
  syncTime:     (id: string) => Promise<void>;    // pull latest session data in
  deleteLog:    (id: string) => Promise<void>;
  closeLog:     (id: string) => Promise<void>;
  continueLog:  (id: string) => Promise<void>;

  addCompleted:    (id: string, text: string)   => Promise<void>;
  deleteCompleted: (id: string, itemId: string) => Promise<void>;
  addLink:         (id: string, label: string, url: string) => Promise<void>;
  deleteLink:      (id: string, linkId: string) => Promise<void>;
}

// ── Map raw MongoDB doc → typed WorkLog ───────────────────────────────────────
function mapLog(doc: any): WorkLog {
  return {
    _id:          doc._id,
    title:        doc.title         || 'Untitled Work Item',
    taskRef:      doc.taskRef ? {
      _id:       doc.taskRef._id,
      title:     doc.taskRef.title,
      color:     doc.taskRef.color     || '#0ea5e9',
      category:  doc.taskRef.category  || 'Work',
      totalTime: doc.taskRef.totalTime || 0,
    } : undefined,
    problem:      doc.problem       || '',
    gitBranch:    doc.gitBranch     || '',
    currentWork:  doc.currentWork   || '',
    plan:         doc.plan          || '',
    designNotes:  doc.designNotes   || '',
    blockers:     doc.blockers      || '',
    workEntries:  (doc.workEntries || []).map((e: any): WorkEntry => ({
      _id:       e._id,
      date:      e.date,
      what:      e.what      || '',
      startedAt: e.startedAt,
      endedAt:   e.endedAt,
      activeMs:  e.activeMs  || 0,
    })).sort((a: WorkEntry, b: WorkEntry) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
    ),
    totalActiveMs: doc.totalActiveMs || 0,
    completedItems:(doc.completedItems || []).map((i: any) => ({
      _id: i._id, text: i.text, done: i.done,
      createdAt: new Date(i.createdAt || Date.now()).getTime(),
    })),
    links:        (doc.links || []).map((l: any) => ({ _id: l._id, label: l.label, url: l.url })),
    status:       doc.status    || 'in-progress',
    isActive:     doc.isActive  ?? true,
    closedAt:     doc.closedAt,
    reopenedAt:   doc.reopenedAt,
    mood:         doc.mood      || 3,
    tags:         doc.tags      || [],
    createdAt:    doc.createdAt,
    updatedAt:    doc.updatedAt,
  };
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
  loading:    false,
  creating:   false,
  error:      null,

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
      const all  = docs.map(mapLog);
      const activeLogs = all.filter(l => l.isActive);
      const closedLogs = all.filter(l => !l.isActive);
      const todayLog = getTodayLog(activeLogs);
      cacheLogs(activeLogs, closedLogs, todayLog);
      set({ activeLogs, closedLogs, todayLog, loading: false });
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

    const todayLog =
      logs.find(log =>
        log.workEntries?.some(
          e => new Date(e.date).toDateString() === today
        )
      ) || logs[0] || null;

    const { closedLogs } = get();
    cacheLogs(logs, closedLogs, todayLog);
    set({
      activeLogs: logs,
      todayLog,
      loading: false,
    });
  } catch (err: any) {
    set({
      error: err.message,
      loading: false,
    });
  }
},

  // Re-fetch a single log (called after timer stop to get fresh workEntries)
  refreshLog: async (id) => {
    try {
      const doc     = await api.workLogs.get(id);
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
  createLog: async (title, taskRefId) => {
    set({ creating: true });
    try {
      const doc = await api.workLogs.create({ title, status: 'in-progress', isActive: true, taskRef: taskRefId || undefined });
      const log = mapLog(doc);
      set(s => {
        const activeLogs = [log, ...s.activeLogs];
        const todayLog = getTodayLog(activeLogs);
        cacheLogs(activeLogs, s.closedLogs, todayLog);
        return { activeLogs, todayLog, creating: false };
      });
      return log;
    } catch (err: any) {
      set({ creating: false });
      throw err;
    }
  },

  // ── Field update (auto-save) ──────────────────────────────────────────────────
  updateField: async (id, field, value) => {
    const patch = { [field]: value };
    set(s => {
      const activeLogs = s.activeLogs.map(l => l._id === id ? { ...l, ...patch } : l);
      const closedLogs = s.closedLogs.map(l => l._id === id ? { ...l, ...patch } : l);
      const todayLog = s.todayLog?._id === id ? { ...s.todayLog, ...patch } : getTodayLog(activeLogs);
      cacheLogs(activeLogs, closedLogs, todayLog);
      return { activeLogs, closedLogs, todayLog };
    });
    await api.workLogs.update(id, patch);
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

  // ── Update "what I did" text on a specific day entry ─────────────────────────
  updateEntry: async (id, entryId, what) => {
    // Optimistic
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
    await api.workLogs.updateEntry(id, entryId, what);
  },

  // ── Sync session time into work entries ───────────────────────────────────────
  syncTime: async (id) => {
    const doc     = await api.workLogs.syncTime(id);
    const updated = mapLog(doc);
    set(s => {
      const activeLogs = patchList(s.activeLogs, id, updated);
      const closedLogs = patchList(s.closedLogs, id, updated);
      const todayLog = s.todayLog?._id === id ? updated : getTodayLog(activeLogs);
      cacheLogs(activeLogs, closedLogs, todayLog);
      return { activeLogs, closedLogs, todayLog };
    });
  },

  // ── Delete ────────────────────────────────────────────────────────────────────
  deleteLog: async (id) => {
    set(s => {
      const activeLogs = s.activeLogs.filter(l => l._id !== id);
      const closedLogs = s.closedLogs.filter(l => l._id !== id);
      const todayLog = s.todayLog?._id === id ? getTodayLog(activeLogs) : s.todayLog;
      cacheLogs(activeLogs, closedLogs, todayLog);
      return { activeLogs, closedLogs, todayLog };
    });
    await api.workLogs.delete(id);
  },

  // ── Close / Continue ──────────────────────────────────────────────────────────
  closeLog: async (id) => {
    const doc    = await api.workLogs.close(id);
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
    const doc    = await api.workLogs.continue(id);
    const active = mapLog(doc);
    set(s => {
      const closedLogs = s.closedLogs.filter(l => l._id !== id);
      const activeLogs = [active, ...s.activeLogs];
      const todayLog = getTodayLog(activeLogs);
      cacheLogs(activeLogs, closedLogs, todayLog);
      return { activeLogs, closedLogs, todayLog };
    });
  },

  // ── Completed items ───────────────────────────────────────────────────────────
  addCompleted: async (id, text) => {
    const doc     = await api.workLogs.addCompleted(id, text);
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

  // ── Links ─────────────────────────────────────────────────────────────────────
  addLink: async (id, label, url) => {
    const doc     = await api.workLogs.addLink(id, label, url);
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
}));
