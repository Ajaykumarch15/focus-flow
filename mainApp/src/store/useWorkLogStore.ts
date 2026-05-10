import { create } from 'zustand';
import { api } from '../utils/api';

export type WorkLogStatus = 'planning' | 'in-progress' | 'reviewing' | 'blocked' | 'done';

export interface CompletedItem {
  _id: string;
  text: string;
  done: boolean;
  createdAt: number;
}

export interface WorkLink {
  _id: string;
  label: string;
  url: string;
}

export interface WorkLog {
  _id: string;
  title: string;
  problem: string;
  gitBranch: string;
  currentWork: string;
  plan: string;
  designNotes: string;
  blockers: string;
  completedItems: CompletedItem[];
  links: WorkLink[];
  status: WorkLogStatus;
  isActive: boolean;
  closedAt?: string;
  reopenedAt?: string;
  mood: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface WorkLogState {
  // All logs split into active (open) and closed (done)
  activeLogs: WorkLog[];
  closedLogs: WorkLog[];
  loading:    boolean;
  creating:   boolean;
  error:      string | null;

  // Load
  loadActive: () => Promise<void>;
  loadClosed: () => Promise<void>;
  loadAll:    () => Promise<void>;

  // CRUD
  createLog:    (title: string) => Promise<WorkLog>;
  updateField:  (id: string, field: string, value: any) => Promise<void>;
  deleteLog:    (id: string) => Promise<void>;

  // Continue / close
  closeLog:    (id: string) => Promise<void>;   // mark done → move to history
  continueLog: (id: string) => Promise<void>;   // re-open a closed log

  // Completed items
  addCompleted:    (id: string, text: string)   => Promise<void>;
  deleteCompleted: (id: string, itemId: string) => Promise<void>;

  // Links
  addLink:    (id: string, label: string, url: string) => Promise<void>;
  deleteLink: (id: string, linkId: string)             => Promise<void>;
}

function mapLog(doc: any): WorkLog {
  return {
    _id:           doc._id,
    title:         doc.title         || 'Untitled Work Item',
    problem:       doc.problem       || '',
    gitBranch:     doc.gitBranch     || '',
    currentWork:   doc.currentWork   || '',
    plan:          doc.plan          || '',
    designNotes:   doc.designNotes   || '',
    blockers:      doc.blockers      || '',
    completedItems:(doc.completedItems || []).map((i: any) => ({
      _id:       i._id,
      text:      i.text,
      done:      i.done,
      createdAt: new Date(i.createdAt || Date.now()).getTime(),
    })),
    links: (doc.links || []).map((l: any) => ({
      _id: l._id, label: l.label, url: l.url,
    })),
    status:     doc.status     || 'in-progress',
    isActive:   doc.isActive   ?? true,
    closedAt:   doc.closedAt,
    reopenedAt: doc.reopenedAt,
    mood:       doc.mood       || 3,
    tags:       doc.tags       || [],
    createdAt:  doc.createdAt,
    updatedAt:  doc.updatedAt,
  };
}

// ── Helpers to patch a log in the right list ─────────────────────────────────
function patchInList(logs: WorkLog[], id: string, updated: WorkLog): WorkLog[] {
  return logs.map(l => l._id === id ? updated : l);
}

export const useWorkLogStore = create<WorkLogState>((set, get) => ({
  activeLogs: [],
  closedLogs: [],
  loading:    false,
  creating:   false,
  error:      null,

  // ── Load ────────────────────────────────────────────────────────────────────
  loadActive: async () => {
    set({ loading: true, error: null });
    try {
      const docs = await api.workLogs.list(true);
      set({ activeLogs: docs.map(mapLog), loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  loadClosed: async () => {
    try {
      const docs = await api.workLogs.list(false);
      set({ closedLogs: docs.map(mapLog) });
    } catch (err: any) {
      console.error('loadClosed failed:', err);
    }
  },

  loadAll: async () => {
    set({ loading: true, error: null });
    try {
      const docs = await api.workLogs.list();
      const all  = docs.map(mapLog);
      set({
        activeLogs: all.filter(l => l.isActive),
        closedLogs: all.filter(l => !l.isActive),
        loading: false,
      });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  // ── Create ───────────────────────────────────────────────────────────────────
  createLog: async (title) => {
    set({ creating: true });
    try {
      const doc = await api.workLogs.create({ title, status: 'in-progress', isActive: true });
      const log = mapLog(doc);
      set(s => ({ activeLogs: [log, ...s.activeLogs], creating: false }));
      return log;
    } catch (err: any) {
      set({ creating: false });
      throw err;
    }
  },

  // ── Field update (auto-save) ─────────────────────────────────────────────────
  updateField: async (id, field, value) => {
    const patch = { [field]: value };
    // Optimistic — update whichever list the log is in
    set(s => ({
      activeLogs: patchInList(s.activeLogs, id, { ...s.activeLogs.find(l => l._id === id)!, ...patch }),
      closedLogs: patchInList(s.closedLogs, id, { ...s.closedLogs.find(l => l._id === id)!, ...patch }),
    }));
    await api.workLogs.update(id, patch);
  },

  // ── Delete ───────────────────────────────────────────────────────────────────
  deleteLog: async (id) => {
    set(s => ({
      activeLogs: s.activeLogs.filter(l => l._id !== id),
      closedLogs: s.closedLogs.filter(l => l._id !== id),
    }));
    await api.workLogs.delete(id);
  },

  // ── Close (mark done) ────────────────────────────────────────────────────────
  closeLog: async (id) => {
    const doc = await api.workLogs.close(id);
    const closed = mapLog(doc);
    set(s => ({
      activeLogs: s.activeLogs.filter(l => l._id !== id),
      closedLogs: [closed, ...s.closedLogs],
    }));
  },

  // ── Continue (re-open a closed log) ─────────────────────────────────────────
  continueLog: async (id) => {
    const doc = await api.workLogs.continue(id);
    const active = mapLog(doc);
    set(s => ({
      closedLogs: s.closedLogs.filter(l => l._id !== id),
      activeLogs: [active, ...s.activeLogs],   // bumps to top of active list
    }));
  },

  // ── Completed items ──────────────────────────────────────────────────────────
  addCompleted: async (id, text) => {
    const doc     = await api.workLogs.addCompleted(id, text);
    const updated = mapLog(doc);
    set(s => ({
      activeLogs: patchInList(s.activeLogs, id, updated),
      closedLogs: patchInList(s.closedLogs, id, updated),
    }));
  },

  deleteCompleted: async (id, itemId) => {
    // Optimistic
    const patch = (logs: WorkLog[]) => logs.map(l =>
      l._id === id ? { ...l, completedItems: l.completedItems.filter(i => i._id !== itemId) } : l
    );
    set(s => ({ activeLogs: patch(s.activeLogs), closedLogs: patch(s.closedLogs) }));
    await api.workLogs.deleteCompleted(id, itemId);
  },

  // ── Links ────────────────────────────────────────────────────────────────────
  addLink: async (id, label, url) => {
    const doc     = await api.workLogs.addLink(id, label, url);
    const updated = mapLog(doc);
    set(s => ({
      activeLogs: patchInList(s.activeLogs, id, updated),
      closedLogs: patchInList(s.closedLogs, id, updated),
    }));
  },

  deleteLink: async (id, linkId) => {
    const patch = (logs: WorkLog[]) => logs.map(l =>
      l._id === id ? { ...l, links: l.links.filter(lk => lk._id !== linkId) } : l
    );
    set(s => ({ activeLogs: patch(s.activeLogs), closedLogs: patch(s.closedLogs) }));
    await api.workLogs.deleteLink(id, linkId);
  },
}));
