import { useMemo, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, CheckSquare, Users,
  CalendarDays, FolderOpen, ChevronRight, LayoutGrid, Trash2, Video, Clock,
  Bookmark, MoreHorizontal, ArrowRight, TrendingUp, Quote,
} from 'lucide-react';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { useCalendarStore } from '@worklog/services/useCalendarStore';
import { useMeetingStore } from '@meetings/services/useMeetingStore';
import { useWorkspaceId } from '@collab/hooks/useWorkspaceId';
import { useWorkspacePath } from '@collab/hooks/useWorkspacePath';
import { SAMPLE_PROJECTS, type ProjectStatus, mapProjectToCardData } from '@collab/components/projects/types';
import { Badge, type BadgeTone } from '@shared/components/ui/Badge';
import { Progress } from '@shared/components/ui/Progress';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Card } from '@shared/components/ui/Card';

const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };
const stagger = { show: { transition: { staggerChildren: 0.06 } } };

const STATUS_BADGE: Record<ProjectStatus, BadgeTone> = {
  active: 'success',
  in_progress: 'info',
  completed: 'brand',
  on_hold: 'warning',
};

const STATUS_LABEL: Record<ProjectStatus, string> = {
  active: 'Active',
  in_progress: 'In Progress',
  completed: 'Completed',
  on_hold: 'On Hold',
};

const CARD_TINT = {
  people: { bg: 'bg-blue-500/8', border: 'border-blue-500/20', hover: 'hover:border-blue-500/40', topBar: 'bg-blue-500' },
  tasks: { bg: 'bg-emerald-500/8', border: 'border-emerald-500/20', hover: 'hover:border-emerald-500/40', topBar: 'bg-emerald-500' },
  kanban: { bg: 'bg-orange-500/8', border: 'border-orange-500/20', hover: 'hover:border-orange-500/40', topBar: 'bg-orange-500' },
  calendar: { bg: 'bg-purple-500/8', border: 'border-purple-500/20', hover: 'hover:border-purple-500/40', topBar: 'bg-purple-500' },
  meetings: { bg: 'bg-cyan-500/8', border: 'border-cyan-500/20', hover: 'hover:border-cyan-500/40', topBar: 'bg-cyan-500' },
  schedule: { bg: 'bg-emerald-500/8', border: 'border-emerald-500/20', hover: 'hover:border-emerald-500/40', topBar: 'bg-emerald-500' },
};

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const workspaceId = useWorkspaceId();
  const wsPath = useWorkspacePath();
  const navigate = useNavigate();
  const { members, tasks, projects: storeProjects, workspaces, deleteProject } = useCollaborationStore();
  const { events } = useCalendarStore();
  const { meetings } = useMeetingStore();
  const hasAttemptedLoad = useRef(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);

  const workspace = workspaces.find((w) => w.id === workspaceId);
  const canDelete = workspace?.role === 'superadmin' || workspace?.role === 'admin';

  useEffect(() => { hasAttemptedLoad.current = false; }, [projectId, workspaceId]);

  useEffect(() => {
    if (!projectId || !workspaceId || hasAttemptedLoad.current) return;
    hasAttemptedLoad.current = true;
    useCollaborationStore.getState().loadWorkspaces().then(() => {
      const { workspaces, activeWorkspaceId } = useCollaborationStore.getState();
      const ws = workspaces.find((w) => w.id === activeWorkspaceId || w.slug === activeWorkspaceId);
      const resolvedId = ws?.id ?? workspaceId;
      useCollaborationStore.getState().loadProjects(resolvedId);
      useCollaborationStore.getState().loadTasks(resolvedId, projectId);
      useCollaborationStore.getState().loadMembers(resolvedId);
      useCollaborationStore.getState().loadTeams();
      useMeetingStore.getState().fetchMeetings();
    });
  }, [projectId, workspaceId]);

  const project = useMemo(() => {
    const storeProject = storeProjects.find((p) => p.id === projectId);
    if (storeProject) return mapProjectToCardData(storeProject, tasks);
    return SAMPLE_PROJECTS.find((p) => p.id === projectId);
  }, [projectId, storeProjects, tasks]);

  const stats = useMemo(() => {
    if (!project) return { memberCount: 0, taskCount: 0, doneTasks: 0, activeTasks: 0, upcomingTasks: 0, eventCount: 0, meetingCount: 0, scheduleCount: 0, kanbanTotal: 0, kanbanTodo: 0, kanbanDoing: 0, kanbanReview: 0, kanbanDone: 0 };
    const memberCount = project.memberIds
      ? members.filter((m) => project.memberIds!.includes(m.id)).length
      : members.length;
    const projectTasks = tasks;
    const doneTasks = projectTasks.filter((t) => t.sprintStatus === 'done').length;
    const activeTasks = projectTasks.filter((t) => t.sprintStatus === 'in_progress' || t.sprintStatus === 'review').length;
    const upcomingTasks = projectTasks.filter((t) => t.sprintStatus === 'backlog' || t.sprintStatus === 'ready').length;
    const projectEvents = events.filter((e) => e.projectName?.toLowerCase() === project.name.toLowerCase());
    const projectMeetings = meetings.filter(
      (m) => m.location?.toLowerCase().includes(project.name.toLowerCase()) || m.title.toLowerCase().includes(project.name.toLowerCase()),
    );
    const kanbanTodo = projectTasks.filter((t) => t.sprintStatus === 'backlog' || t.sprintStatus === 'ready').length;
    const kanbanDoing = projectTasks.filter((t) => t.sprintStatus === 'in_progress').length;
    const kanbanReview = projectTasks.filter((t) => t.sprintStatus === 'review').length;
    const kanbanDone = projectTasks.filter((t) => t.sprintStatus === 'done').length;
    return {
      memberCount,
      taskCount: projectTasks.length || project.totalTasks,
      doneTasks: projectTasks.length > 0 ? doneTasks : project.completedTasks,
      activeTasks: projectTasks.length > 0 ? activeTasks : project.totalTasks - project.completedTasks,
      upcomingTasks,
      eventCount: projectEvents.length,
      meetingCount: projectMeetings.length,
      scheduleCount: 0,
      kanbanTotal: projectTasks.length,
      kanbanTodo, kanbanDoing, kanbanReview, kanbanDone,
    };
  }, [project, members, tasks, events, meetings]);

  const handleDelete = async () => {
    if (!projectId || deleting) return;
    setDeleting(true);
    const ok = await deleteProject(projectId);
    setDeleting(false);
    if (ok) navigate(wsPath('projects'));
  };

  if (!project) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <FolderOpen size={40} className="mx-auto text-surface-500" />
          <h1 className="text-lg font-display font-bold text-surface-100">Project not found</h1>
          <p className="text-sm text-surface-400">This project does not exist.</p>
          <Button onClick={() => navigate(wsPath('projects'))} leftIcon={<ArrowLeft size={14} />}>Back to Projects</Button>
        </div>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const progressPct = project.progress;
  const ringR = 34;
  const ringCirc = 2 * Math.PI * ringR;
  const ringOffset = ringCirc - (progressPct / 100) * ringCirc;

  const now = new Date();
  const weekDays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    d.setDate(now.getDate() + mondayOffset + i);
    return d;
  });

  return (
    <div className="min-h-screen bg-surface-950 relative overflow-x-hidden overflow-y-auto">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-500/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-cyan-500/8 rounded-full blur-3xl pointer-events-none" />

      <header className="sticky top-0 z-20 bg-surface-950/80 backdrop-blur-xl border-b border-surface-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <button onClick={() => navigate(wsPath('projects'))} className="flex items-center gap-2 text-sm text-surface-400 hover:text-surface-200 transition-colors">
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Back to Projects</span>
          </button>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-xl text-surface-400 hover:text-brand-400 hover:bg-surface-900 transition-all">
              <Bookmark size={18} />
            </button>
            <button className="p-2 rounded-xl text-surface-400 hover:text-surface-200 hover:bg-surface-900 transition-all">
              <MoreHorizontal size={18} />
            </button>
            <Button onClick={() => navigate(wsPath('projects', projectId!, 'tasks'))} rightIcon={<ArrowRight size={14} />}>
              Open Project
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 relative z-10">
        <motion.div variants={fadeUp} initial="hidden" animate="show" className="relative overflow-hidden rounded-3xl border border-surface-800/50 min-h-[220px]">
          <div className="absolute inset-0">
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 900 260" fill="none" preserveAspectRatio="xMidYMid slice">
              <rect width="900" height="260" fill="var(--detail-hero-sky)" />
              <rect width="900" height="260" fill="url(#heroSkyGrad)" />
              <defs>
                <linearGradient id="heroSkyGrad" x1="0" y1="0" x2="0" y2="260">
                  <stop offset="0%" stopColor="var(--detail-hero-sky)" />
                  <stop offset="100%" stopColor="var(--detail-hero-bg)" />
                </linearGradient>
              </defs>
              <circle cx="750" cy="60" r="28" fill="var(--detail-hero-sun)" opacity="0.9" />
              <circle cx="750" cy="60" r="40" fill="var(--detail-hero-sun)" opacity="0.15" />
              <circle cx="750" cy="60" r="55" fill="var(--detail-hero-sun)" opacity="0.06" />
              <path d="M0 200 L100 120 L200 160 L350 90 L500 140 L650 100 L800 130 L900 110 L900 260 L0 260Z" fill="var(--detail-hero-mountain)" opacity="0.3" />
              <path d="M0 220 L150 150 L300 180 L450 130 L600 170 L750 140 L900 160 L900 260 L0 260Z" fill="var(--detail-hero-mountain-2)" opacity="0.25" />
              <path d="M0 240 L120 180 L250 210 L400 170 L550 200 L700 175 L900 195 L900 260 L0 260Z" fill="var(--detail-hero-land)" opacity="0.5" />
              <rect y="230" width="900" height="30" fill="var(--detail-hero-ground)" opacity="0.6" />
              <g opacity="0.5">
                <polygon points="100,230 110,190 120,230" fill="var(--detail-hero-tree)" />
                <polygon points="105,210 110,180 115,210" fill="var(--detail-hero-tree-2)" />
                <polygon points="180,230 192,185 204,230" fill="var(--detail-hero-tree)" />
                <polygon points="186,215 192,175 198,215" fill="var(--detail-hero-tree-2)" />
                <polygon points="820,230 832,195 844,230" fill="var(--detail-hero-tree)" />
                <polygon points="826,215 832,188 838,215" fill="var(--detail-hero-tree-2)" />
              </g>
              <path d="M400 260 Q450 230 500 235 Q600 245 700 220 Q800 200 900 210" stroke="var(--detail-hero-mountain-2)" strokeWidth="3" fill="none" opacity="0.3" strokeDasharray="8 4" />
              <g opacity="0.15" transform="translate(680, 160)">
                <rect x="0" y="0" width="4" height="70" fill="var(--detail-hero-mountain)" />
                <rect x="20" y="0" width="4" height="70" fill="var(--detail-hero-mountain)" />
                <rect x="0" y="0" width="24" height="4" fill="var(--detail-hero-mountain)" />
                <rect x="0" y="20" width="24" height="4" fill="var(--detail-hero-mountain)" />
                <rect x="0" y="40" width="24" height="4" fill="var(--detail-hero-mountain)" />
              </g>
            </svg>
          </div>
          <div className="relative p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-start gap-5">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 font-display font-bold text-2xl bg-surface-900/80 backdrop-blur-sm border border-surface-800/50 shadow-lg text-surface-50">
                {project.iconEmoji}
              </div>
              <div className="min-w-0 space-y-2">
                <h2 className="text-2xl font-display font-extrabold text-surface-50 tracking-tight">{project.name}</h2>
                <p className="text-sm text-surface-300">{project.client}</p>
                <p className="text-xs text-surface-400 max-w-md leading-relaxed">{project.description}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge tone={STATUS_BADGE[project.status]} className="text-[10px] font-extrabold uppercase tracking-wider">{STATUS_LABEL[project.status]}</Badge>
                  {project.type.map((t) => <Badge key={t} tone="neutral" className="text-[10px]">{t}</Badge>)}
                  <span className="flex items-center gap-1 text-[11px] text-surface-400">
                    <CalendarDays size={12} />
                    {formatDate(project.startDate)} – {formatDate(project.endDate)}
                  </span>
                </div>
              </div>
            </div>
            <div className="hidden lg:block text-right max-w-xs">
              <p className="text-sm italic text-surface-300 leading-relaxed">"{project.description || 'Build stronger foundations together.'}"</p>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <motion.div variants={fadeUp} initial="hidden" animate="show" className="lg:col-span-2 rounded-2xl border border-blue-500/20 bg-blue-500/8 p-6 flex flex-col sm:flex-row items-center gap-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-blue-500" />
            <div className="flex flex-col items-center gap-3">
              <div className="relative w-20 h-20">
                <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
                  <circle cx="40" cy="40" r={ringR} fill="none" stroke="var(--detail-progress-ring-track)" strokeWidth="6" />
                  <circle cx="40" cy="40" r={ringR} fill="none" stroke="var(--detail-progress-ring-fill)" strokeWidth="6" strokeDasharray={ringCirc} strokeDashoffset={ringOffset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-lg font-display font-bold text-surface-50">{progressPct}%</span>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-surface-50">{project.completedTasks} / {project.totalTasks}</p>
                <p className="text-[11px] text-surface-400">tasks completed</p>
              </div>
              <div className="w-full max-w-[200px]">
                <Progress value={progressPct} tone="brand" className="h-1.5" />
              </div>
            </div>
            <div className="flex-1 space-y-2 sm:border-l sm:border-surface-800/60 sm:pl-6">
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className="text-brand-400" />
                <h3 className="font-display font-bold text-surface-50 text-sm">Let's get started!</h3>
              </div>
              <p className="text-xs text-surface-400 leading-relaxed">Set up tasks, assign members and start making progress.</p>
            </div>
          </motion.div>

          <motion.div variants={fadeUp} initial="hidden" animate="show" className="relative overflow-hidden rounded-2xl border border-sky-500/20 bg-sky-500/8 p-6 flex flex-col justify-between">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-sky-500" />
            <div>
              <Quote size={36} style={{ color: 'var(--detail-quote-icon)' }} className="mb-3 opacity-60" />
              <p className="text-sm font-medium text-surface-50 leading-relaxed">"Small steps in the right direction make big results."</p>
            </div>
            <svg className="absolute bottom-0 right-0 w-32 h-24 opacity-30" viewBox="0 0 120 90" fill="none">
              <path d="M0 90 L30 50 L60 70 L90 40 L120 55 L120 90Z" fill="var(--detail-hero-mountain)" opacity="0.4" />
              <path d="M40 90 L60 60 L80 80 L120 50 L120 90Z" fill="var(--detail-hero-land)" opacity="0.5" />
              <path d="M60 90 L75 70 L90 85 L120 65 L120 90Z" fill="var(--detail-hero-tree)" opacity="0.4" />
              <path d="M85 90 L95 75 L110 88 L120 78 L120 90Z" fill="var(--detail-hero-tree-2)" opacity="0.5" />
            </svg>
          </motion.div>
        </div>

        <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <motion.button variants={fadeUp} type="button" onClick={() => navigate(wsPath('projects', projectId!, 'people'))} className={`group relative overflow-hidden rounded-2xl border p-5 text-left cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 bg-surface-900/80 backdrop-blur-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 ${CARD_TINT.people.border} ${CARD_TINT.people.hover} ${CARD_TINT.people.bg}`}>
            <div className={`absolute top-0 left-0 right-0 h-[3px] ${CARD_TINT.people.topBar}`} />
            <div className="flex items-start justify-between mb-3 mt-1">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--detail-card-blue-bg)' }}>
                <Users size={20} style={{ color: 'var(--detail-card-blue-icon)' }} />
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: 'var(--detail-card-blue-bg)', color: 'var(--detail-card-blue-icon)' }}>
                {stats.memberCount} members
              </span>
            </div>
            <h3 className="font-display font-bold text-surface-50 text-sm">People</h3>
            <p className="text-[11px] text-surface-400 mt-0.5">Team members and collaborators</p>
            <div className="flex items-center mt-4">
              <div className="flex -space-x-2">
                {members.slice(0, 4).map((m, i) => (
                  <div key={m.id} className="w-8 h-8 rounded-full border-2 border-surface-900 flex items-center justify-center text-[10px] font-bold text-surface-50" style={{ backgroundColor: `color-mix(in srgb, var(--detail-card-blue-icon) ${20 + i * 10}%, var(--color-surface-800))`, zIndex: 4 - i }}>
                    {m.name?.charAt(0) || '?'}
                  </div>
                ))}
                {stats.memberCount > 4 && (
                  <div className="w-8 h-8 rounded-full border-2 border-surface-900 bg-surface-800 flex items-center justify-center text-[10px] font-bold text-surface-400">
                    +{stats.memberCount - 4}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold transition-colors" style={{ color: 'var(--detail-card-blue-icon)' }}>
              Manage People <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </motion.button>

          <motion.button variants={fadeUp} type="button" onClick={() => navigate(wsPath('projects', projectId!, 'tasks'))} className={`group relative overflow-hidden rounded-2xl border p-5 text-left cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 bg-surface-900/80 backdrop-blur-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 ${CARD_TINT.tasks.border} ${CARD_TINT.tasks.hover} ${CARD_TINT.tasks.bg}`}>
            <div className={`absolute top-0 left-0 right-0 h-[3px] ${CARD_TINT.tasks.topBar}`} />
            <div className="flex items-start justify-between mb-3 mt-1">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--detail-card-green-bg)' }}>
                <CheckSquare size={20} style={{ color: 'var(--detail-card-green-icon)' }} />
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: 'var(--detail-card-green-bg)', color: 'var(--detail-card-green-icon)' }}>
                {stats.taskCount} tasks
              </span>
            </div>
            <h3 className="font-display font-bold text-surface-50 text-sm">Tasks</h3>
            <p className="text-[11px] text-surface-400 mt-0.5">View and filter all project tasks</p>
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-[11px]">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--detail-card-green-icon)' }} />
                <span className="text-surface-300 font-semibold">{stats.doneTasks} done</span>
                <span className="text-surface-500 mx-0.5">|</span>
                <span className="text-surface-400">{stats.activeTasks} active</span>
                <span className="text-surface-500 mx-0.5">|</span>
                <span className="text-surface-400">{stats.upcomingTasks} upcoming</span>
              </div>
              <div className="w-full bg-surface-800 h-1.5 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${stats.taskCount > 0 ? (stats.doneTasks / stats.taskCount) * 100 : 0}%`, backgroundColor: 'var(--detail-card-green-icon)' }} />
              </div>
              <span className="text-[11px] font-bold" style={{ color: 'var(--detail-card-green-icon)' }}>
                {stats.taskCount > 0 ? Math.round((stats.doneTasks / stats.taskCount) * 100) : 0}%
              </span>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold transition-colors" style={{ color: 'var(--detail-card-green-icon)' }}>
              View Tasks <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </motion.button>

          <motion.button variants={fadeUp} type="button" onClick={() => navigate(wsPath('projects', project.id, 'kanban'))} className={`group relative overflow-hidden rounded-2xl border p-5 text-left cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 bg-surface-900/80 backdrop-blur-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 ${CARD_TINT.kanban.border} ${CARD_TINT.kanban.hover} ${CARD_TINT.kanban.bg}`}>
            <div className={`absolute top-0 left-0 right-0 h-[3px] ${CARD_TINT.kanban.topBar}`} />
            <div className="flex items-start justify-between mb-3 mt-1">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--detail-card-orange-bg)' }}>
                <LayoutGrid size={20} style={{ color: 'var(--detail-card-orange-icon)' }} />
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: 'var(--detail-card-orange-bg)', color: 'var(--detail-card-orange-icon)' }}>
                {stats.kanbanTotal} tasks
              </span>
            </div>
            <h3 className="font-display font-bold text-surface-50 text-sm">Kanban</h3>
            <p className="text-[11px] text-surface-400 mt-0.5">Drag-drop board and task flow</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="text-center p-2 rounded-lg bg-surface-800/50">
                <p className="text-lg font-display font-bold text-surface-300">{stats.kanbanTodo}</p>
                <p className="text-[9px] text-surface-500 font-medium">To Do</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-surface-800/50">
                <p className="text-lg font-display font-bold" style={{ color: 'var(--detail-card-orange-icon)' }}>{stats.kanbanDoing + stats.kanbanReview}</p>
                <p className="text-[9px] text-surface-500 font-medium">In Review</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-surface-800/50">
                <p className="text-lg font-display font-bold text-emerald-400">{stats.kanbanDone}</p>
                <p className="text-[9px] text-surface-500 font-medium">Done</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold transition-colors" style={{ color: 'var(--detail-card-orange-icon)' }}>
              View Board <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </motion.button>

          <motion.button variants={fadeUp} type="button" onClick={() => navigate(`/worklog/calendar?project=${encodeURIComponent(project.name)}`)} className={`group relative overflow-hidden rounded-2xl border p-5 text-left cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 bg-surface-900/80 backdrop-blur-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 ${CARD_TINT.calendar.border} ${CARD_TINT.calendar.hover} ${CARD_TINT.calendar.bg}`}>
            <div className={`absolute top-0 left-0 right-0 h-[3px] ${CARD_TINT.calendar.topBar}`} />
            <div className="flex items-start justify-between mb-3 mt-1">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--detail-card-purple-bg)' }}>
                <CalendarDays size={20} style={{ color: 'var(--detail-card-purple-icon)' }} />
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: 'var(--detail-card-purple-bg)', color: 'var(--detail-card-purple-icon)' }}>
                {stats.eventCount} events
              </span>
            </div>
            <h3 className="font-display font-bold text-surface-50 text-sm">Calendar</h3>
            <p className="text-[11px] text-surface-400 mt-0.5">Schedule, meetings, and deadlines</p>
            <div className="mt-4 flex items-center gap-1">
              {weekDates.map((d, i) => {
                const isToday = d.toDateString() === now.toDateString();
                return (
                  <div key={i} className={`flex-1 text-center py-1.5 rounded-lg text-[10px] ${isToday ? 'text-white font-bold' : 'text-surface-400'}`} style={isToday ? { backgroundColor: 'var(--detail-card-purple-icon)' } : {}}>
                    <p className="font-medium opacity-70">{weekDays[i]}</p>
                    <p className="font-bold text-[11px]">{d.getDate()}</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold transition-colors" style={{ color: 'var(--detail-card-purple-icon)' }}>
              View Calendar <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </motion.button>

          <motion.button variants={fadeUp} type="button" onClick={() => navigate('/meetings')} className={`group relative overflow-hidden rounded-2xl border p-5 text-left cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 bg-surface-900/80 backdrop-blur-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 ${CARD_TINT.meetings.border} ${CARD_TINT.meetings.hover} ${CARD_TINT.meetings.bg}`}>
            <div className={`absolute top-0 left-0 right-0 h-[3px] ${CARD_TINT.meetings.topBar}`} />
            <div className="flex items-start justify-between mb-3 mt-1">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--detail-card-cyan-bg)' }}>
                <Video size={20} style={{ color: 'var(--detail-card-cyan-icon)' }} />
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: 'var(--detail-card-cyan-bg)', color: 'var(--detail-card-cyan-icon)' }}>
                {stats.meetingCount} meetings
              </span>
            </div>
            <h3 className="font-display font-bold text-surface-50 text-sm">Meetings</h3>
            <p className="text-[11px] text-surface-400 mt-0.5">Scheduled meetings and calls</p>
            <div className="mt-4 flex flex-col items-center justify-center py-3">
              <Video size={28} className="text-surface-600 mb-2" />
              <p className="text-[11px] text-surface-400 font-medium">No meetings scheduled</p>
              <p className="text-[10px] text-surface-500">Schedule a meeting to get started.</p>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold transition-colors" style={{ color: 'var(--detail-card-cyan-icon)' }}>
              View Meetings <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </motion.button>

          <motion.button variants={fadeUp} type="button" onClick={() => navigate(wsPath('projects', project.id, 'schedule'))} className={`group relative overflow-hidden rounded-2xl border p-5 text-left cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 bg-surface-900/80 backdrop-blur-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50 ${CARD_TINT.schedule.border} ${CARD_TINT.schedule.hover} ${CARD_TINT.schedule.bg}`}>
            <div className={`absolute top-0 left-0 right-0 h-[3px] ${CARD_TINT.schedule.topBar}`} />
            <div className="flex items-start justify-between mb-3 mt-1">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--detail-card-emerald-bg)' }}>
                <Clock size={20} style={{ color: 'var(--detail-card-emerald-icon)' }} />
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: 'var(--detail-card-emerald-bg)', color: 'var(--detail-card-emerald-icon)' }}>
                {stats.scheduleCount ?? 0} scheduled
              </span>
            </div>
            <h3 className="font-display font-bold text-surface-50 text-sm">Schedule</h3>
            <p className="text-[11px] text-surface-400 mt-0.5">Team time blocks and task scheduling</p>
            <div className="mt-4 flex flex-col items-center justify-center py-3">
              <Clock size={28} className="text-surface-600 mb-2" />
              <p className="text-[11px] text-surface-400 font-medium">No items scheduled</p>
              <p className="text-[10px] text-surface-500">Plan your work and keep the team aligned.</p>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold transition-colors" style={{ color: 'var(--detail-card-emerald-icon)' }}>
              View Schedule <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
            </div>
          </motion.button>
        </motion.div>

        {canDelete && (
          <motion.div variants={fadeUp} initial="hidden" animate="show">
            <Card className="p-6 border-danger-500/20">
              <h3 className="font-display font-bold text-danger-400 mb-2">Danger Zone</h3>
              <p className="text-xs text-surface-400 mb-4">Deleting this project will permanently remove all associated tasks, sprints, features, and data. This action cannot be undone.</p>
              {!showDeleteConfirm ? (
                <Button variant="danger" size="sm" onClick={() => setShowDeleteConfirm(true)} leftIcon={<Trash2 size={13} />}>Delete Project</Button>
              ) : (
                <div className="space-y-3">
                  <Input placeholder={`Type "${project.name}" to confirm`} value={deleteConfirmName} onChange={(e) => setDeleteConfirmName(e.target.value)} className="max-w-xs" />
                  <div className="flex items-center gap-3">
                    <Button variant="danger" size="sm" onClick={handleDelete} disabled={deleteConfirmName !== project.name || deleting} loading={deleting}>Confirm Delete</Button>
                    <Button variant="ghost" size="sm" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmName(''); }}>Cancel</Button>
                  </div>
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </main>
    </div>
  );
}