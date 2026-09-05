import { motion } from 'framer-motion';
import { Calendar, Bookmark, BookmarkCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge, type BadgeTone } from '@shared/components/ui/Badge';
import { Progress } from '@shared/components/ui/Progress';
import { Button } from '@shared/components/ui/Button';
import { cn } from '@shared/utils/cn';
import type { ProjectData, ProjectStatus } from './types';

const STATUS_BADGE_TONE: Record<ProjectStatus, BadgeTone> = {
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

const TINT_LIGHT: Record<string, string> = {
  purple: 'bg-purple-50/70 border-purple-200/50',
  green: 'bg-emerald-50/70 border-emerald-200/50',
  pink: 'bg-pink-50/70 border-pink-200/50',
  blue: 'bg-sky-50/70 border-sky-200/50',
  orange: 'bg-orange-50/70 border-orange-200/50',
  gray: 'bg-gray-50/70 border-gray-200/50',
};

const ICON_BG: Record<string, string> = {
  purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  green: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  pink: 'bg-pink-500/10 text-pink-600 dark:text-pink-400',
  blue: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  orange: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  gray: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
};

const PROGRESS_TONE: Record<string, 'brand' | 'success' | 'warning' | 'danger'> = {
  active: 'brand',
  in_progress: 'info' as any,
  completed: 'success',
  on_hold: 'warning',
};

interface ProjectCardProps {
  project: ProjectData;
  onToggleBookmark: (id: string) => void;
}

export function ProjectCard({ project, onToggleBookmark }: ProjectCardProps) {
  const navigate = useNavigate();
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 14 },
        show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
      }}
      onClick={() => navigate(`/collab/team/${project.id}`)}
      className={cn(
        'group relative rounded-2xl border p-5 flex flex-col gap-3.5 transition-all duration-300 cursor-pointer',
        'bg-surface-900 border-surface-800',
        'hover:shadow-lg hover:-translate-y-0.5',
        'dark:bg-surface-850 dark:border-surface-800 dark:hover:border-surface-700',
        TINT_LIGHT[project.tint],
      )}
    >
      {/* Top row: Date + Bookmark */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs text-surface-400">
          <Calendar size={12} />
          {formatDate(project.startDate)}
        </span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleBookmark(project.id); }}
          className="p-1 rounded-lg text-surface-400 hover:text-brand-400 transition-colors"
          aria-label={project.bookmarked ? 'Remove bookmark' : 'Bookmark project'}
        >
          {project.bookmarked ? <BookmarkCheck size={16} className="text-brand-400" /> : <Bookmark size={16} />}
        </button>
      </div>

      {/* Project identity */}
      <div className="flex items-start gap-3">
        <div className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-display font-bold text-sm',
          ICON_BG[project.tint],
        )}>
          {project.iconEmoji}
        </div>
        <div className="min-w-0">
          <h3 className="font-display font-bold text-surface-50 text-sm leading-tight truncate">
            {project.name}
          </h3>
          <p className="text-xs text-surface-400 truncate">{project.client}</p>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5">
        {project.type.map((t) => (
          <Badge key={t} tone="neutral" className="text-[10px] px-2 py-0.5">
            {t}
          </Badge>
        ))}
        <Badge tone={STATUS_BADGE_TONE[project.status]} className="text-[10px] px-2 py-0.5">
          {STATUS_LABEL[project.status]}
        </Badge>
      </div>

      {/* Description */}
      <p className="text-xs text-surface-400 leading-relaxed line-clamp-2">
        {project.description}
      </p>

      {/* Task progress */}
      <div className="space-y-2 mt-auto">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-surface-300">
            {project.completedTasks} / {project.totalTasks} tasks
          </span>
          <span className="text-xs font-bold text-surface-300">
            {project.progress}%
          </span>
        </div>
        <Progress value={project.progress} tone={PROGRESS_TONE[project.status]} className="h-1.5" />
      </div>

      {/* View Details */}
      <Button
        variant="secondary"
        size="sm"
        className="w-full mt-1 rounded-xl text-xs font-bold opacity-80 group-hover:opacity-100 group-hover:bg-brand-500 group-hover:text-white group-hover:border-brand-500 transition-all duration-200"
        onClick={() => navigate(`/collab/team/${project.id}`)}
      >
        View Details
      </Button>
    </motion.div>
  );
}
