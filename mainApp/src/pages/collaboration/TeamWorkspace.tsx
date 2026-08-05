import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers, FolderOpen, AlertOctagon, BookOpen, Calendar, BarChart3,
  ShieldCheck, Plus, GitBranch, Clock,
  CheckCircle2, ChevronDown, MessageSquare, Flame,
  Zap, Edit3, UserCheck, Rocket, Gauge, ListChecks, CalendarClock, FileWarning
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import { useAuthStore } from '../../store/useAuthStore';
import { SprintStatus, MemberRole, CollaborativeTask } from '../../types/collaboration';
import { activityActionLabel, activityDetail } from '../../lib/collaborationActivity';
import { selectNowStrip } from '../../lib/nowSelectors';
import { selectTeamToday } from '../../lib/missionControlSelectors';
import { useActiveTimer } from '../../hooks/useActiveTimer';
import { formatHours } from '../../utils/time';
import { TeamTodaySection } from '../../components/collaboration/TeamTodaySection';
import { DiscussionsModal } from '../../components/collaboration/DiscussionsModal';
import { CreateProjectModal } from '../../components/collaboration/CreateProjectModal';
import { CreateBlockerModal } from '../../components/collaboration/CreateBlockerModal';
import { CreateDocModal } from '../../components/collaboration/CreateDocModal';
import { CreateSprintModal } from '../../components/collaboration/CreateSprintModal';
import { CreateTaskModal } from '../../components/collaboration/CreateTaskModal';
import { CreateFeatureModal } from '../../components/collaboration/CreateFeatureModal';
import { ProjectBacklog } from '../../components/collaboration/ProjectBacklog';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';

import { getWorkspaceMaturityLevel, isFeatureVisibleForMaturity } from '../../utils/workspaceMaturity';

// ── Motion Variants ────────────────────────────────────────────────────────────
const stagger = { show: { transition: { staggerChildren: 0.06 } } };

// ── P6-T1: pure board computation over live store data ─────────────────────────
// The server does not persist an `actualVelocity`, so the Active Sprint Velocity
// card derives it from real task data: committed effort delivered (sum of
// `estimatedHours` across `done` tasks). Returns 0 when nothing is done yet.
export function computeSprintVelocity(tasks: Pick<CollaborativeTask, 'sprintStatus' | 'estimatedHours'>[]): number {
  return tasks
    .filter((t) => t.sprintStatus === 'done')
    .reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
}

// ── UX-R1: pure helpers for the Mission Control dashboard ──────────────────────
// All dashboard widgets read these over live store data; nothing is fabricated.

/** Open work assigned to a user (not yet done): { count, hours }. */
export function computeAssignedWork(
  tasks: Pick<CollaborativeTask, 'assigneeId' | 'sprintStatus' | 'estimatedHours'>[],
  userId: string | null,
): { count: number; hours: number } {
  const mine = tasks.filter((t) => t.assigneeId && t.assigneeId === userId && t.sprintStatus !== 'done');
  return {
    count: mine.length,
    hours: mine.reduce((sum, t) => sum + (t.estimatedHours || 0), 0),
  };
}

/** Tasks sitting in review that this user is the designated reviewer for. */
export function computePendingReviews(
  tasks: Pick<CollaborativeTask, 'reviewerId' | 'sprintStatus'>[],
  reviewerId: string | null,
): number {
  return tasks.filter((t) => t.reviewerId && t.reviewerId === reviewerId && t.sprintStatus === 'review').length;
}

/** A dated deadline surfaced by Mission Control (sprint end dates / milestones). */
export interface DeadlineItem {
  title: string;
  dueDate: string;
}

/** Deadlines within the next `days` (default 7), soonest first. */
export function computeUpcomingDeadlines<T extends DeadlineItem>(items: T[], days = 7, from = new Date()): T[] {
  const now = from.getTime();
  const horizon = now + days * 24 * 60 * 60 * 1000;
  return items
    .filter((i) => i.dueDate)
    .filter((i) => {
      const d = new Date(i.dueDate).getTime();
      return d >= now && d <= horizon;
    })
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
}

/** Overall workspace progress across every task: { done, total, pct }. */
export function computeWorkspaceProgress(
  tasks: Pick<CollaborativeTask, 'sprintStatus'>[],
): { done: number; total: number; pct: number } {
  const total = tasks.length;
  const done = tasks.filter((t) => t.sprintStatus === 'done').length;
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

type TeamTab = 'dashboard' | 'sprints' | 'projects' | 'blockers' | 'docs' | 'calendar' | 'analytics' | 'admin';

export function TeamWorkspace() {
  const {
    workspaces, activeWorkspaceId, setActiveWorkspace,
    members, projects, sprints, tasks, features, activities,
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
  const [showCreateSprint, setShowCreateSprint] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showCreateFeature, setShowCreateFeature] = useState(false);
  const [editingDoc, setEditingDoc] = useState<any>(null);

  // Discussions Modal state
  const [discModal, setDiscModal] = useState<{ open: boolean; targetType: any; targetId: string; title: string }>({
    open: false, targetType: 'task', targetId: '', title: ''
  });

  // ── Helper computations ──────────────────────────────────────────────────────
  const wsTasks = useMemo(() => activeWs ? tasks.filter((t) => t.workspaceId === activeWs.id) : [], [tasks, activeWs?.id]);
  const wsBlockers = useMemo(() => activeWs ? blockers.filter((b) => b.workspaceId === activeWs.id) : [], [blockers, activeWs?.id]);
  const wsDocs = useMemo(() => activeWs ? docs.filter((d) => d.workspaceId === activeWs.id) : [], [docs, activeWs?.id]);
  const wsProjects = useMemo(() => activeWs ? projects.filter((p) => p.workspaceId === activeWs.id) : [], [projects, activeWs?.id]);
  const wsFeatures = useMemo(() => activeWs ? features.filter((f) => f.workspaceId === activeWs.id) : [], [features, activeWs?.id]);
  const wsActivities = useMemo(() => activeWs ? activities.filter((a) => a.workspaceId === activeWs.id) : [], [activities, activeWs?.id]);

  const activeSprint = useMemo(() => activeWs ? sprints.find((s) => s.workspaceId === activeWs.id && s.status === 'active') : undefined, [sprints, activeWs?.id]);

  // P6-T1: tasks committed to the active sprint feed the velocity card. Empty
  // (or no active sprint) yields a graceful "—" instead of a fabricated number.
  const activeSprintTasks = useMemo(
    () => (activeSprint ? wsTasks.filter((t) => t.sprintId === activeSprint.id) : []),
    [wsTasks, activeSprint],
  );
  const activeSprintVelocity = useMemo(() => computeSprintVelocity(activeSprintTasks), [activeSprintTasks]);

  // UX-R1: Mission Control data — everything derived, nothing fabricated.
  const currentUserId = useAuthStore.getState().user?._id ?? null;
  const myName = useAuthStore.getState().user?.name ?? '';
  const myAssignedWork = useMemo(() => computeAssignedWork(wsTasks, currentUserId), [wsTasks, currentUserId]);
  const myPendingReviews = useMemo(() => computePendingReviews(wsTasks, currentUserId), [wsTasks, currentUserId]);
  const deadlineItems = useMemo(() => {
    const items: DeadlineItem[] = [];
    if (activeSprint?.endDate) items.push({ title: `Sprint ends: ${activeSprint.name}`, dueDate: activeSprint.endDate });
    wsProjects.forEach((p) => {
      p.milestones.filter((ms) => ms.status !== 'completed').forEach((ms) => {
        items.push({ title: `${p.name} · ${ms.title}`, dueDate: ms.dueDate });
      });
    });
    return items;
  }, [activeSprint, wsProjects]);
  const upcomingDeadlines = useMemo(() => computeUpcomingDeadlines(deadlineItems), [deadlineItems]);
  const workspaceProgress = useMemo(() => computeWorkspaceProgress(wsTasks), [wsTasks]);
  const sprintProgress = useMemo(
    () => (activeSprintTasks.length === 0
      ? 0
      : Math.round((activeSprintTasks.filter((t) => t.sprintStatus === 'done').length / activeSprintTasks.length) * 100)),
    [activeSprintTasks],
  );

  // S3-T4: Mission Control leads with today's work + resume + the running timer.
  // The active session is resolved across the personal + collab spine by the
  // same pure selector the NowStrip uses (no duplicated derivation); the team
  // "today" facts come from the live collab store via selectTeamToday.
  const navigate = useNavigate();
  const {
    tasks: personalTasks, activeTaskId, activeSessionId, activeTimerState,
    dataLoading, dataError, getTodayTime, profile, theme,
    pauseTimer, resumeTimer,
  } = useStore();
  const { display: timerDisplay } = useActiveTimer();

  const now = useMemo(
    () => selectNowStrip({
      tasks: personalTasks, collabTasks: tasks, workspaces, projects, sprints, features,
      activeTaskId, activeSessionId, activeTimerState,
    }),
    [personalTasks, tasks, workspaces, projects, sprints, features,
      activeTaskId, activeSessionId, activeTimerState],
  );
  const teamToday = useMemo(
    () => selectTeamToday(wsTasks, members, currentUserId),
    [wsTasks, members, currentUserId],
  );

  const todayMs = getTodayTime();
  const dailyGoalMs = profile.dailyGoal * 3600000;
  const goalPct = dailyGoalMs > 0 ? Math.min(100, Math.round((todayMs / dailyGoalMs) * 100)) : null;
  const accent = theme?.accentColor || '#0ea5e9';
  const dateLabel = new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  const openFocus = () => navigate('/focus');
  const startToday = () => navigate('/dashboard');
  const openTask = () => setActiveTab('sprints');
  const pauseActive = () => { if (activeTaskId) pauseTimer(activeTaskId); };
  const resumeActive = () => { if (activeTaskId) resumeTimer(activeTaskId); };

  // Presence counters
  const onlineMembers = members.filter((m) => m.status !== 'offline');
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

      {/* ═══ Compact Workspace Identity Header (UX-R1) ═══ */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">

          {/* Workspace Dropdown */}
          <div className="relative shrink-0">
            <button onClick={() => setShowWsMenu(!showWsMenu)}
              aria-label={`Switch workspace (currently ${activeWs.name})`}
              className="flex items-center gap-3 bg-surface-900 border border-surface-700/80 hover:border-brand-500/50 pl-2.5 pr-3 py-2 rounded-2xl transition-all shadow-sm group">
              <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-cyan-500 flex items-center justify-center text-xl shadow-lg">
                {activeWs.icon}
              </span>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <h1 className="font-display font-extrabold text-surface-50 text-sm leading-tight group-hover:text-brand-300 transition-colors">
                    {activeWs.name}
                  </h1>
                  <ChevronDown size={14} className={`text-surface-500 transition-transform ${showWsMenu ? 'rotate-180' : ''}`} />
                </div>
                <p className="text-[11px] text-surface-400 truncate max-w-[240px]">{activeWs.description}</p>
              </div>
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
                    <Button onClick={() => { setShowWsMenu(false); setShowNewWsModal(true); }}
                      variant="ghost" size="xs" leftIcon={<Plus size={14} />}
                      className="w-full text-brand-400 hover:bg-brand-500/10 rounded-xl">
                      Create New Workspace
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Identity meta: type + member avatars */}
          <div className="hidden md:flex items-center gap-3">
            <Badge tone="brand" className="text-[10px] font-bold uppercase tracking-wider border border-brand-500/20">
              {activeWs.type}
            </Badge>
            <div className="flex -space-x-2">
              {members.slice(0, 4).map((m) => (
                <div key={m.id} title={m.name}
                  className="w-7 h-7 rounded-full bg-gradient-to-br from-brand-500 to-cyan-500 ring-2 ring-surface-950 flex items-center justify-center text-[10px] font-bold text-white">
                  {m.name.charAt(0)}
                </div>
              ))}
              {members.length > 4 && (
                <div className="w-7 h-7 rounded-full bg-surface-800 ring-2 ring-surface-950 flex items-center justify-center text-[10px] font-bold text-surface-300">
                  +{members.length - 4}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-surface-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              {onlineMembers.length}/{members.length} online
            </div>
          </div>
        </div>

        <p className="hidden lg:flex items-center gap-1.5 text-[11px] text-surface-500 font-medium shrink-0">
          <Rocket size={12} className="text-brand-400" />
          Engineering Command Center
        </p>
      </div>

      {/* ═══ Phase X Tab Navigation Bar (Progressive Disclosure) ═══ */}
      <div className="flex items-center gap-2 border-b border-surface-800 pb-2 overflow-x-auto no-scrollbar">
        {(() => {
          const maturityLevel = getWorkspaceMaturityLevel({
            membersCount: members.length,
            projectsCount: wsProjects.length,
            sprintsCount: sprints.filter(s => s.workspaceId === activeWs.id).length,
            featuresCount: wsFeatures.length,
            blockersCount: openBlockers.length,
            qaTasksCount: wsTasks.filter(t => t.sprintStatus === 'review').length,
            reportsCount: 0,
          });

          const allTabs = [
            { id: 'dashboard', key: null, label: 'Mission Control', icon: Zap, color: 'text-amber-400' },
            { id: 'sprints', key: 'sprints', label: 'Sprint Board', icon: Layers, color: 'text-brand-400', count: wsTasks.length },
            { id: 'projects', key: 'projects', label: 'Projects', icon: FolderOpen, color: 'text-cyan-400', count: wsProjects.length },
            { id: 'blockers', key: 'blockers', label: 'Blockers Matrix', icon: AlertOctagon, color: 'text-red-400', count: openBlockers.length },
            { id: 'docs', key: null, label: 'Knowledge Base', icon: BookOpen, color: 'text-purple-400', count: wsDocs.length },
            { id: 'calendar', key: null, label: 'Team Calendar', icon: Calendar, color: 'text-emerald-400' },
            { id: 'analytics', key: 'analytics', label: 'Analytics & Reports', icon: BarChart3, color: 'text-sky-400' },
            { id: 'admin', key: 'admin', label: 'Teams & Access', icon: ShieldCheck, color: 'text-orange-400' },
          ];

          const visibleTabs = allTabs.filter(
            (tab) => !tab.key || isFeatureVisibleForMaturity(tab.key as any, maturityLevel)
          );

          return visibleTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as TeamTab)}
                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  isActive ? 'text-surface-50 bg-surface-900 border border-surface-700/80 shadow-md' : 'text-surface-400 hover:text-surface-200 hover:bg-surface-850/50'
                }`}>
                <tab.icon size={15} className={isActive ? tab.color : ''} />
                {tab.label}
                {tab.count !== undefined && (
                  <Badge tone={isActive ? 'brand' : 'neutral'} className="text-[10px] font-extrabold">{tab.count}</Badge>
                )}
              </button>
            );
          });
        })()}
      </div>

      {/* ═══ TAB CONTENT PANELS ═══ */}

      {/* ── TAB 1: MISSION CONTROL (default landing) ── */}
      {activeTab === 'dashboard' && (
        <motion.div initial="hidden" animate="show" variants={stagger} className="space-y-6">

          {/* Greeting + quick jump */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-display font-extrabold text-surface-50 flex items-center gap-2">
                <Zap size={18} className="text-amber-400" /> Mission Control
              </h2>
              <p className="text-xs text-surface-400 mt-0.5">
                {myName ? `${myName.split(' ')[0]}, ` : ''}here's the state of {activeWs.name} — {new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}.
              </p>
            </div>
            <Button onClick={() => setActiveTab('sprints')} size="sm" variant="secondary" leftIcon={<Layers size={14} />}>
              Open Sprint Board
            </Button>
          </div>

          {/* S3-T4: lead with today's work + resume + the running timer */}
          <TeamTodaySection
            loading={dataLoading}
            error={dataError}
            running={now.state === 'none' ? null : now}
            timerLabel={timerDisplay}
            todayLabel={formatHours(todayMs)}
            goalPct={goalPct}
            view={teamToday}
            accent={accent}
            workspaceName={activeWs.name}
            dateLabel={dateLabel}
            onResume={resumeActive}
            onPause={pauseActive}
            onOpenFocus={openFocus}
            onStartToday={startToday}
            onOpenTask={openTask}
          />

          {/* Stat Cards — all derived from live store data */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-surface-800 bg-gradient-to-br from-brand-500/10 to-surface-900 p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-surface-400">Your Open Work</span>
                <ListChecks size={16} className="text-brand-400" />
              </div>
              <p className="text-2xl font-display font-extrabold text-surface-50">
                {currentUserId ? myAssignedWork.count : '—'}
              </p>
              <p className="text-[11px] text-brand-400 mt-1 font-medium">
                {currentUserId ? `${myAssignedWork.hours}h est. remaining` : 'Sign in to see your work'}
              </p>
            </div>

            <div className="rounded-2xl border border-surface-800 bg-gradient-to-br from-emerald-500/10 to-surface-900 p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-surface-400">Workspace Progress</span>
                <Gauge size={16} className="text-emerald-400" />
              </div>
              <p className="text-2xl font-display font-extrabold text-emerald-400">{workspaceProgress.pct}%</p>
              <div className="mt-2 h-1.5 rounded-full bg-surface-800 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-400 transition-all duration-200" style={{ width: `${workspaceProgress.pct}%` }} />
              </div>
              <p className="text-[11px] text-emerald-400/80 mt-1 font-medium">{workspaceProgress.done} / {workspaceProgress.total} tasks done</p>
            </div>

            <div className="rounded-2xl border border-surface-800 bg-gradient-to-br from-purple-500/10 to-surface-900 p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-surface-400">Active Sprint</span>
                <Layers size={16} className="text-purple-400" />
              </div>
              <p className="text-2xl font-display font-extrabold text-purple-400">{activeSprint ? `${sprintProgress}%` : '—'}</p>
              <div className="mt-2 h-1.5 rounded-full bg-surface-800 overflow-hidden">
                <div className="h-full rounded-full bg-purple-400 transition-all duration-200" style={{ width: `${sprintProgress}%` }} />
              </div>
              <p className="text-[11px] text-purple-400/80 mt-1 font-medium">
                {activeSprint ? `${activeSprintTasks.filter((t) => t.sprintStatus === 'done').length}/${activeSprintTasks.length} tasks · ${activeSprintVelocity}/${activeSprint.targetVelocity ?? '—'} pts` : 'No sprint active yet'}
              </p>
            </div>

            <div className="rounded-2xl border border-surface-800 bg-gradient-to-br from-amber-500/10 to-surface-900 p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-surface-400">Pending Reviews</span>
                <UserCheck size={16} className="text-amber-400" />
              </div>
              <p className="text-2xl font-display font-extrabold text-amber-400">{currentUserId ? myPendingReviews : '—'}</p>
              <p className="text-[11px] text-amber-400/80 mt-1 font-medium">
                {currentUserId ? (myPendingReviews === 0 ? 'You\'re all caught up' : 'Awaiting your feedback') : 'Sign in to see your queue'}
              </p>
            </div>
          </div>

          {/* Main grid: left column (sprint + deadlines) + right rail (reviews, blockers, activity) */}
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">

            {/* Left column */}
            <div className="space-y-6">
              {/* Current Sprint */}
              <div className="rounded-2xl border border-surface-800 bg-surface-900 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-extrabold text-surface-50 text-base flex items-center gap-2">
                    <Flame size={18} className="text-purple-400" /> Current Sprint
                  </h3>
                  {activeSprint ? (
                    <Badge tone="brand" className="text-[10px] font-bold uppercase border border-brand-500/20">{activeSprint.name}</Badge>
                  ) : (
                    <Button onClick={() => setShowCreateSprint(true)} size="xs" leftIcon={<Plus size={12} />}>
                      New Sprint
                    </Button>
                  )}
                </div>

                {activeSprint ? (
                  <>
                    <p className="text-xs text-surface-400">Goal: <span className="text-surface-200 font-semibold">{activeSprint.goal}</span></p>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      {(['backlog', 'in_progress', 'done'] as const).map((col) => {
                        const n = activeSprintTasks.filter((t) => t.sprintStatus === col).length;
                        return (
                          <div key={col} className="p-3 rounded-xl bg-surface-850 border border-surface-800">
                            <p className="text-lg font-bold text-surface-50">{n}</p>
                            <p className="text-[10px] text-surface-500 font-bold uppercase">{col.replace('_', ' ')}</p>
                          </div>
                        );
                      })}
                    </div>
                    <div className="pt-2">
                      <div className="flex items-center justify-between text-[11px] text-surface-400 mb-1.5">
                        <span>Done {activeSprintTasks.filter((t) => t.sprintStatus === 'done').length}/{activeSprintTasks.length}</span>
                        <span>Velocity {activeSprintVelocity}/{activeSprint.targetVelocity ?? '—'} pts</span>
                      </div>
                      <div className="h-2 rounded-full bg-surface-800 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-purple-500 transition-all duration-200" style={{ width: `${sprintProgress}%` }} />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-xl border border-dashed border-surface-700 bg-surface-850/40 p-6 text-center">
                    <p className="text-xs text-surface-400 italic">No active sprint. Plan the next iteration from the Sprint Board.</p>
                    <Button onClick={() => setActiveTab('sprints')} size="xs" variant="secondary" className="mt-3">
                      Go to Sprint Planning
                    </Button>
                  </div>
                )}
              </div>

              {/* Upcoming Deadlines */}
              <div className="rounded-2xl border border-surface-800 bg-surface-900 p-6 space-y-3">
                <h3 className="font-display font-extrabold text-surface-50 text-base flex items-center gap-2">
                  <CalendarClock size={18} className="text-emerald-400" /> Upcoming Deadlines
                  {upcomingDeadlines.length > 0 && <Badge tone="neutral" className="text-[10px] font-extrabold">{upcomingDeadlines.length}</Badge>}
                </h3>
                {upcomingDeadlines.length === 0 ? (
                  <p className="text-xs text-surface-500 italic py-4 text-center">Nothing due in the next 7 days. Enjoy the calm.</p>
                ) : (
                  <ul className="divide-y divide-surface-800">
                    {upcomingDeadlines.slice(0, 5).map((d, i) => (
                      <li key={i} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                        <span className="text-surface-200 font-semibold truncate">{d.title}</span>
                        <span className={`shrink-0 font-mono font-bold ${i === 0 ? 'text-red-400' : 'text-surface-400'}`}>
                          {new Date(d.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Right rail */}
            <div className="space-y-6">
              {/* Pending Reviews queue */}
              <div className="rounded-2xl border border-surface-800 bg-surface-900 p-6 space-y-3">
                <h3 className="font-display font-extrabold text-surface-50 text-base flex items-center gap-2">
                  <UserCheck size={18} className="text-amber-400" /> Review Queue
                </h3>
                {(() => {
                  const myReviews = currentUserId ? wsTasks.filter((t) => t.reviewerId === currentUserId && t.sprintStatus === 'review') : [];
                  return myReviews.length === 0 ? (
                    <p className="text-xs text-surface-500 italic py-4 text-center">No tasks waiting on your review.</p>
                  ) : (
                    <ul className="space-y-2">
                      {myReviews.slice(0, 4).map((t) => (
                        <li key={t.id} className="p-3 rounded-xl bg-surface-850 border border-surface-800 text-xs">
                          <p className="font-bold text-surface-100 leading-snug">{t.title}</p>
                          <p className="text-[10px] text-purple-400 mt-1 font-semibold uppercase">In Code Review</p>
                        </li>
                      ))}
                    </ul>
                  );
                })()}
              </div>

              {/* Open Blockers */}
              <div className="rounded-2xl border border-surface-800 bg-surface-900 p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-extrabold text-surface-50 text-base flex items-center gap-2">
                    <AlertOctagon size={18} className="text-red-400" /> Blockers
                  </h3>
                  <Badge tone={openBlockers.length > 0 ? 'danger' : 'neutral'} className="text-[10px] font-extrabold">{openBlockers.length}</Badge>
                </div>
                {openBlockers.length === 0 ? (
                  <p className="text-xs text-surface-500 italic py-4 text-center">No open blockers. Pipeline is clear.</p>
                ) : (
                  <ul className="space-y-2">
                    {openBlockers.slice(0, 3).map((b) => (
                      <li key={b.id} className="p-3 rounded-xl bg-surface-850 border border-red-500/20 text-xs">
                        <p className="font-bold text-surface-100">{b.title}</p>
                        <p className="text-[10px] text-red-400 mt-1 font-bold uppercase">{b.severity}</p>
                      </li>
                    ))}
                  </ul>
                )}
                {openBlockers.length > 0 && (
                  <Button onClick={() => setActiveTab('blockers')} size="xs" variant="secondary" className="w-full">
                    Manage Blockers
                  </Button>
                )}
              </div>

              {/* Recent Activity */}
              <div className="rounded-2xl border border-surface-800 bg-surface-900 p-6 space-y-3">
                <h3 className="font-display font-extrabold text-surface-50 text-base flex items-center gap-2">
                  <Clock size={18} className="text-purple-400" /> Team Activity
                </h3>
                <div className="space-y-3">
                  {activityLoading && wsActivities.length === 0 && (
                    <p className="text-xs text-surface-500 italic">Loading activity…</p>
                  )}
                  {!activityLoading && wsActivities.length === 0 && (
                    <p className="text-xs text-surface-500 italic">No activity yet.</p>
                  )}
                  {wsActivities.slice(0, 4).map((act) => (
                    <div key={act.id} className="p-3 rounded-xl border border-surface-800 bg-surface-850/40 text-xs">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-surface-100">{act.actor.name}</span>
                        <span className="text-surface-400 font-semibold">{activityActionLabel(act.action)}</span>
                      </div>
                      <p className="text-surface-300 line-clamp-1">{activityDetail(act)}</p>
                      <p className="text-[10px] text-surface-500 mt-1 font-mono">
                        {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  ))}
                  {activityHasMore && (
                    <Button
                      type="button"
                      variant="ghost" size="sm"
                      onClick={() => loadWorkspaceActivity(activeWs.id, { cursor: activityNextCursor ?? undefined, append: true })}
                      className="w-full text-brand-300 hover:text-brand-200 rounded-lg border border-surface-800 hover:border-brand-500/40"
                    >
                      Load more activity
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Workspace Health strip */}
          <div className="rounded-2xl border border-surface-800 bg-surface-900 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <FileWarning size={16} className="text-emerald-400" />
              <p className="text-xs font-bold text-surface-100">Workspace Health</p>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-surface-400">
              <span>{wsProjects.length} projects</span>
              <span>{wsFeatures.length} backlog features</span>
              <span>{sprints.length} sprints</span>
              <span>{wsTasks.length} tasks · {workspaceProgress.pct}% done</span>
              <span>{wsDocs.length} knowledge docs</span>
              <span>{openBlockers.length} open blockers</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── TAB 2: SPRINT BOARD (KANBAN & AGILE) ── */}
      {activeTab === 'sprints' && (
        <div className="space-y-6">

          {/* Sprint Board Actions — real member/feature-aware creation (P6-T4) */}
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-display font-extrabold text-surface-50 flex items-center gap-2">
              <Layers size={18} className="text-brand-400" /> Sprint Planning
            </h2>
            <div className="flex items-center gap-2">
              <Button onClick={() => setShowCreateTask(true)}
                size="sm" leftIcon={<Plus size={14} />}>
                New Task
              </Button>
              <Button onClick={() => setShowCreateSprint(true)}
                size="sm" leftIcon={<Plus size={14} />}>
                New Sprint
              </Button>
            </div>
          </div>

          {/* P6-T3: per-project feature backlog with drag-and-drop into sprints */}
          <ProjectBacklog onCreateFeature={() => setShowCreateFeature(true)} />

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

          {/* P6-T1: no active sprint — keep the board usable, explain the missing header */}
          {!activeSprint && wsTasks.length > 0 && (
            <div className="rounded-2xl border border-dashed border-surface-700 bg-surface-900/60 p-5 flex items-center gap-3 text-xs text-surface-400 italic">
              <Layers size={14} className="text-surface-500" />
              No active sprint — sprint goal, capacity, and velocity appear here once a sprint is active. The board below shows the workspace task backlog.
            </div>
          )}

          {/* 5-Column Kanban Board */}
          {wsTasks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-surface-700 bg-surface-900/60 p-12 text-center text-xs text-surface-400 italic">
              No tasks yet in this workspace. Tasks you create will appear on the sprint board.
            </div>
          ) : (
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
                    <Badge tone="neutral" className="text-xs font-bold">{colTasks.length}</Badge>
                  </div>

                  <div className="space-y-3">
                    {colTasks.map((task) => (
                      <div key={task.id} className="rounded-xl border border-surface-800 bg-surface-850 p-3.5 space-y-2 hover:border-surface-700 transition-all group">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold text-brand-400 uppercase">{task.priority}</span>
                          {task.gitContext?.prNumber && (
                            <Badge tone="brand" className="font-mono font-bold border border-purple-500/20">
                              PR #{task.gitContext.prNumber}
                            </Badge>
                          )}
                        </div>

                        <p className="text-xs font-bold text-surface-100 leading-snug">{task.title}</p>
                        <p className="text-[11px] text-surface-400 line-clamp-2">{task.description}</p>

                        {/* Git Context Badges */}
                        {task.gitContext?.branch && (
                          <Badge tone="success" icon={<GitBranch size={10} />} className="text-[10px] font-mono py-1 truncate max-w-full overflow-hidden">
                            {task.gitContext.branch}
                          </Badge>
                        )}

                        {/* Action Bar */}
                        <div className="pt-2 border-t border-surface-800 flex items-center justify-between text-[11px]">
                          <Button onClick={() => setDiscModal({ open: true, targetType: 'task', targetId: task.id, title: task.title })}
                            variant="ghost" size="xs" leftIcon={<MessageSquare size={12} />}
                            className="text-surface-400 hover:text-brand-400 hover:bg-transparent">
                            Discuss
                          </Button>

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
                    {colTasks.length === 0 && (
                      <p className="text-[11px] text-surface-500 italic py-6 text-center">No tasks</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>
      )}

      {/* ── TAB 3: PROJECTS & MILESTONES ── */}
      {activeTab === 'projects' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-display font-extrabold text-surface-50 flex items-center gap-2">
              <FolderOpen size={18} className="text-cyan-400" /> Projects & Milestones
            </h2>
            <Button onClick={() => setShowCreateProject(true)}
              size="sm" leftIcon={<Plus size={14} />}>
              New Project
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {wsProjects.map((proj) => (
              <div key={proj.id} className="rounded-2xl border border-surface-800 bg-surface-900 p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <Badge tone="brand" className="text-[10px] font-bold uppercase tracking-wider border border-brand-500/20">
                      {proj.key}
                    </Badge>
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
                      <Badge tone="success" className="text-[10px] font-bold uppercase border border-emerald-500/20">
                        {ms.targetPoints} pts
                      </Badge>
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
            <div className="rounded-2xl border border-dashed border-surface-700 bg-surface-900/60 p-12 text-center">
              <FolderOpen size={28} className="mx-auto text-cyan-400/60 mb-3" />
              <p className="text-xs font-bold text-surface-300 mb-1">No projects yet</p>
              <p className="text-xs text-surface-500 italic mb-4">Kick off the first initiative for this workspace.</p>
              <Button onClick={() => setShowCreateProject(true)} size="sm" leftIcon={<Plus size={14} />}>
                New Project
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 4: CENTRAL BLOCKER MATRIX ── */}
      {activeTab === 'blockers' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-surface-800 bg-surface-900 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-display font-extrabold text-surface-50 flex items-center gap-2">
                <AlertOctagon size={18} className="text-red-400" /> Blocker Resolution Board
              </h2>
              <Button onClick={() => setShowCreateBlocker(true)}
                variant="danger" size="sm" leftIcon={<AlertOctagon size={14} />}>
                Report Blocker
              </Button>
            </div>
            <div className="space-y-3">
              {wsBlockers.map((blk) => (
                <div key={blk.id} className="p-4 rounded-xl border border-surface-800 bg-surface-850 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge tone={blk.severity === 'critical' ? 'danger' : 'warning'} className="text-[10px] font-extrabold uppercase">
                        {blk.severity}
                      </Badge>
                      <h4 className="text-sm font-bold text-surface-100">{blk.title}</h4>
                    </div>
                    <p className="text-xs text-surface-400">{blk.impactDescription}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    {blk.status === 'resolved' ? (
                      <Badge tone="success" icon={<CheckCircle2 size={13} />} className="text-xs font-bold px-3 py-1.5 border border-emerald-500/20">
                        Resolved
                      </Badge>
                    ) : (
                      <Button onClick={() => resolveBlocker(blk.id)} size="sm">
                        Resolve Blocker
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {wsBlockers.length === 0 && (
              <div className="py-8 text-center">
                <CheckCircle2 size={28} className="mx-auto text-emerald-400/70 mb-3" />
                <p className="text-xs font-bold text-surface-300 mb-1">No blockers reported</p>
                <p className="text-xs text-surface-500 italic mb-4">The pipeline is clear. Report one if something is in the way.</p>
                <Button onClick={() => setShowCreateBlocker(true)} variant="danger" size="xs" leftIcon={<AlertOctagon size={12} />}>
                  Report Blocker
                </Button>
              </div>
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
            <Button onClick={() => { setEditingDoc(null); setShowCreateDoc(true); }}
              size="sm" leftIcon={<Plus size={14} />}>
              New Document
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {wsDocs.map((doc) => (
              <div key={doc.id} className="rounded-2xl border border-surface-800 bg-surface-900 p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge tone="brand" className="text-[10px] font-bold uppercase tracking-wider border border-purple-500/20">
                    {doc.category} · v{doc.version}
                  </Badge>
                  <Button onClick={() => { setEditingDoc(doc); setShowCreateDoc(true); }}
                    aria-label={`Edit document ${doc.title}`} variant="ghost" size="icon-sm"
                    className="text-surface-500 hover:text-surface-200">
                    <Edit3 size={14} />
                  </Button>
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
                <Badge tone="success" className="text-[10px] font-bold uppercase">{ev.type}</Badge>
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
      <CreateSprintModal isOpen={showCreateSprint} onClose={() => setShowCreateSprint(false)} />
      <CreateTaskModal isOpen={showCreateTask} onClose={() => setShowCreateTask(false)} />
      <CreateFeatureModal isOpen={showCreateFeature} onClose={() => setShowCreateFeature(false)} />
    </div>
  );
}
