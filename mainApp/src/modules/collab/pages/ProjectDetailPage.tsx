import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, CheckSquare, Users,
  CalendarDays, FolderOpen, ChevronRight, LayoutGrid,
} from 'lucide-react';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { useCalendarStore } from '@worklog/services/useCalendarStore';
import { useKanbanStore } from '@worklog/components/kanban/kanbanStore';
import { SAMPLE_PROJECTS, type ProjectStatus } from '@collab/components/projects/types';
import { Badge, type BadgeTone } from '@shared/components/ui/Badge';
import { Progress } from '@shared/components/ui/Progress';
import { Button } from '@shared/components/ui/Button';

const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };
const stagger = { show: { transition: { staggerChildren: 0.08 } } };

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

const ICON_BG: Record<string, string> = {
  purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  green: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  pink: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
  blue: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  orange: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  gray: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
};

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { members, tasks } = useCollaborationStore();
  const { events } = useCalendarStore();
  const kanbanTasks = useKanbanStore((s) => s.tasks);

  const project = useMemo(
    () => SAMPLE_PROJECTS.find((p) => p.id === projectId),
    [projectId],
  );

  // Compute stats for the cards
  const stats = useMemo(() => {
    if (!project) return { memberCount: 0, taskCount: 0, doneTasks: 0, activeTasks: 0, eventCount: 0, kanbanTotal: 0, kanbanTodo: 0, kanbanDoing: 0, kanbanReview: 0, kanbanDone: 0 };

    // Members: if project has memberIds, filter; otherwise show total workspace members
    const memberCount = project.memberIds
      ? members.filter((m) => project.memberIds!.includes(m.id)).length
      : members.length;

    // Tasks: filter by project name (since SAMPLE_PROJECTS don't have real task links)
    const projectTasks = tasks.filter(
      (t) => t.projectId === project.id || t.title.toLowerCase().includes(project.name.toLowerCase()),
    );
    const doneTasks = projectTasks.filter((t) => t.sprintStatus === 'done').length;
    const activeTasks = projectTasks.filter(
      (t) => t.sprintStatus === 'in_progress' || t.sprintStatus === 'review',
    ).length;

    // Calendar events: filter by project name
    const projectEvents = events.filter(
      (e) => e.projectName?.toLowerCase() === project.name.toLowerCase(),
    );

    // Kanban tasks breakdown
    const kanbanTodo = kanbanTasks.filter((t) => t.status === 'todo').length;
    const kanbanDoing = kanbanTasks.filter((t) => t.status === 'doing').length;
    const kanbanReview = kanbanTasks.filter((t) => t.status === 'review').length;
    const kanbanDone = kanbanTasks.filter((t) => t.status === 'done').length;

    return {
      memberCount,
      taskCount: projectTasks.length || project.totalTasks,
      doneTasks: projectTasks.length > 0 ? doneTasks : project.completedTasks,
      activeTasks: projectTasks.length > 0 ? activeTasks : project.totalTasks - project.completedTasks,
      eventCount: projectEvents.length,
      kanbanTotal: kanbanTasks.length,
      kanbanTodo,
      kanbanDoing,
      kanbanReview,
      kanbanDone,
    };
  }, [project, members, tasks, events, kanbanTasks]);

  if (!project) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <FolderOpen size={40} className="mx-auto text-surface-500" />
          <h1 className="text-lg font-display font-bold text-surface-100">Project not found</h1>
          <p className="text-sm text-surface-400">This project does not exist.</p>
          <Button onClick={() => navigate('/collab/team')} leftIcon={<ArrowLeft size={14} />}>
            Back to Projects
          </Button>
        </div>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-surface-950 relative overflow-x-hidden overflow-y-auto">
      {/* Background decorative gradients */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-500/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-cyan-500/8 rounded-full blur-3xl pointer-events-none" />

      {/* Sticky header bar */}
      <header className="sticky top-0 z-20 bg-surface-950/80 backdrop-blur-xl border-b border-surface-800/60">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/collab/team')}
            className="flex items-center gap-1.5 text-xs font-bold text-surface-400 hover:text-surface-100 transition-colors bg-surface-900 hover:bg-surface-800 px-3 py-2 rounded-xl border border-surface-800"
          >
            <ArrowLeft size={14} /> Projects
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl overflow-hidden shadow-md shadow-brand-500/10">
              <img src="/darkicon.png" alt="FocusFlow" className="w-full h-full object-cover dark:hidden" />
              <img src="/darkicon.png" alt="FocusFlow" className="w-full h-full object-cover hidden dark:block" />
            </div>
            <div>
              <h1 className="font-display font-bold text-sm leading-none text-surface-50">{project.name}</h1>
              <p className="text-[10px] text-surface-400 font-medium mt-0.5">{project.client}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 relative z-10">
        {/* Project Header */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="card p-6 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 font-display font-bold text-xl ${ICON_BG[project.tint]}`}>
                {project.iconEmoji}
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-display font-extrabold text-surface-50 tracking-tight">
                  {project.name}
                </h2>
                <p className="text-sm text-surface-400 mt-0.5">{project.client}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge tone={STATUS_BADGE[project.status]} className="text-[10px] font-extrabold uppercase tracking-wider">
                    {STATUS_LABEL[project.status]}
                  </Badge>
                  {project.type.map((t) => (
                    <Badge key={t} tone="neutral" className="text-[10px]">{t}</Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="text-right text-xs text-surface-400 space-y-1">
              <p>{formatDate(project.startDate)} – {formatDate(project.endDate)}</p>
            </div>
          </div>

          <p className="text-sm text-surface-300 leading-relaxed">{project.description}</p>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-surface-300">
                {project.completedTasks} / {project.totalTasks} tasks completed
              </span>
              <span className="text-xs font-bold text-surface-200">{project.progress}%</span>
            </div>
            <Progress value={project.progress} tone="brand" className="h-2" />
          </div>
        </motion.div>

        {/* Feature Cards */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 gap-5"
        >
          {/* People Card */}
          <motion.button
            variants={fadeUp}
            type="button"
            onClick={() => navigate('/collab/people')}
            className="card card-hover p-6 text-left group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
          >
            <div className="w-12 h-12 rounded-2xl bg-brand-500/10 flex items-center justify-center mb-4">
              <Users size={22} className="text-brand-400" />
            </div>
            <h3 className="font-display font-bold text-surface-50 text-base">People</h3>
            <p className="text-xs text-surface-400 mt-1">Team members and collaborators</p>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-2xl font-display font-extrabold text-surface-50">
                {stats.memberCount}
              </span>
              <span className="text-xs text-surface-400">members</span>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-brand-400 group-hover:text-brand-300 transition-colors">
              View People <ChevronRight size={14} />
            </div>
          </motion.button>

          {/* Tasks Card */}
          <motion.button
            variants={fadeUp}
            type="button"
            onClick={() => navigate('/worklog/tasks')}
            className="card card-hover p-6 text-left group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-4">
              <CheckSquare size={22} className="text-blue-400" />
            </div>
            <h3 className="font-display font-bold text-surface-50 text-base">Tasks</h3>
            <p className="text-xs text-surface-400 mt-1">Kanban board and task management</p>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-2xl font-display font-extrabold text-surface-50">
                {stats.taskCount}
              </span>
              <span className="text-xs text-surface-400">tasks</span>
            </div>
            <div className="mt-2 flex items-center gap-3 text-[11px]">
              <span className="text-success-400 font-semibold">{stats.doneTasks} done</span>
              <span className="text-brand-400 font-semibold">{stats.activeTasks} active</span>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-blue-400 group-hover:text-blue-300 transition-colors">
              View Tasks <ChevronRight size={14} />
            </div>
          </motion.button>

          {/* Calendar Card */}
          <motion.button
            variants={fadeUp}
            type="button"
            onClick={() => navigate('/worklog/calendar')}
            className="card card-hover p-6 text-left group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
          >
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-4">
              <CalendarDays size={22} className="text-purple-400" />
            </div>
            <h3 className="font-display font-bold text-surface-50 text-base">Calendar</h3>
            <p className="text-xs text-surface-400 mt-1">Schedule, meetings, and deadlines</p>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-2xl font-display font-extrabold text-surface-50">
                {stats.eventCount}
              </span>
              <span className="text-xs text-surface-400">events</span>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-purple-400 group-hover:text-purple-300 transition-colors">
              View Calendar <ChevronRight size={14} />
            </div>
          </motion.button>

          {/* Kanban Card */}
          <motion.button
            variants={fadeUp}
            type="button"
            onClick={() => navigate(`/collab/team/${project.id}/kanban`)}
            className="card card-hover p-6 text-left group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
          >
            <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center mb-4">
              <LayoutGrid size={22} className="text-orange-400" />
            </div>
            <h3 className="font-display font-bold text-surface-50 text-base">Kanban</h3>
            <p className="text-xs text-surface-400 mt-1">Drag-drop board and task flow</p>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-2xl font-display font-extrabold text-surface-50">
                {stats.kanbanTotal}
              </span>
              <span className="text-xs text-surface-400">tasks</span>
            </div>
            <div className="mt-2 flex items-center gap-3 text-[11px]">
              <span className="text-surface-400 font-semibold">{stats.kanbanTodo} todo</span>
              <span className="text-orange-400 font-semibold">{stats.kanbanDoing} doing</span>
              <span className="text-blue-400 font-semibold">{stats.kanbanReview} review</span>
              <span className="text-success-400 font-semibold">{stats.kanbanDone} done</span>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-orange-400 group-hover:text-orange-300 transition-colors">
              View Board <ChevronRight size={14} />
            </div>
          </motion.button>
        </motion.div>
      </main>
    </div>
  );
}
