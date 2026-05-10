import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitBranch, AlertCircle, CheckCircle2, Plus, Trash2,
  ExternalLink, Link2, Lightbulb, Pencil, BookMarked,
  Zap, Loader2, ChevronDown, ChevronUp, Tag, Save,
  CheckCheck, RotateCcw, X, Sparkles,
} from 'lucide-react';
import { useWorkLogStore, WorkLog, WorkLogStatus } from '../store/useWorkLogStore';
import { formatDistanceToNow } from 'date-fns';

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUS_OPTIONS: { value: WorkLogStatus; label: string; color: string; bg: string; border: string }[] = [
  { value: 'planning',    label: '🗺️ Planning',    color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/30' },
  { value: 'in-progress', label: '⚡ In Progress', color: 'text-brand-400',  bg: 'bg-brand-400/10',  border: 'border-brand-400/30'  },
  { value: 'reviewing',   label: '👀 Reviewing',   color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/30' },
  { value: 'blocked',     label: '🚫 Blocked',     color: 'text-red-400',    bg: 'bg-red-400/10',    border: 'border-red-400/30'    },
  { value: 'done',        label: '✅ Done',         color: 'text-emerald-400',bg: 'bg-emerald-400/10',border: 'border-emerald-400/30'},
];
const MOOD_EMOJIS = ['😔', '😐', '🙂', '😊', '🔥'];

// ── Debounce ──────────────────────────────────────────────────────────────────
function useDebounce<T>(value: T, ms: number): T {
  const [dv, setDv] = useState(value);
  useEffect(() => { const t = setTimeout(() => setDv(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return dv;
}

// ── Auto-saving text input ────────────────────────────────────────────────────
function AutoInput({ logId, field, placeholder, value: initial, mono = false }: {
  logId: string; field: string; placeholder: string; value: string; mono?: boolean;
}) {
  const { updateField } = useWorkLogStore();
  const [val, setVal]   = useState(initial);
  const [saved, setSaved] = useState(true);
  const debounced = useDebounce(val, 700);
  useEffect(() => { setVal(initial); }, [initial]);
  useEffect(() => {
    if (debounced === initial) return;
    setSaved(false);
    updateField(logId, field, debounced).then(() => setSaved(true)).catch(() => setSaved(false));
  }, [debounced]);
  return (
    <div className="relative">
      <input
        className={`input text-sm w-full pr-8 ${mono ? 'font-mono' : ''}`}
        placeholder={placeholder}
        value={val}
        onChange={e => { setVal(e.target.value); setSaved(false); }}
      />
      <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
        {saved ? <Save size={11} className="text-surface-700" /> : <Loader2 size={11} className="text-brand-400 animate-spin" />}
      </div>
    </div>
  );
}

// ── Auto-saving textarea ──────────────────────────────────────────────────────
function AutoTextarea({ logId, field, placeholder, value: initial, rows = 3 }: {
  logId: string; field: string; placeholder: string; value: string; rows?: number;
}) {
  const { updateField } = useWorkLogStore();
  const [val, setVal]   = useState(initial);
  const [saved, setSaved] = useState(true);
  const debounced = useDebounce(val, 700);
  useEffect(() => { setVal(initial); }, [initial]);
  useEffect(() => {
    if (debounced === initial) return;
    setSaved(false);
    updateField(logId, field, debounced).then(() => setSaved(true)).catch(() => setSaved(false));
  }, [debounced]);
  return (
    <div className="relative">
      <textarea
        rows={rows}
        className="input resize-none text-sm w-full pr-8"
        placeholder={placeholder}
        value={val}
        onChange={e => { setVal(e.target.value); setSaved(false); }}
      />
      <div className="absolute right-2.5 bottom-2.5">
        {saved ? <Save size={11} className="text-surface-700" /> : <Loader2 size={11} className="text-brand-400 animate-spin" />}
      </div>
    </div>
  );
}

// ── Single WorkLog card ───────────────────────────────────────────────────────
function WorkLogCard({ log, defaultExpanded = false }: { log: WorkLog; defaultExpanded?: boolean }) {
  const { closeLog, continueLog, deleteLog, addCompleted, deleteCompleted, addLink, deleteLink, updateField } = useWorkLogStore();

  const [expanded, setExpanded]     = useState(defaultExpanded);
  const [newItem, setNewItem]       = useState('');
  const [newLink, setNewLink]       = useState({ label: '', url: '' });
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [closing, setClosing]       = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const status = STATUS_OPTIONS.find(s => s.value === log.status) || STATUS_OPTIONS[1];
  const doneCount = log.completedItems.length;
  const age = formatDistanceToNow(new Date(log.createdAt), { addSuffix: true });

  const handleClose = async () => {
    setClosing(true);
    try { await closeLog(log._id); } finally { setClosing(false); }
  };

  const handleContinue = async () => {
    setContinuing(true);
    try { await continueLog(log._id); } finally { setContinuing(false); }
  };

  const handleAddCompleted = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.trim()) return;
    await addCompleted(log._id, newItem.trim());
    setNewItem('');
  };

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLink.label.trim() || !newLink.url.trim()) return;
    await addLink(log._id, newLink.label, newLink.url);
    setNewLink({ label: '', url: '' });
    setShowLinkForm(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className={`card overflow-hidden ${log.isActive ? 'border-surface-700' : 'border-surface-800 opacity-75'}`}
    >
      {/* ── Card Header ───────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Status dot */}
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${log.isActive ? 'bg-brand-400 animate-pulse' : 'bg-surface-600'}`} />

        {/* Title */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-white text-sm truncate">{log.title}</span>
            <span className={`badge text-xs ${status.bg} ${status.color} border ${status.border}`}>
              {status.label}
            </span>
            {log.gitBranch && (
              <span className="flex items-center gap-1 text-xs text-emerald-400 font-mono">
                <GitBranch size={10} />{log.gitBranch}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-surface-500">{age}</span>
            {doneCount > 0 && (
              <span className="flex items-center gap-1 text-xs text-emerald-400">
                <CheckCircle2 size={11} />{doneCount} done
              </span>
            )}
            {log.reopenedAt && (
              <span className="text-xs text-yellow-400/70 flex items-center gap-1">
                <RotateCcw size={10} /> continued
              </span>
            )}
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <span className="text-lg">{MOOD_EMOJIS[(log.mood || 3) - 1]}</span>

          {log.isActive ? (
            <button
              onClick={handleClose}
              disabled={closing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 rounded-lg text-xs font-medium transition-all"
              title="Mark this work log as done"
            >
              {closing ? <Loader2 size={12} className="animate-spin" /> : <CheckCheck size={12} />}
              Done
            </button>
          ) : (
            <button
              onClick={handleContinue}
              disabled={continuing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500/15 hover:bg-brand-500/25 text-brand-400 rounded-lg text-xs font-medium transition-all"
              title="Continue working on this"
            >
              {continuing ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
              Continue
            </button>
          )}

          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button onClick={() => deleteLog(log._id)} className="px-2 py-1 bg-red-500 text-white rounded-lg text-xs">Yes</button>
              <button onClick={() => setConfirmDelete(false)} className="px-2 py-1 bg-surface-700 text-white rounded-lg text-xs">No</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="p-1.5 text-surface-600 hover:text-red-400 transition-colors rounded-lg">
              <Trash2 size={14} />
            </button>
          )}

          {expanded ? <ChevronUp size={15} className="text-surface-500 ml-1" /> : <ChevronDown size={15} className="text-surface-500 ml-1" />}
        </div>
      </div>

      {/* ── Expanded Body ─────────────────────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden border-t border-surface-800"
          >
            <div className="p-5 space-y-5">

              {/* Status + Mood row */}
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-surface-400">Status</span>
                  <div className="flex gap-1">
                    {STATUS_OPTIONS.filter(s => s.value !== 'done').map(s => (
                      <button
                        key={s.value}
                        onClick={() => updateField(log._id, 'status', s.value)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                          log.status === s.value
                            ? `${s.bg} ${s.color} ring-1 ring-current`
                            : 'bg-surface-800 text-surface-500 hover:text-white'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs text-surface-400">Energy</span>
                  {MOOD_EMOJIS.map((emoji, i) => (
                    <button key={i} onClick={() => updateField(log._id, 'mood', i + 1)}
                      className={`text-base transition-all ${log.mood === i + 1 ? 'scale-125' : 'opacity-30 hover:opacity-60'}`}>
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* LEFT */}
                <div className="space-y-4">

                  {/* Problem */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs text-red-400 font-medium mb-1.5">
                      <AlertCircle size={12} /> Problem I'm Solving
                    </label>
                    <AutoTextarea logId={log._id} field="problem"
                      placeholder="What ticket/feature/bug? What user pain does it solve?" value={log.problem} rows={3} />
                  </div>

                  {/* Git Branch */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium mb-1.5">
                      <GitBranch size={12} /> Git Branch
                    </label>
                    <AutoInput logId={log._id} field="gitBranch"
                      placeholder="feature/your-branch-name" value={log.gitBranch} mono />
                  </div>

                  {/* Current work */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs text-brand-400 font-medium mb-1.5">
                      <Zap size={12} /> What I'm Doing Right Now
                    </label>
                    <AutoTextarea logId={log._id} field="currentWork"
                      placeholder="Specific function, component, API, bug fix…" value={log.currentWork} rows={3} />
                  </div>

                  {/* Blockers */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs text-yellow-400 font-medium mb-1.5">
                      <AlertCircle size={12} /> Blockers / Questions
                    </label>
                    <AutoTextarea logId={log._id} field="blockers"
                      placeholder="What's blocking you? What do you need to ask?" value={log.blockers} rows={2} />
                  </div>
                </div>

                {/* RIGHT */}
                <div className="space-y-4">

                  {/* Completed checklist */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium mb-1.5">
                      <CheckCircle2 size={12} /> Completed
                    </label>
                    <div className="space-y-1.5 mb-2">
                      <AnimatePresence>
                        {log.completedItems.length === 0 && (
                          <p className="text-xs text-surface-600 italic">Add things as you finish them…</p>
                        )}
                        {log.completedItems.map(item => (
                          <motion.div key={item._id}
                            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }}
                            className="flex items-start gap-2 group p-1.5 rounded-lg hover:bg-surface-800/50"
                          >
                            <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                            <span className="flex-1 text-xs text-surface-200">{item.text}</span>
                            <button onClick={() => deleteCompleted(log._id, item._id)}
                              className="opacity-0 group-hover:opacity-100 text-surface-600 hover:text-red-400 transition-all">
                              <X size={11} />
                            </button>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                    <form onSubmit={handleAddCompleted} className="flex gap-2">
                      <input className="input flex-1 text-xs py-1.5"
                        placeholder="I just completed…"
                        value={newItem} onChange={e => setNewItem(e.target.value)} />
                      <button type="submit" disabled={!newItem.trim()} className="btn-primary px-2.5 py-1.5">
                        <Plus size={13} />
                      </button>
                    </form>
                  </div>

                  {/* Plan */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs text-yellow-400 font-medium mb-1.5">
                      <Lightbulb size={12} /> Plan & Next Steps
                    </label>
                    <AutoTextarea logId={log._id} field="plan"
                      placeholder={"1. First I'll…\n2. Then…\n3. Finally…"} value={log.plan} rows={4} />
                  </div>

                  {/* Design notes */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs text-purple-400 font-medium mb-1.5">
                      <Pencil size={12} /> Design / Architecture Notes
                    </label>
                    <AutoTextarea logId={log._id} field="designNotes"
                      placeholder="Schema, component structure, API shape, tradeoffs…" value={log.designNotes} rows={3} />
                  </div>

                  {/* Links */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs text-cyan-400 font-medium mb-1.5">
                      <Link2 size={12} /> Links (PR, Jira, Figma, Docs)
                    </label>
                    <div className="space-y-1.5 mb-2">
                      {log.links.map(link => (
                        <div key={link._id} className="flex items-center gap-2 p-1.5 rounded-lg bg-surface-800/50 group">
                          <ExternalLink size={11} className="text-cyan-400 flex-shrink-0" />
                          <a href={link.url} target="_blank" rel="noreferrer"
                            className="flex-1 text-xs text-cyan-300 hover:text-cyan-200 truncate transition-colors">
                            {link.label}
                          </a>
                          <button onClick={() => deleteLink(log._id, link._id)}
                            className="opacity-0 group-hover:opacity-100 text-surface-600 hover:text-red-400 transition-all">
                            <X size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <AnimatePresence>
                      {showLinkForm ? (
                        <motion.form initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          onSubmit={handleAddLink} className="space-y-1.5">
                          <input className="input text-xs py-1.5" placeholder="Label (PR #42, Jira PROJ-123…)"
                            value={newLink.label} onChange={e => setNewLink(p => ({ ...p, label: e.target.value }))} />
                          <input className="input text-xs py-1.5" type="url" placeholder="https://…"
                            value={newLink.url} onChange={e => setNewLink(p => ({ ...p, url: e.target.value }))} />
                          <div className="flex gap-2">
                            <button type="button" onClick={() => setShowLinkForm(false)} className="btn-secondary flex-1 text-xs py-1.5">Cancel</button>
                            <button type="submit" className="btn-primary flex-1 text-xs py-1.5">Add</button>
                          </div>
                        </motion.form>
                      ) : (
                        <button onClick={() => setShowLinkForm(true)}
                          className="text-xs text-surface-500 hover:text-white flex items-center gap-1 transition-colors">
                          <Plus size={12} /> Add link
                        </button>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Create Log Modal ──────────────────────────────────────────────────────────
function CreateLogModal({ onClose }: { onClose: () => void }) {
  const { createLog, creating } = useWorkLogStore();
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setError('');
    try {
      await createLog(title.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create work log');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-surface-900 border border-surface-700 rounded-2xl p-6 w-full max-w-md shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-brand-500/15 flex items-center justify-center">
            <Sparkles size={17} className="text-brand-400" />
          </div>
          <div>
            <h2 className="text-base font-display font-bold text-white">New Work Log</h2>
            <p className="text-xs text-surface-400">Give this work item a clear name</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">{error}</div>
        )}

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm text-surface-300 mb-1.5">Work Item Title *</label>
            <input
              className="input"
              placeholder="e.g. Fix login API bug, Build user profile page…"
              value={title}
              onChange={e => setTitle(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-surface-500 mt-1">
              You can work on this across multiple days — it stays open until you mark it done.
            </p>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={creating || !title.trim()} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              Create
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function WorkLogPage() {
  const { activeLogs, closedLogs, loading, loadAll } = useWorkLogStore();
  const [showCreate, setShowCreate] = useState(false);
  const [showClosed, setShowClosed] = useState(false);

  useEffect(() => { loadAll(); }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-white flex items-center gap-2">
            <BookMarked size={22} className="text-brand-400" /> Work Logs
          </h1>
          <p className="text-surface-400 text-sm mt-1">
            {activeLogs.length} active · {closedLogs.length} completed
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> New Work Log
        </button>
      </motion.div>

      {/* Active logs */}
      {loading && activeLogs.length === 0 ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={28} className="animate-spin text-brand-400" />
        </div>
      ) : activeLogs.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-12 text-center mb-6">
          <BookMarked size={40} className="text-surface-700 mx-auto mb-4" />
          <h3 className="font-medium text-white mb-2">No active work logs</h3>
          <p className="text-surface-400 text-sm mb-5">
            Create a work log for each thing you're working on today.<br />
            Each one stays open until you mark it done.
          </p>
          <button onClick={() => setShowCreate(true)} className="btn-primary mx-auto flex items-center gap-2">
            <Plus size={15} /> Create First Work Log
          </button>
        </motion.div>
      ) : (
        <div className="space-y-3 mb-6">
          <AnimatePresence mode="popLayout">
            {activeLogs.map((log, i) => (
              <WorkLogCard key={log._id} log={log} defaultExpanded={i === 0} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Closed / History */}
      {closedLogs.length > 0 && (
        <div>
          <button
            onClick={() => setShowClosed(!showClosed)}
            className="flex items-center gap-2 text-surface-400 hover:text-white text-sm font-medium transition-colors mb-3"
          >
            <CheckCheck size={15} className="text-emerald-400" />
            Completed Work Logs ({closedLogs.length})
            {showClosed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          <AnimatePresence>
            {showClosed && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3 overflow-hidden"
              >
                {closedLogs.map(log => (
                  <WorkLogCard key={log._id} log={log} defaultExpanded={false} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {showCreate && <CreateLogModal onClose={() => setShowCreate(false)} />}
      </AnimatePresence>
    </div>
  );
}
