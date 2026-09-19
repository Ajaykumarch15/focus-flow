import { motion } from 'framer-motion';
import { Bookmark, BookmarkCheck, ArrowRight, Users, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWorkspaceId } from '@collab/hooks/useWorkspaceId';
import { Badge, type BadgeTone } from '@shared/components/ui/Badge';
import { Progress } from '@shared/components/ui/Progress';
import { cn } from '@shared/utils/cn';
import type { ProjectData, ProjectStatus, CardTint } from './types';

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

const TINT_BORDER: Record<CardTint, string> = {
  purple: 'border-t-purple-500',
  green: 'border-t-emerald-500',
  pink: 'border-t-pink-500',
  blue: 'border-t-blue-500',
  orange: 'border-t-orange-500',
  gray: 'border-t-gray-400',
};

const TINT_SVG_ACCENT: Record<CardTint, string> = {
  purple: 'var(--project-shape-purple)',
  green: 'var(--project-shape-green)',
  pink: 'var(--project-shape-pink)',
  blue: 'var(--project-shape-blue)',
  orange: 'var(--project-shape-orange)',
  gray: 'var(--project-shape-gray)',
};

const TINT_SVG_BG: Record<CardTint, string> = {
  purple: 'var(--project-bg-purple)',
  green: 'var(--project-bg-green)',
  pink: 'var(--project-bg-pink)',
  blue: 'var(--project-bg-blue)',
  orange: 'var(--project-bg-orange)',
  gray: 'var(--project-bg-gray)',
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
  const workspaceId = useWorkspaceId();
  const accent = TINT_SVG_ACCENT[project.tint];
  const bg = TINT_SVG_BG[project.tint];

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
      onClick={() => navigate(`/collab/${workspaceId}/projects/${project.id}`)}
      className={cn(
        'group relative rounded-2xl border border-t-[3px] overflow-hidden transition-all duration-300 cursor-pointer',
        'bg-surface-900 border-surface-800',
        'hover:shadow-lg hover:-translate-y-0.5',
        'dark:bg-surface-850 dark:border-surface-800 dark:hover:border-surface-700',
        TINT_BORDER[project.tint],
      )}
    >
      {/* Full-card SVG background */}
      <div className="absolute inset-0 pointer-events-none">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 420" fill="none" preserveAspectRatio="xMidYMid slice">
          {/* Dot grid */}
          {[...Array(15)].map((_, r) =>
            [...Array(10)].map((_, c) => (
              <circle key={`${r}-${c}`} cx={20 + c * 30} cy={10 + r * 28} r="1" fill={accent} opacity="0.06" />
            ))
          )}
          {/* Large decorative circle — top-right */}
          <circle cx="250" cy="50" r="55" fill={bg} />
          <circle cx="260" cy="40" r="38" fill={accent} opacity="0.1" />
          <circle cx="272" cy="28" r="14" fill={accent} opacity="0.18" />
          {/* Medium circle — mid-left */}
          <circle cx="40" cy="180" r="30" fill={bg} opacity="0.6" />
          <circle cx="45" cy="175" r="18" fill={accent} opacity="0.08" />
          {/* Geometric shapes */}
          <rect x="60" y="280" width="50" height="50" rx="10" fill={accent} opacity="0.04" />
          <rect x="68" y="288" width="34" height="34" rx="8" fill={accent} opacity="0.06" />
          <rect x="220" cy="320" width="30" height="30" rx="6" fill={accent} opacity="0.05" transform="rotate(20 235 335)" />
          {/* Floating accents */}
          <circle cx="140" cy="30" r="5" fill={accent} opacity="0.1" />
          <circle cx="100" cy="60" r="3" fill={accent} opacity="0.08" />
          <circle cx="200" cy="120" r="4" fill={accent} opacity="0.07" />
          <circle cx="50" cy="350" r="6" fill={accent} opacity="0.06" />
          <circle cx="260" cy="380" r="4" fill={accent} opacity="0.08" />
          {/* Subtle diagonal line */}
          <line x1="0" y1="200" x2="300" y2="160" stroke={accent} opacity="0.03" strokeWidth="1" />
        </svg>
      </div>

      {/* Gradient overlay: transparent top → surface bottom for readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-surface-900 via-surface-900/70 to-surface-900/20 dark:from-surface-850 dark:via-surface-850/70 dark:to-surface-850/20 pointer-events-none" />

      {/* Content */}
      <div className="relative p-5 flex flex-col gap-3 h-full">
        {/* Top row: Status badge + Bookmark */}
        <div className="flex items-center justify-between">
          <Badge tone={STATUS_BADGE_TONE[project.status]} className="text-[10px] px-2 py-0.5">
            {STATUS_LABEL[project.status]}
          </Badge>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleBookmark(project.id); }}
            className="p-1 rounded-lg text-surface-400 hover:text-brand-400 transition-all hover:scale-110 active:scale-95"
            aria-label={project.bookmarked ? 'Remove bookmark' : 'Bookmark project'}
          >
            {project.bookmarked ? (
              <BookmarkCheck size={16} className="text-brand-400" />
            ) : (
              <Bookmark size={16} />
            )}
          </button>
        </div>

        {/* Project identity */}
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-display font-bold text-sm"
            style={{
              backgroundColor: `color-mix(in srgb, var(--project-shape-${project.tint}) 12%, transparent)`,
              color: `var(--project-content-${project.tint})`,
            }}
          >
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
        </div>

        {/* Description */}
        <p className="text-xs text-surface-400 leading-relaxed line-clamp-2">
          {project.description}
        </p>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Stats row */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-surface-500">
            <CheckCircle2 size={12} />
            <span className="text-[11px] font-medium">{project.completedTasks}/{project.totalTasks}</span>
          </div>
          <div className="flex items-center gap-1 text-surface-500">
            <Users size={12} />
            <span className="text-[11px] font-medium">{project.memberIds?.length ?? 0}</span>
          </div>
          <span className="text-[10px] text-surface-500 ml-auto">{formatDate(project.startDate)}</span>
        </div>

        {/* Task progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-surface-300">Progress</span>
            <span className="text-[11px] font-bold text-surface-300">{project.progress}%</span>
          </div>
          <Progress value={project.progress} tone={PROGRESS_TONE[project.status]} className="h-1.5" ariaLabel={`${project.name} progress ${project.progress}%`} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-surface-800/60 group-hover:border-surface-700 transition-colors">
          <span className="text-[11px] font-semibold text-surface-400 group-hover:text-brand-400 transition-colors">
            View Details
          </span>
          <ArrowRight
            size={13}
            className="text-surface-500 group-hover:text-brand-400 group-hover:translate-x-1 transition-all duration-200"
          />
        </div>
      </div>
    </motion.div>
  );
}
