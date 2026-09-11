import { useMemo } from 'react';
import {
  Folder,
  MoreVertical,
  CheckSquare,
  Clock,
  Users,
  ArrowRight,
} from 'lucide-react';
import { motion, type Variants } from 'framer-motion';
import { useStore } from '@worklog/services/useStore';
import { cn } from '@shared/utils/cn';

export interface WorkspaceCardNewProps {
  name: string;
  category: string;
  description: string;
  activeTasks: number;
  completionPercent: number;
  membersCount: number;
  projectsCount: number;
  onOpen: () => void;
  onMenuAction?: () => void;
  variants?: Variants;
  className?: string;
}

export function WorkspaceCardNew({
  name,
  category,
  description,
  activeTasks,
  completionPercent,
  membersCount,
  projectsCount,
  onOpen,
  onMenuAction,
  variants,
  className,
}: WorkspaceCardNewProps) {
  const theme = useStore((s) => s.theme);
  const prefersReducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );
  const reduceMotion = theme.reducedMotion || prefersReducedMotion;
  const clamped = Math.min(100, Math.max(0, completionPercent));

  return (
    <motion.div
      variants={variants}
      whileHover={
        reduceMotion
          ? undefined
          : { y: -4, transition: { duration: 0.25, ease: 'easeOut' } }
      }
      className={cn(
        'group flex flex-col overflow-hidden rounded-[1.375rem]',
        'border border-surface-800 accent-border bg-surface-900',
        'shadow-sm transition-all duration-250 ease-snappy',
        'hover:shadow-md hover:border-surface-700',
        'focus-within:ring-2 focus-within:ring-brand-400/50',
        className,
      )}
    >
      {/* Body */}
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        {/* Header: Icon + Menu */}
        <div className="flex items-start justify-between">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10">
            <Folder
              size={16}
              className="text-brand-500"
              strokeWidth={1.75}
            />
          </div>

          <button
            type="button"
            onClick={onMenuAction}
            aria-label="More options"
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-md',
              'text-surface-400 transition-colors duration-200',
              'hover:bg-surface-800 hover:text-surface-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/50',
            )}
          >
            <MoreVertical size={14} />
          </button>
        </div>

        {/* Title + Category */}
        <div className="space-y-0.5">
          <h3 className="font-display text-sm font-bold tracking-tight text-surface-50">
            {name}
          </h3>
          <span
            className={cn(
              'inline-block rounded-full px-1.5 py-px',
              'text-[9px] font-semibold',
              'bg-brand-500/10 text-brand-600 dark:text-brand-400',
            )}
          >
            {category}
          </span>
        </div>

        {/* Description */}
        <p className="line-clamp-2 text-[11px] leading-relaxed text-surface-400">
          {description}
        </p>

        {/* Metrics */}
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-500/10">
              <CheckSquare size={12} className="text-brand-500" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-sm font-bold leading-tight text-surface-50">
                {activeTasks}
              </p>
              <p className="text-[10px] text-surface-400">Active</p>
            </div>
          </div>

          <div className="flex flex-1 items-center gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-500/10">
              <Clock size={12} className="text-brand-500" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-sm font-bold leading-tight text-surface-50">
                {clamped}%
              </p>
              <p className="text-[10px] text-surface-400">Done</p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1 w-full overflow-hidden rounded-full bg-surface-800/70">
          <div
            className="h-full rounded-full bg-brand-500 transition-all duration-500 ease-snappy"
            style={{ width: `${clamped}%` }}
            role="progressbar"
            aria-valuenow={clamped}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${clamped}% completed`}
          />
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-2 text-[10px] text-surface-400">
          <span className="flex items-center gap-1">
            <Users size={11} className="text-surface-500" />
            {membersCount} members
          </span>
          <span className="h-3 w-px bg-surface-800" />
          <span className="flex items-center gap-1">
            <Folder size={11} className="text-surface-500" />
            {projectsCount} projects
          </span>
        </div>
      </div>

      {/* Action Footer */}
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'flex w-full items-center justify-between px-3.5 py-2',
          'border-t border-surface-800/70',
          'bg-brand-500/[0.04] text-brand-600 dark:text-brand-400',
          'text-[11px] font-semibold',
          'transition-colors duration-200',
          'hover:bg-brand-500/10',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400/50',
        )}
      >
        <span>Open workspace</span>
        <ArrowRight
          size={12}
          className="transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
        />
      </button>
    </motion.div>
  );
}
