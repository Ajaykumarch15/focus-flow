import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BrainCircuit, BookOpen, FileText, GitBranch, Clock,
} from 'lucide-react';
import { useStore } from '@worklog/services/useStore';
import { useWorkLogStore } from '@worklog/services/useWorkLogStore';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { api } from '@shared/utils/api';
import {
  mapSession, selectEngineeringMemory,
  type MemoryDecision, type MemorySession, type MemoryView,
} from '@personal/services/memorySelectors';
import { Button } from '@shared/components/ui/Button';
import { StatusBadge } from '@shared/components/ui/StatusBadge';
import { Textarea } from '@shared/components/ui/Textarea';
import { formatMs, formatDateShort } from '@shared/utils/time';
import { useCallback, useEffect } from 'react';

interface EngineeringMemoryTabsProps {
  taskId: string;
}

type TabId = 'journal' | 'worklog' | 'decisions' | 'sessions';

const TABS: Array<{ id: TabId; label: string; icon: typeof BookOpen }> = [
  { id: 'journal', label: 'Journal', icon: BookOpen },
  { id: 'worklog', label: 'Work Log', icon: FileText },
  { id: 'decisions', label: 'Decisions', icon: GitBranch },
  { id: 'sessions', label: 'Session History', icon: Clock },
];

export function EngineeringMemoryTabs({ taskId }: EngineeringMemoryTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('journal');
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickText, setQuickText] = useState('');

  const {
    tasks, journals, activeTaskId, activeSessionId, activeTimerState,
    currentSessionStart, currentPauseStart,
    dataLoading, addJournal,
  } = useStore();
  const {
    workspaces, projects, sprints, features,
    tasks: collabTasks, blockers,
  } = useCollaborationStore();
  const { activeLogs, closedLogs } = useWorkLogStore();

  const [sessions, setSessions] = useState<MemorySession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  const workLogs = useMemo(() => [...activeLogs, ...closedLogs], [activeLogs, closedLogs]);

  const loadSessions = useCallback(() => {
    setSessionsLoading(true);
    api.sessions
      .list()
      .then((docs: any[]) => setSessions(docs.map(mapSession)))
      .catch(() => {})
      .finally(() => setSessionsLoading(false));
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const view: MemoryView = useMemo(
    () => selectEngineeringMemory({
      tasks, collabTasks, workspaces, projects, sprints, features,
      workLogs, blockers, journals,
      activeTaskId, activeSessionId, activeTimerState,
      focusTaskId: taskId,
      sessions,
      currentSessionStart: currentSessionStart ?? null,
      currentPauseStart: currentPauseStart ?? null,
    }),
    [tasks, collabTasks, workspaces, projects, sprints, features, workLogs, blockers, journals, activeTaskId, activeSessionId, activeTimerState, taskId, sessions, currentSessionStart, currentPauseStart],
  );

  const saveQuickNote = async () => {
    const text = quickText.trim();
    if (!text || !view.taskId) return;
    await addJournal({ taskId: view.taskId, content: text, mood: 4, focusRating: 3 });
    setQuickText('');
    setQuickOpen(false);
  };

  if (dataLoading && tasks.length === 0) {
    return (
      <div className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-32 bg-surface-800 rounded" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-8 w-20 bg-surface-800 rounded-lg" />
            ))}
          </div>
          <div className="h-24 bg-surface-800 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-surface-800 bg-surface-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-surface-50">
          <BrainCircuit size={16} className="text-brand-500" />
          Engineering Memory
        </h2>
        <span className="text-[10px] font-semibold text-surface-500 bg-surface-800 px-2 py-0.5 rounded-md">
          Everything related to this task in one place.
        </span>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-surface-800 px-5">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold transition-colors ${
                isActive
                  ? 'text-brand-400'
                  : 'text-surface-500 hover:text-surface-300'
              }`}
            >
              <Icon size={13} />
              {tab.label}
              {isActive && (
                <motion.div
                  layoutId="memory-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-500 rounded-full"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="p-5 min-h-[200px]">
        <AnimatePresence mode="wait">
          {activeTab === 'journal' && (
            <motion.div
              key="journal"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              <JournalTab
                view={view}
                quickOpen={quickOpen}
                quickText={quickText}
                onQuickTextChange={setQuickText}
                onToggleQuickOpen={() => setQuickOpen(!quickOpen)}
                onSaveQuickNote={saveQuickNote}
              />
            </motion.div>
          )}
          {activeTab === 'worklog' && (
            <motion.div
              key="worklog"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              <WorkLogTab view={view} />
            </motion.div>
          )}
          {activeTab === 'decisions' && (
            <motion.div
              key="decisions"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              <DecisionsTab view={view} />
            </motion.div>
          )}
          {activeTab === 'sessions' && (
            <motion.div
              key="sessions"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              <SessionsTab view={view} sessionsLoading={sessionsLoading} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Journal Tab ───────────────────────────────────────────────────────────────

function JournalTab({
  view,
  quickOpen,
  quickText,
  onQuickTextChange,
  onToggleQuickOpen,
  onSaveQuickNote,
}: {
  view: MemoryView;
  quickOpen: boolean;
  quickText: string;
  onQuickTextChange: (text: string) => void;
  onToggleQuickOpen: () => void;
  onSaveQuickNote: () => void;
}) {
  const note = view.lastJournalNote || view.taskJournalNote;

  if (!note && !quickOpen) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <BookOpen size={20} className="text-surface-600" />
        <p className="text-sm font-semibold text-surface-300">No journal entries yet</p>
        <p className="text-xs text-surface-500">Start a focus session to capture your thoughts.</p>
        <Button variant="secondary" size="xs" onClick={onToggleQuickOpen}>Add a note</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {note && (
        <div className="rounded-xl border border-surface-800/60 bg-surface-950/40 px-4 py-3">
          <p className="text-sm text-surface-200 leading-relaxed line-clamp-4">{note.content}</p>
          <p className="text-[11px] text-surface-600 mt-2">{formatDateShort(note.createdAt)}</p>
        </div>
      )}

      {quickOpen ? (
        <div className="flex flex-col gap-2">
          <Textarea
            value={quickText}
            onChange={(e) => onQuickTextChange(e.target.value)}
            placeholder="Capture a quick reflection..."
            className="min-h-20 text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="xs" onClick={onToggleQuickOpen}>Cancel</Button>
            <Button size="xs" onClick={onSaveQuickNote} disabled={!quickText.trim()}>Save note</Button>
          </div>
        </div>
      ) : (
        <Button variant="ghost" size="xs" onClick={onToggleQuickOpen}>Continue writing</Button>
      )}
    </div>
  );
}

// ── Work Log Tab ──────────────────────────────────────────────────────────────

function WorkLogTab({ view }: { view: MemoryView }) {
  const log = view.linkedWorkLog || view.lastWorkLog;

  if (!log) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <FileText size={20} className="text-surface-600" />
        <p className="text-sm font-semibold text-surface-300">No work logs yet</p>
        <p className="text-xs text-surface-500">Work logs will appear here as you work.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-surface-800/60 bg-surface-950/40 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-surface-100 truncate">{log.title}</span>
          <StatusBadge status={log.status} />
        </div>
        <div className="flex items-center gap-4 mt-1 text-xs text-surface-400">
          <span>{formatDateShort(log.updatedAt)}</span>
          {'sessionCount' in log && log.sessionCount > 0 && (
            <span>{log.sessionCount} session{log.sessionCount !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Decisions Tab ─────────────────────────────────────────────────────────────

function DecisionsTab({ view }: { view: MemoryView }) {
  if (view.recentDecisions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <GitBranch size={20} className="text-surface-600" />
        <p className="text-sm font-semibold text-surface-300">No decisions recorded</p>
        <p className="text-xs text-surface-500">Decisions from blockers will appear here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {view.recentDecisions.map((d: MemoryDecision) => (
        <div key={d.id} className="rounded-xl border border-surface-800/60 bg-surface-950/40 px-4 py-3">
          <p className="text-sm font-semibold text-surface-100">{d.title}</p>
          <p className="text-xs text-surface-400 mt-0.5 line-clamp-2">{d.decision}</p>
          <p className="text-[11px] text-surface-600 mt-1">Recorded in {d.workLogTitle}</p>
        </div>
      ))}
    </div>
  );
}

// ── Sessions Tab ──────────────────────────────────────────────────────────────

function SessionsTab({ view, sessionsLoading }: { view: MemoryView; sessionsLoading: boolean }) {
  if (sessionsLoading) {
    return (
      <div className="flex flex-col items-center gap-2 py-6">
        <div className="animate-pulse space-y-2 w-full">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 bg-surface-800 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!view.previousSession && !view.hasActiveSession) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <Clock size={20} className="text-surface-600" />
        <p className="text-sm font-semibold text-surface-300">No sessions yet</p>
        <p className="text-xs text-surface-500">Start a timer to begin tracking.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {view.hasActiveSession && (
        <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <StatusBadge status={view.sessionState} />
            <span className="text-xs font-semibold text-surface-200">Active session</span>
          </div>
          {view.sessionStartAt && (
            <p className="text-xs text-surface-400 mt-1">
              Started at {new Date(view.sessionStartAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </p>
          )}
        </div>
      )}
      {view.previousSession && (
        <div className="rounded-xl border border-surface-800/60 bg-surface-950/40 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-surface-100">
              {formatMs(view.previousSession.activeTime)}
            </span>
            <span className="text-xs text-surface-500">{formatDateShort(view.previousSession.startTime)}</span>
          </div>
          <div className="flex items-center gap-4 mt-1 text-xs text-surface-400">
            {view.previousSession.taskTitle && (
              <span className="truncate">Task: {view.previousSession.taskTitle}</span>
            )}
            {view.previousSession.pauseCount > 0 && (
              <span>{view.previousSession.pauseCount} pause{view.previousSession.pauseCount !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
