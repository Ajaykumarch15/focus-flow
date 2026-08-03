import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Layers, FolderOpen, AlertOctagon, BookOpen, Calendar, BarChart3,
  ShieldCheck, Plus, Search, GitBranch, Clock,
  CheckCircle2, ChevronDown, MessageSquare, Flame,
  Zap, Edit3, UserCheck
} from 'lucide-react';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import { SprintStatus, MemberRole } from '../../types/collaboration';
import { activityActionLabel, activityDetail } from '../../lib/collaborationActivity';
import { DiscussionsModal } from '../../components/collaboration/DiscussionsModal';
import { CreateProjectModal } from '../../components/collaboration/CreateProjectModal';
import { CreateBlockerModal } from '../../components/collaboration/CreateBlockerModal';
import { CreateDocModal } from '../../components/collaboration/CreateDocModal';
import { GlobalCommandPalette } from '../../components/collaboration/GlobalCommandPalette';

// ── Motion Variants ────────────────────────────────────────────────────────────
const stagger = { show: { transition: { staggerChildren: 0.06 } } };

type TeamTab = 'dashboard' | 'sprints' | 'projects' | 'blockers' | 'docs' | 'calendar' | 'analytics' | 'admin';

export function TeamWorkspace() {
  const {
    workspaces, activeWorkspaceId, setActiveWorkspace,
    members, projects, sprints, tasks, activities,
    docs, blockers, events, updateTaskStatus, updateMemberRole, resolveBlocker,
    loadWorkspaceActivity, activityLoading, activityHasMore, activityNextCursor
  } = useCollaborationStore();

  const activeWs = useMemo(
    () => workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0],
    [workspaces, activeWorkspaceId]
  );

  // IES-P2-04: load the real, workspace-scoped activity feed whenever the
  // active workspace changes (demo workspace ids have no backend activity and
  // simply render the empty state).
  useEffect(() => {
    if (activeWs) loadWorkspaceActivity(activeWs.id);
  }, [activeWs?.id, loadWorkspaceActivity]);

  // Tabs
  const [activeTab, setActiveTab] = useState<TeamTab>('dashboard');

  // Modals & States
  const [showWsMenu, setShowWsMenu] = useState(false);
  const [, setShowNewWsModal] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showCreateBlocker, setShowCreateBlocker] = useState(false);
  const [showCreateDoc, setShowCreateDoc] = useState(false);
  const [editingDoc, setEditingDoc] = useState<any>(null);
  const [showSearch, setShowSearch] = useState(false);

  // Discussions Modal state
  const [discModal, setDiscModal] = useState<{ open: boolean; targetType: any; targetId: string; title: string }>({
    open: false, targetType: 'task', targetId: '', title: ''
  });

  // ── Helper computations ──────────────────────────────────────────────────────
  const wsTasks = useMemo(() => activeWs ? tasks.filter((t) => t.workspaceId === activeWs.id) : [], [tasks, activeWs?.id]);
  const wsBlockers = useMemo(() => activeWs ? blockers.filter((b) => b.workspaceId === activeWs.id) : [], [blockers, activeWs?.id]);
  const wsDocs = useMemo(() => activeWs ? docs.filter((d) => d.workspaceId === activeWs.id) : [], [docs, activeWs?.id]);
  const wsProjects = useMemo(() => activeWs ? projects.filter((p) => p.workspaceId === activeWs.id) : [], [projects, activeWs?.id]);
  const wsActivities = useMemo(() => activeWs ? activities.filter((a) => a.workspaceId === activeWs.id) : [], [activities, activeWs?.id]);

  const activeSprint = useMemo(() => activeWs ? sprints.find((s) => s.workspaceId === activeWs.id && s.status === 'active') : undefined, [sprints, activeWs?.id]);

  // Presence counters
  const onlineMembers = members.filter((m) => m.status !== 'offline');
  const focusingMembers = members.filter((m) => m.status === 'in_focus');
  const openBlockers = wsBlockers.filter((b) => b.status !== 'resolved');

  if (!activeWs) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center text-surface-500">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-surface-700 border-t-brand-500 rounded-full animate-spin" />
          <p className="text-sm font-semibold">Loading workspace…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">

      {/* ═══ Top Workspace Switcher Header ═══ */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-surface-800 pb-5">
        <div className="flex items-center gap-3 flex-wrap">

          {/* Workspace Dropdown */}
          <div className="relative">
            <button onClick={() => setShowWsMenu(!showWsMenu)}
              className="flex items-center gap-3 bg-surface-900 border border-surface-700/80 hover:border-brand-500/50 px-4 py-2.5 rounded-2xl transition-all shadow-sm group">
              <span className="text-2xl">{activeWs.icon}</span>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <h1 className="font-display font-extrabold text-surface-50 text-base leading-tight group-hover:text-brand-300 transition-colors">
                    {activeWs.name}
                  </h1>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-brand-500/15 text-brand-400 px-2 py-0.5 rounded-md border border-brand-500/20">
                    {activeWs.type}
                  </span>
                </div>
                <p className="text-xs text-surface-400 mt-0.5">{activeWs.description}</p>
              </div>
              <ChevronDown size={16} className={`text-surface-500 transition-transform ml-2 ${showWsMenu ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            <AnimatePresence>
              {showWsMenu && (
                <motion.div initial={{ opacity: 0, y: 8, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }} transition={{ duration: 0.15 }}
                  className="absolute left-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-surface-800 bg-surface-900 shadow-2xl overflow-hidden z-40 p-2 space-y-1">
                  <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-surface-500">
                    Workspaces ({workspaces.length})
                  </div>
                  {workspaces.map((ws) => (
                    <button key={ws.id} onClick={() => { setActiveWorkspace(ws.id); setShowWsMenu(false); }}
                      className={`w-full text-left flex items-center gap-3 p-3 rounded-xl transition-all ${
                        ws.id === activeWs.id ? 'bg-brand-500/15 border border-brand-500/30 text-surface-50' : 'hover:bg-surface-800 text-surface-300'
                      }`}>
                      <span className="text-xl">{ws.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate">{ws.name}</p>
                        <p className="text-[10px] text-surface-400">{ws.type} · {ws.membersCount} members</p>
                      </div>
                    </button>
                  ))}
                  <div className="border-t border-surface-800 pt-1">
                    <button onClick={() => { setShowWsMenu(false); setShowNewWsModal(true); }}
                      className="w-full flex items-center gap-2 p-2.5 text-xs font-semibold text-brand-400 hover:bg-brand-500/10 rounded-xl transition-colors">
                      <Plus size={14} /> Create New Workspace
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button onClick={() => setShowSearch(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-surface-900 border border-surface-800 text-xs text-surface-400 hover:text-surface-200 hover:border-surface-700 transition-all">
            <Search size={14} />
            <span>Search Workspace</span>
            <kbd className="text-[10px] font-mono bg-surface-800 px-1.5 py-0.5 rounded border border-surface-700 ml-2">Cmd+K</kbd>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCreateBlocker(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-bold transition-all">
            <AlertOctagon size={14} /> Report Blocker
          </button>
          <button onClick={() => setShowCreateProject(true)}
            className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg shadow-brand-500/20 text-xs font-bold">
            <Plus size={15} /> New Project
          </button>
        </div>
      </div>

      {/* ═══ Phase X Tab Navigation Bar ═══ */}
      <div className="flex items-center gap-2 border-b border-surface-800 pb-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'dashboard', label: 'Live Dashboard', icon: Zap, color: 'text-amber-400' },
          { id: 'sprints', label: 'Sprint Board', icon: Layers, color: 'text-brand-400', count: wsTasks.length },
          { id: 'projects', label: 'Projects', icon: FolderOpen, color: 'text-cyan-400', count: wsProjects.length },
          { id: 'blockers', label: 'Blockers Matrix', icon: AlertOctagon, color: 'text-red-400', count: openBlockers.length },
          { id: 'docs', label: 'Knowledge Base', icon: BookOpen, color: 'text-purple-400', count: wsDocs.length },
          { id: 'calendar', label: 'Team Calendar', icon: Calendar, color: 'text-emerald-400' },
          { id: 'analytics', label: 'Analytics & Reports', icon: BarChart3, color: 'text-sky-400' },
          { id: 'admin', label: 'Teams & Access', icon: ShieldCheck, color: 'text-orange-400' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as TeamTab)}
              className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                isActive ? 'text-surface-50 bg-surface-900 border border-surface-700/80 shadow-md' : 'text-surface-400 hover:text-surface-200 hover:bg-surface-850/50'
              }`}>
              <tab.icon size={15} className={isActive ? tab.color : ''} />
              {tab.label}
              {tab.count !== undefined && (
                <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md ${
                  isActive ? 'bg-brand-500/20 text-brand-300' : 'bg-surface-800 text-surface-500'
                }`}>{tab.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ═══ TAB CONTENT PANELS ═══ */}

      {/* ── TAB 1: LIVE DASHBOARD ── */}
      {activeTab === 'dashboard' && (
        <motion.div initial="hidden" animate="show" variants={stagger} className="space-y-6">

          {/* Top Presence & Live Status Banner */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-surface-800 bg-gradient-to-br from-brand-500/10 to-surface-900 p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-surface-400">Team Online</span>
                <Users size={16} className="text-brand-400" />
              </div>
              <p className="text-2xl font-display font-extrabold text-surface-50">{onlineMembers.length} / {members.length}</p>
              <p className="text-[11px] text-brand-400 mt-1 font-medium">Asynchronous presence</p>
            </div>

            <div className="rounded-2xl border border-surface-800 bg-gradient-to-br from-amber-500/10 to-surface-900 p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-surface-400">In Focus Session</span>
                <Flame size={16} className="text-amber-400" />
              </div>
              <p className="text-2xl font-display font-extrabold text-amber-400">{focusingMembers.length}</p>
              <p className="text-[11px] text-amber-400/80 mt-1 font-medium">Deep work preserved</p>
            </div>

            <div className="rounded-2xl border border-surface-800 bg-gradient-to-br from-red-500/10 to-surface-900 p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-surface-400">Open Blockers</span>
                <AlertOctagon size={16} className="text-red-400" />
              </div>
              <p className="text-2xl font-display font-extrabold text-red-400">{openBlockers.length}</p>
              <p className="text-[11px] text-red-400/80 mt-1 font-medium">Needs manager attention</p>
            </div>

            <div className="rounded-2xl border border-surface-800 bg-gradient-to-br from-purple-500/10 to-surface-900 p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-surface-400">Active Sprint Velocity</span>
                <BarChart3 size={16} className="text-purple-400" />
              </div>
              <p className="text-2xl font-display font-extrabold text-purple-400">{activeSprint?.actualVelocity ?? '—'} pts</p>
              <p className="text-[11px] text-purple-400/80 mt-1 font-medium">Target: {activeSprint?.targetVelocity ?? '—'} pts</p>
            </div>
          </div>

          {/* Member Presence Matrix + Engineering Activity Feed */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">

            {/* Member Presence Matrix */}
            <div className="rounded-2xl border border-surface-800 bg-surface-900 p-6 space-y-4">
              <h3 className="font-display font-extrabold text-surface-50 text-base flex items-center gap-2">
                <UserCheck size={18} className="text-brand-400" /> Developer Presence & Deep Work
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {members.map((member) => {
                  const isFocus = member.status === 'in_focus';
                  const isMeeting = member.status === 'in_meeting';
                  return (
                    <div key={member.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isFocus ? 'border-amber-500/40 bg-amber-500/5' : isMeeting ? 'border-purple-500/30 bg-purple-500/5' : 'border-surface-800 bg-surface-850/50'
                      }`}>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="relative">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-cyan-500 flex items-center justify-center font-bold text-white text-sm">
                            {member.name.charAt(0)}
                          </div>
                          <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface-900 ${
                            isFocus ? 'bg-amber-400' : member.status === 'available' ? 'bg-emerald-400' : isMeeting ? 'bg-purple-400' : 'bg-surface-600'
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-surface-100 truncate">{member.name}</p>
                          <p className="text-[11px] text-surface-400 capitalize">{member.role} · {member.teams.join(', ')}</p>
                        </div>
                      </div>
                      {member.currentFocusTask ? (
                        <div className="mt-2 text-xs bg-surface-800/80 p-2.5 rounded-lg border border-surface-700/50 text-surface-300">
                          <p className="font-semibold text-amber-400 flex items-center gap-1.5 text-[11px]">
                            <Flame size={11} /> Focusing on:
                          </p>
                          <p className="truncate mt-0.5">{member.currentFocusTask}</p>
                        </div>
                      ) : (
                        <p className="text-xs text-surface-500 italic mt-2">Available for async review</p>
                      )}
                    </div>
                  );
                })}
              </div>
              {members.length === 0 && (
                <p className="text-xs text-surface-500 italic py-4 text-center">No members in this workspace yet.</p>
              )}
            </div>

            {/* Live Engineering Activity Feed */}
            <div className="rounded-2xl border border-surface-800 bg-surface-900 p-6 space-y-4">
              <h3 className="font-display font-extrabold text-surface-50 text-base flex items-center gap-2">
                <Clock size={18} className="text-purple-400" /> Engineering Activity
              </h3>
              <div className="space-y-3">
                {activityLoading && wsActivities.length === 0 && (
                  <p className="text-xs text-surface-500 italic">Loading activity…</p>
                )}
                {!activityLoading && wsActivities.length === 0 && (
                  <p className="text-xs text-surface-500 italic">No activity yet.</p>
                )}
                {wsActivities.map((act) => (
                  <div key={act.id} className="p-3 rounded-xl border border-surface-800 bg-surface-850/40 text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-surface-100">{act.actor.name}</span>
                      <span className="text-surface-400 font-semibold">{activityActionLabel(act.action)}</span>
                    </div>
                    <p className="text-surface-300">{activityDetail(act)}</p>
                    <p className="text-[10px] text-surface-500 mt-1 font-mono">
                      {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))}
                {activityHasMore && (
                  <button
                    type="button"
                    onClick={() => loadWorkspaceActivity(activeWs.id, { cursor: activityNextCursor ?? undefined, append: true })}
                    className="w-full text-xs font-semibold text-brand-300 hover:text-brand-200 py-2 rounded-lg border border-surface-800 hover:border-brand-500/40 transition-colors"
                  >
                    Load more activity
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── TAB 2: SPRINT BOARD (KANBAN & AGILE) ── */}
      {activeTab === 'sprints' && (
        <div className="space-y-6">

          {/* Sprint Details & Capacity Header */}
          {activeSprint && (
            <div className="rounded-2xl border border-surface-800 bg-surface-900 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-display font-extrabold text-surface-50 flex items-center gap-2">
                  <Layers size={18} className="text-brand-400" /> {activeSprint.name}
                </h2>
                <p className="text-xs text-surface-400 mt-1">Goal: {activeSprint.goal}</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold">
                <div className="p-3 rounded-xl bg-surface-850 border border-surface-800 text-center">
                  <p className="text-brand-400 font-bold">{activeSprint.capacityHours}h</p>
                  <p className="text-[10px] text-surface-500">Capacity</p>
                </div>
                <div className="p-3 rounded-xl bg-surface-850 border border-surface-800 text-center">
                  <p className="text-emerald-400 font-bold">{wsTasks.filter(t => t.sprintStatus === 'done').length} / {wsTasks.length}</p>
                  <p className="text-[10px] text-surface-500 font-bold uppercase">Tasks Done</p>
                </div>
              </div>
            </div>
          )}

          {/* 5-Column Kanban Board */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {(
              [
                { id: 'backlog', label: 'Backlog', color: 'border-surface-700 text-surface-400' },
                { id: 'ready', label: 'Ready', color: 'border-blue-500/40 text-blue-400' },
                { id: 'in_progress', label: 'In Progress', color: 'border-sky-500/40 text-sky-400' },
                { id: 'review', label: 'Code Review', color: 'border-purple-500/40 text-purple-400' },
                { id: 'done', label: 'Done', color: 'border-emerald-500/40 text-emerald-400' },
              ] as const
            ).map((col) => {
              const colTasks = wsTasks.filter((t) => t.sprintStatus === col.id);
              return (
                <div key={col.id} className="rounded-2xl border border-surface-800 bg-surface-900 p-4 space-y-3 min-h-[500px]">
                  <div className={`pb-2 border-b flex items-center justify-between ${col.color}`}>
                    <span className="font-display font-extrabold text-xs uppercase tracking-wider">{col.label}</span>
                    <span className="text-xs font-bold bg-surface-800 px-2 py-0.5 rounded-md text-surface-300">{colTasks.length}</span>
                  </div>

                  <div className="space-y-3">
                    {colTasks.map((task) => (
                      <div key={task.id} className="rounded-xl border border-surface-800 bg-surface-850 p-3.5 space-y-2 hover:border-surface-700 transition-all group">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold text-brand-400 uppercase">{task.priority}</span>
                          {task.gitContext?.prNumber && (
                            <span className="font-mono text-purple-400 font-bold bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                              PR #{task.gitContext.prNumber}
                            </span>
                          )}
                        </div>

                        <p className="text-xs font-bold text-surface-100 leading-snug">{task.title}</p>
                        <p className="text-[11px] text-surface-400 line-clamp-2">{task.description}</p>

                        {/* Git Context Badges */}
                        {task.gitContext?.branch && (
                          <div className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20 flex items-center gap-1 truncate">
                            <GitBranch size={10} /> {task.gitContext.branch}
                          </div>
                        )}

                        {/* Action Bar */}
                        <div className="pt-2 border-t border-surface-800 flex items-center justify-between text-[11px]">
                          <button onClick={() => setDiscModal({ open: true, targetType: 'task', targetId: task.id, title: task.title })}
                            className="text-surface-400 hover:text-brand-400 flex items-center gap-1 transition-colors">
                            <MessageSquare size={12} /> Discuss
                          </button>

                          {/* Quick Status Move */}
                          <select aria-label="Task status" className="bg-surface-800 text-surface-300 text-[10px] rounded border border-surface-700 px-1 py-0.5"
                            value={task.sprintStatus} onChange={(e) => updateTaskStatus(task.id, e.target.value as SprintStatus)}>
                            <option value="backlog">Backlog</option>
                            <option value="ready">Ready</option>
                            <option value="in_progress">In Progress</option>
                            <option value="review">Review</option>
                            <option value="done">Done</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 3: PROJECTS & MILESTONES ── */}
      {activeTab === 'projects' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {wsProjects.map((proj) => (
              <div key={proj.id} className="rounded-2xl border border-surface-800 bg-surface-900 p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400 bg-brand-500/15 px-2 py-0.5 rounded-md border border-brand-500/20">
                      {proj.key}
                    </span>
                    <h3 className="text-lg font-display font-extrabold text-surface-50 mt-1">{proj.name}</h3>
                  </div>
                  {proj.repositoryUrl && (
                    <a href={proj.repositoryUrl} target="_blank" rel="noreferrer"
                      className="p-2 rounded-xl bg-surface-800 hover:bg-surface-700 text-surface-300 flex items-center gap-1.5 text-xs font-semibold">
                      <GitBranch size={14} /> Repository
                    </a>
                  )}
                </div>

                <p className="text-xs text-surface-400 leading-relaxed">{proj.description}</p>

                {/* Milestones */}
                <div className="space-y-2 pt-2 border-t border-surface-800">
                  <p className="text-xs font-bold text-surface-300">Active Milestones</p>
                  {proj.milestones.map((ms) => (
                    <div key={ms.id} className="p-3 rounded-xl bg-surface-850 border border-surface-800 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-semibold text-surface-100">{ms.title}</p>
                        <p className="text-[10px] text-surface-500">Due: {ms.dueDate}</p>
                      </div>
                      <span className="text-[10px] font-bold uppercase text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        {ms.targetPoints} pts
                      </span>
                    </div>
                  ))}
                  {proj.milestones.length === 0 && (
                    <p className="text-xs text-surface-500 italic">No milestones set.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          {wsProjects.length === 0 && (
            <div className="rounded-2xl border border-dashed border-surface-700 bg-surface-900/60 p-12 text-center text-xs text-surface-400 italic">
              No projects yet. Create your first project from the "New Project" button.
            </div>
          )}
        </div>
      )}

      {/* ── TAB 4: CENTRAL BLOCKER MATRIX ── */}
      {activeTab === 'blockers' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-surface-800 bg-surface-900 p-6 space-y-4">
            <h2 className="text-base font-display font-extrabold text-surface-50 flex items-center gap-2">
              <AlertOctagon size={18} className="text-red-400" /> Blocker Resolution Board
            </h2>
            <div className="space-y-3">
              {wsBlockers.map((blk) => (
                <div key={blk.id} className="p-4 rounded-xl border border-surface-800 bg-surface-850 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded border ${
                        blk.severity === 'critical' ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      }`}>
                        {blk.severity}
                      </span>
                      <h4 className="text-sm font-bold text-surface-100">{blk.title}</h4>
                    </div>
                    <p className="text-xs text-surface-400">{blk.impactDescription}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    {blk.status === 'resolved' ? (
                      <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20 flex items-center gap-1">
                        <CheckCircle2 size={13} /> Resolved
                      </span>
                    ) : (
                      <button onClick={() => resolveBlocker(blk.id)}
                        className="btn-primary px-3.5 py-1.5 rounded-xl text-xs font-bold">
                        Resolve Blocker
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {wsBlockers.length === 0 && (
              <p className="text-xs text-surface-500 italic py-4 text-center">No blockers reported.</p>
            )}
          </div>
        </div>
      )}
      {activeTab === 'docs' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-display font-extrabold text-surface-50 flex items-center gap-2">
              <BookOpen size={18} className="text-purple-400" /> Knowledge Base Documents
            </h2>
            <button onClick={() => { setEditingDoc(null); setShowCreateDoc(true); }}
              className="btn-primary px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5">
              <Plus size={14} /> New Document
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {wsDocs.map((doc) => (
              <div key={doc.id} className="rounded-2xl border border-surface-800 bg-surface-900 p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 bg-purple-500/15 px-2 py-0.5 rounded border border-purple-500/20">
                    {doc.category} · v{doc.version}
                  </span>
                  <button onClick={() => { setEditingDoc(doc); setShowCreateDoc(true); }}
                    aria-label={`Edit document ${doc.title}`} className="p-1 text-surface-500 hover:text-surface-200">
                    <Edit3 size={14} />
                  </button>
                </div>

                <h3 className="text-base font-bold text-surface-50">{doc.title}</h3>
                <div className="p-3 rounded-xl bg-surface-850 font-mono text-xs text-surface-300 max-h-36 overflow-y-auto whitespace-pre-wrap leading-relaxed border border-surface-800">
                  {doc.content}
                </div>
              </div>
            ))}
          </div>
          {wsDocs.length === 0 && (
            <p className="text-xs text-surface-500 italic py-4 text-center">No knowledge docs yet.</p>
          )}
        </div>
      )}

      {/* ── TAB 6: TEAM CALENDAR ── */}
      {activeTab === 'calendar' && (
        <div className="rounded-2xl border border-surface-800 bg-surface-900 p-6 space-y-4">
          <h2 className="text-base font-display font-extrabold text-surface-50 flex items-center gap-2">
            <Calendar size={18} className="text-emerald-400" /> Engineering Releases & Milestones
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {events.map((ev) => (
              <div key={ev.id} className="p-4 rounded-xl border border-surface-800 bg-surface-850 space-y-1">
                <span className="text-[10px] font-bold uppercase text-emerald-400">{ev.type}</span>
                <p className="text-sm font-bold text-surface-100">{ev.title}</p>
                <p className="text-xs text-surface-500">{ev.date} {ev.endDate ? `→ ${ev.endDate}` : ''}</p>
              </div>
            ))}
          </div>
          {events.length === 0 && (
            <p className="text-xs text-surface-500 italic py-4 text-center">No calendar events yet.</p>
          )}
        </div>
      )}

      {/* ── TAB 7: TEAM ANALYTICS & REPORTS ── */}
      {activeTab === 'analytics' && (
        <div className="rounded-2xl border border-surface-800 bg-surface-900 p-6 space-y-4">
          <h2 className="text-base font-display font-extrabold text-surface-50 flex items-center gap-2">
            <BarChart3 size={18} className="text-sky-400" /> Team Cycle Time & Focus Metrics
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="p-5 rounded-xl bg-surface-850 border border-surface-800">
              <p className="text-2xl font-bold text-sky-400">—</p>
              <p className="text-xs text-surface-400 mt-1">Average Task Cycle Time</p>
            </div>
            <div className="p-5 rounded-xl bg-surface-850 border border-surface-800">
              <p className="text-2xl font-bold text-emerald-400">—</p>
              <p className="text-xs text-surface-400 mt-1">Daily Focus Time per Developer</p>
            </div>
            <div className="p-5 rounded-xl bg-surface-850 border border-surface-800">
              <p className="text-2xl font-bold text-purple-400">—</p>
              <p className="text-xs text-surface-400 mt-1">PR Merge Rate within 24h</p>
            </div>
          </div>
          <p className="text-xs text-surface-500 italic">Cycle-time and focus metrics appear once the workspace has sprint history.</p>
        </div>
      )}

      {/* ── TAB 8: TEAMS & ACCESS ADMIN ── */}
      {activeTab === 'admin' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-surface-800 bg-surface-900 p-6 space-y-4">
            <h2 className="text-base font-display font-extrabold text-surface-50 flex items-center gap-2">
              <ShieldCheck size={18} className="text-orange-400" /> Team Roster & Role-Based Access
            </h2>
            <div className="divide-y divide-surface-800">
              {members.map((m) => (
                <div key={m.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-cyan-500 flex items-center justify-center text-xs font-bold text-white">
                      {m.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-surface-100">{m.name}</p>
                      <p className="text-[11px] text-surface-500">{m.email}</p>
                    </div>
                  </div>
                  <select aria-label="Member role" className="bg-surface-850 text-surface-200 text-xs rounded-lg border border-surface-700 px-2 py-1"
                    value={m.role} onChange={(e) => updateMemberRole(m.id, e.target.value as MemberRole)}>
                    <option value="Owner">Owner</option>
                    <option value="Admin">Admin</option>
                    <option value="Manager">Manager</option>
                    <option value="Developer">Developer</option>
                    <option value="Viewer">Viewer</option>
                  </select>
                </div>
              ))}
            </div>
            {members.length === 0 && (
              <p className="text-xs text-surface-500 italic py-4 text-center">No members in this workspace yet.</p>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <DiscussionsModal
        isOpen={discModal.open}
        onClose={() => setDiscModal({ ...discModal, open: false })}
        targetType={discModal.targetType}
        targetId={discModal.targetId}
        title={discModal.title}
      />
      <CreateProjectModal isOpen={showCreateProject} onClose={() => setShowCreateProject(false)} />
      <CreateBlockerModal isOpen={showCreateBlocker} onClose={() => setShowCreateBlocker(false)} />
      <CreateDocModal isOpen={showCreateDoc} onClose={() => setShowCreateDoc(false)} docToEdit={editingDoc} />
      <GlobalCommandPalette isOpen={showSearch} onClose={() => setShowSearch(false)} />
    </div>
  );
}
