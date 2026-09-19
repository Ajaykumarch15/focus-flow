import { useMemo } from 'react';
import {
  Folder, MoreVertical, Users, ArrowRight,
} from 'lucide-react';
import { motion, type Variants } from 'framer-motion';
import { useStore } from '@worklog/services/useStore';
import { Avatar } from '@shared/components/ui/Avatar';
import { cn } from '@shared/utils/cn';

export interface WorkspaceCardNewProps {
  name: string;
  category: string;
  description: string;
  completionPercent: number;
  membersCount: number;
  projectsCount: number;
  memberAvatars?: Array<{ name: string; src?: string | null }>;
  lastAccessedAt?: string;
  onOpen: () => void;
  onMenuAction?: () => void;
  variants?: Variants;
  className?: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
  return `${Math.floor(diff / 86400000)} days ago`;
}

function CardIllustration({ type }: { type: string }) {
  switch (type) {
    case 'Startup':
      return (
        <svg viewBox="0 0 300 100" fill="none" className="w-full h-full" aria-hidden="true">
          <defs>
            <linearGradient id="ws-bg-startup" x1="0" y1="0" x2="300" y2="100">
              <stop offset="0%" stopColor="var(--ws-bg-startup)" />
              <stop offset="100%" stopColor="var(--ws-bg-startup-2)" />
            </linearGradient>
          </defs>
          <rect width="300" height="100" fill="url(#ws-bg-startup)" />
          <rect x="40" y="35" width="32" height="65" rx="4" fill="var(--ws-shape-startup)" fillOpacity="0.55" />
          <rect x="82" y="20" width="38" height="80" rx="4" fill="var(--ws-accent-startup)" fillOpacity="0.65" />
          <rect x="130" y="42" width="28" height="58" rx="4" fill="var(--ws-shape-startup)" fillOpacity="0.45" />
          <rect x="55" y="5" width="4" height="35" rx="2" fill="var(--ws-accent-startup)" fillOpacity="0.5" />
          <path d="M57 5 L78 22" stroke="var(--ws-accent-startup)" strokeWidth="1.5" strokeOpacity="0.4" />
          <circle cx="78" cy="22" r="3" fill="var(--ws-accent-startup)" fillOpacity="0.5" />
          <circle cx="210" cy="28" r="18" fill="var(--ws-shape-startup)" fillOpacity="0.2" />
          <circle cx="240" cy="50" r="12" fill="var(--ws-accent-startup)" fillOpacity="0.18" />
          <circle cx="265" cy="32" r="8" fill="var(--ws-shape-startup)" fillOpacity="0.22" />
        </svg>
      );
    case 'Personal':
      return (
        <svg viewBox="0 0 300 100" fill="none" className="w-full h-full" aria-hidden="true">
          <defs>
            <linearGradient id="ws-bg-personal" x1="0" y1="0" x2="300" y2="100">
              <stop offset="0%" stopColor="var(--ws-bg-personal)" />
              <stop offset="100%" stopColor="var(--ws-bg-personal-2)" />
            </linearGradient>
          </defs>
          <rect width="300" height="100" fill="url(#ws-bg-personal)" />
          <circle cx="200" cy="42" r="28" fill="var(--ws-accent-personal)" fillOpacity="0.45" />
          <circle cx="200" cy="28" r="20" fill="var(--ws-shape-personal)" fillOpacity="0.5" />
          <rect x="196" y="48" width="8" height="32" rx="4" fill="#92400e" fillOpacity="0.35" />
          <path d="M140 85 Q165 58 195 85" fill="var(--ws-shape-opensource)" fillOpacity="0.3" />
          <path d="M205 85 Q235 52 270 85" fill="var(--ws-accent-opensource)" fillOpacity="0.25" />
          <circle cx="45" cy="28" r="5" fill="var(--ws-shape-personal)" fillOpacity="0.35" />
          <circle cx="68" cy="18" r="3.5" fill="var(--ws-shape-personal)" fillOpacity="0.3" />
          <circle cx="92" cy="34" r="4" fill="var(--ws-accent-personal)" fillOpacity="0.28" />
        </svg>
      );
    case 'College Project':
      return (
        <svg viewBox="0 0 300 100" fill="none" className="w-full h-full" aria-hidden="true">
          <defs>
            <linearGradient id="ws-bg-college" x1="0" y1="0" x2="300" y2="100">
              <stop offset="0%" stopColor="var(--ws-bg-college)" />
              <stop offset="100%" stopColor="var(--ws-bg-college-2)" />
            </linearGradient>
          </defs>
          <rect width="300" height="100" fill="url(#ws-bg-college)" />
          <rect x="95" y="20" width="110" height="70" rx="7" fill="var(--ws-accent-college)" fillOpacity="0.3" stroke="var(--ws-accent-college)" strokeWidth="1.2" strokeOpacity="0.25" />
          <rect x="108" y="32" width="45" height="5" rx="2.5" fill="var(--ws-shape-college)" fillOpacity="0.5" />
          <rect x="108" y="41" width="65" height="3.5" rx="1.75" fill="var(--ws-shape-college)" fillOpacity="0.3" />
          <rect x="108" y="48" width="55" height="3.5" rx="1.75" fill="var(--ws-shape-college)" fillOpacity="0.25" />
          <rect x="108" y="55" width="75" height="3.5" rx="1.75" fill="var(--ws-shape-college)" fillOpacity="0.2" />
          <rect x="95" y="85" width="110" height="6" rx="3" fill="var(--ws-accent-college)" fillOpacity="0.35" />
          <circle cx="45" cy="48" r="14" fill="var(--ws-accent-college)" fillOpacity="0.25" />
          <circle cx="265" cy="38" r="12" fill="var(--ws-shape-college)" fillOpacity="0.22" />
        </svg>
      );
    case 'Open Source':
      return (
        <svg viewBox="0 0 300 100" fill="none" className="w-full h-full" aria-hidden="true">
          <defs>
            <linearGradient id="ws-bg-opensource" x1="0" y1="0" x2="300" y2="100">
              <stop offset="0%" stopColor="var(--ws-bg-opensource)" />
              <stop offset="100%" stopColor="var(--ws-bg-opensource-2)" />
            </linearGradient>
          </defs>
          <rect width="300" height="100" fill="url(#ws-bg-opensource)" />
          <circle cx="150" cy="50" r="35" fill="none" stroke="var(--ws-accent-opensource)" strokeWidth="1.8" strokeOpacity="0.4" />
          <circle cx="150" cy="50" r="22" fill="var(--ws-accent-opensource)" fillOpacity="0.2" />
          <circle cx="150" cy="20" r="5" fill="var(--ws-shape-opensource)" fillOpacity="0.6" />
          <circle cx="180" cy="65" r="5" fill="var(--ws-shape-opensource)" fillOpacity="0.6" />
          <circle cx="120" cy="65" r="5" fill="var(--ws-shape-opensource)" fillOpacity="0.6" />
          <path d="M150 20 L180 65" stroke="var(--ws-shape-opensource)" strokeWidth="1.2" strokeOpacity="0.4" />
          <path d="M150 20 L120 65" stroke="var(--ws-shape-opensource)" strokeWidth="1.2" strokeOpacity="0.4" />
          <path d="M120 65 L180 65" stroke="var(--ws-shape-opensource)" strokeWidth="1.2" strokeOpacity="0.4" />
          <circle cx="55" cy="32" r="8" fill="var(--ws-shape-opensource)" fillOpacity="0.3" />
          <circle cx="250" cy="42" r="6" fill="var(--ws-accent-opensource)" fillOpacity="0.35" />
        </svg>
      );
    case 'Internship':
      return (
        <svg viewBox="0 0 300 100" fill="none" className="w-full h-full" aria-hidden="true">
          <defs>
            <linearGradient id="ws-bg-internship" x1="0" y1="0" x2="300" y2="100">
              <stop offset="0%" stopColor="var(--ws-bg-internship)" />
              <stop offset="100%" stopColor="var(--ws-bg-internship-2)" />
            </linearGradient>
          </defs>
          <rect width="300" height="100" fill="url(#ws-bg-internship)" />
          <rect x="115" y="25" width="70" height="50" rx="6" fill="var(--ws-accent-internship)" fillOpacity="0.35" stroke="var(--ws-accent-internship)" strokeWidth="1.2" strokeOpacity="0.3" />
          <rect x="128" y="34" width="44" height="5" rx="2.5" fill="var(--ws-shape-internship)" fillOpacity="0.45" />
          <rect x="128" y="43" width="35" height="3.5" rx="1.75" fill="var(--ws-shape-internship)" fillOpacity="0.3" />
          <rect x="115" y="68" width="70" height="6" rx="3" fill="var(--ws-accent-internship)" fillOpacity="0.4" />
          <rect x="45" y="52" width="18" height="28" rx="4" fill="var(--ws-accent-internship)" fillOpacity="0.35" />
          <rect x="49" y="42" width="10" height="14" rx="5" fill="var(--ws-shape-internship)" fillOpacity="0.4" />
          <circle cx="250" cy="38" r="10" fill="var(--ws-accent-internship)" fillOpacity="0.25" />
        </svg>
      );
    case 'Enterprise':
      return (
        <svg viewBox="0 0 300 100" fill="none" className="w-full h-full" aria-hidden="true">
          <defs>
            <linearGradient id="ws-bg-enterprise" x1="0" y1="0" x2="300" y2="100">
              <stop offset="0%" stopColor="var(--ws-bg-enterprise)" />
              <stop offset="100%" stopColor="var(--ws-bg-enterprise-2)" />
            </linearGradient>
          </defs>
          <rect width="300" height="100" fill="url(#ws-bg-enterprise)" />
          <rect x="55" y="30" width="28" height="70" rx="4" fill="var(--ws-accent-enterprise)" fillOpacity="0.4" />
          <rect x="93" y="15" width="34" height="85" rx="4" fill="var(--ws-shape-enterprise)" fillOpacity="0.45" />
          <rect x="137" y="35" width="25" height="65" rx="4" fill="var(--ws-accent-enterprise)" fillOpacity="0.35" />
          <rect x="172" y="10" width="30" height="90" rx="4" fill="var(--ws-shape-enterprise)" fillOpacity="0.5" />
          <rect x="212" y="25" width="22" height="75" rx="4" fill="var(--ws-accent-enterprise)" fillOpacity="0.35" />
          <rect x="60" y="38" width="7" height="5" rx="1.5" fill="var(--ws-shape-enterprise)" fillOpacity="0.3" />
          <rect x="72" y="38" width="7" height="5" rx="1.5" fill="var(--ws-shape-enterprise)" fillOpacity="0.3" />
          <rect x="98" y="23" width="7" height="5" rx="1.5" fill="var(--ws-shape-enterprise)" fillOpacity="0.3" />
          <rect x="112" y="23" width="7" height="5" rx="1.5" fill="var(--ws-shape-enterprise)" fillOpacity="0.3" />
          <rect x="177" y="18" width="7" height="5" rx="1.5" fill="var(--ws-shape-enterprise)" fillOpacity="0.3" />
          <rect x="190" y="18" width="7" height="5" rx="1.5" fill="var(--ws-shape-enterprise)" fillOpacity="0.3" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 300 100" fill="none" className="w-full h-full" aria-hidden="true">
          <defs>
            <linearGradient id="ws-bg-default" x1="0" y1="0" x2="300" y2="100">
              <stop offset="0%" stopColor="var(--ws-bg-default)" />
              <stop offset="100%" stopColor="var(--ws-bg-default-2)" />
            </linearGradient>
          </defs>
          <rect width="300" height="100" fill="url(#ws-bg-default)" />
          <circle cx="100" cy="50" r="22" fill="var(--ws-shape-default)" fillOpacity="0.3" />
          <circle cx="200" cy="40" r="16" fill="var(--ws-accent-default)" fillOpacity="0.25" />
          <circle cx="150" cy="60" r="14" fill="var(--ws-shape-default)" fillOpacity="0.28" />
        </svg>
      );
  }
}

const TYPE_BORDER: Record<string, string> = {
  Startup: 'border-t-blue-400',
  Personal: 'border-t-orange-400',
  'College Project': 'border-t-indigo-400',
  'Open Source': 'border-t-emerald-400',
  Internship: 'border-t-amber-400',
  Enterprise: 'border-t-slate-400',
};

const TYPE_CONTENT: Record<string, string> = {
  Startup: 'var(--ws-content-startup)',
  Personal: 'var(--ws-content-personal)',
  'College Project': 'var(--ws-content-college)',
  'Open Source': 'var(--ws-content-opensource)',
  Internship: 'var(--ws-content-internship)',
  Enterprise: 'var(--ws-content-enterprise)',
};

function CircularProgress({ percent, accentColor }: { percent: number; accentColor: string }) {
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  return (
    <div className="relative w-9 h-9 flex-shrink-0">
      <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r={radius} fill="none" stroke="currentColor" strokeWidth="3" className="text-surface-200 dark:text-surface-700" />
        <circle cx="18" cy="18" r={radius} fill="none" stroke={accentColor} strokeWidth="3" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-500" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-surface-600 dark:text-surface-300">
        {percent}%
      </span>
    </div>
  );
}

export function WorkspaceCardNew({
  name,
  category,
  description,
  completionPercent,
  membersCount,
  projectsCount,
  memberAvatars = [],
  lastAccessedAt,
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
        'group flex flex-col overflow-hidden rounded-2xl',
        'border border-surface-200 dark:border-surface-800',
        'border-t-[3px]',
        TYPE_BORDER[category] || 'border-t-blue-400',
        'bg-white dark:bg-surface-900/80',
        'shadow-sm transition-all duration-300 ease-snappy',
        'hover:shadow-lg hover:border-surface-300 dark:hover:border-surface-700',
        'focus-within:ring-2 focus-within:ring-brand-400/50',
        className,
      )}
    >
      {/* Illustration Area */}
      <div className="relative h-32 overflow-hidden">
        <CardIllustration type={category} />
        <div className="absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-white dark:from-surface-900/80 to-transparent pointer-events-none" />
        {/* Status badge */}
        <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/90 dark:bg-surface-900/90 backdrop-blur-sm text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Active
        </span>
        {/* Menu button */}
        <button
          type="button"
          onClick={onMenuAction}
          aria-label="More options"
          className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-lg bg-white/80 dark:bg-surface-900/80 backdrop-blur-sm text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 hover:bg-white dark:hover:bg-surface-800 transition-all opacity-60 group-hover:opacity-100"
        >
          <MoreVertical size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        {/* Icon + Name + Type */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `color-mix(in srgb, ${TYPE_CONTENT[category] || 'var(--ws-content-default)'} 12%, transparent)` }}>
            <Folder size={18} style={{ color: TYPE_CONTENT[category] || 'var(--ws-content-default)' }} strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-sm font-bold tracking-tight text-surface-50 truncate">
              {name}
            </h3>
            <span className="inline-block rounded-full px-2 py-px text-[9px] font-semibold mt-0.5" style={{ backgroundColor: `color-mix(in srgb, ${TYPE_CONTENT[category] || 'var(--ws-content-default)'} 12%, transparent)`, color: TYPE_CONTENT[category] || 'var(--ws-content-default)' }}>
              {category}
            </span>
          </div>
        </div>

        {/* Description */}
        <p className="line-clamp-2 text-[11px] leading-relaxed text-surface-400">
          {description || 'No description provided.'}
        </p>

        {/* Stats Row */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: `color-mix(in srgb, ${TYPE_CONTENT[category] || 'var(--ws-content-default)'} 12%, transparent)` }}>
              <Users size={12} style={{ color: TYPE_CONTENT[category] || 'var(--ws-content-default)' }} />
            </div>
            <div>
              <p className="font-display text-xs font-bold leading-tight text-surface-50">{membersCount}</p>
              <p className="text-[9px] text-surface-400">Members</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: `color-mix(in srgb, ${TYPE_CONTENT[category] || 'var(--ws-content-default)'} 12%, transparent)` }}>
              <Folder size={12} style={{ color: TYPE_CONTENT[category] || 'var(--ws-content-default)' }} />
            </div>
            <div>
              <p className="font-display text-xs font-bold leading-tight text-surface-50">{projectsCount}</p>
              <p className="text-[9px] text-surface-400">Project</p>
            </div>
          </div>

          <div className="ml-auto">
            <CircularProgress percent={clamped} accentColor={TYPE_CONTENT[category] || 'var(--ws-content-default)'} />
          </div>
        </div>

        {/* Member Avatars */}
        {memberAvatars.length > 0 && (
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center">
              <div className="flex -space-x-1.5">
                {memberAvatars.slice(0, 3).map((m, i) => (
                  <Avatar
                    key={`${m.name}-${i}`}
                    src={m.src}
                    name={m.name}
                    size="xs"
                    className="ring-2 ring-white dark:ring-surface-900"
                  />
                ))}
              </div>
              {memberAvatars.length > 3 && (
                <span className="-ml-1 inline-flex items-center justify-center rounded-full border border-surface-200 dark:border-surface-700 bg-surface-100 dark:bg-surface-800 h-6 min-w-6 px-1 text-[9px] font-bold text-surface-500 ring-2 ring-white dark:ring-surface-900">
                  +{memberAvatars.length - 3}
                </span>
              )}
            </div>
            {lastAccessedAt && (
              <div className="text-right">
                <p className="text-[9px] text-surface-400">Last accessed</p>
                <p className="text-[10px] font-medium text-surface-500">{timeAgo(lastAccessedAt)}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Footer */}
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'flex w-full items-center justify-between px-4 py-2.5',
          'border-t border-surface-200 dark:border-surface-800/70',
          'text-xs font-semibold',
          'transition-all duration-200',
          'hover:bg-gradient-to-r hover:from-brand-500/10 hover:to-brand-500/5',
          'hover:text-brand-600 dark:hover:text-brand-400',
          'text-brand-600 dark:text-brand-400',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400/50',
        )}
      >
        <span>Open workspace</span>
        <ArrowRight
          size={14}
          className="transition-transform duration-300 group-hover:translate-x-1.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
        />
      </button>
    </motion.div>
  );
}
