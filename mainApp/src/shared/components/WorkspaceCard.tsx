import { useMemo, type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { motion, type Variants } from 'framer-motion';
import { useStore } from '@worklog/services/useStore';

export type HubAccent = 'green' | 'cyan' | 'violet';

interface AccentTokens {
  dot: string;
  wash: string;
  actionHover: string;
  focusRing: string;
}

const ACCENTS: Record<HubAccent, AccentTokens> = {
  green: {
    dot: 'bg-emerald-400',
    wash: 'from-emerald-500/20',
    actionHover: 'hover:bg-emerald-500/30 hover:border-emerald-300/30',
    focusRing: 'focus-within:ring-2 focus-within:ring-emerald-400/50',
  },
  cyan: {
    dot: 'bg-cyan-400',
    wash: 'from-cyan-500/20',
    actionHover: 'hover:bg-cyan-500/30 hover:border-cyan-300/30',
    focusRing: 'focus-within:ring-2 focus-within:ring-cyan-400/50',
  },
  violet: {
    dot: 'bg-violet-400',
    wash: 'from-violet-500/20',
    actionHover: 'hover:bg-violet-500/30 hover:border-violet-300/30',
    focusRing: 'focus-within:ring-2 focus-within:ring-violet-400/50',
  },
};

export interface HubChip {
  icon?: ReactNode;
  label: string;
}

export interface WorkspaceCardProps {
  accent: HubAccent;
  badges: string[];
  title: string;
  image: { light: string; dark: string; lightSrcSet?: string; darkSrcSet?: string };
  chips: HubChip[];
  actionLabel: string;
  onAction: () => void;
  variants?: Variants;
  className?: string;
}

export function WorkspaceCard({
  accent,
  badges,
  title,
  image,
  chips,
  actionLabel,
  onAction,
  variants,
  className,
}: WorkspaceCardProps) {
  const theme = useStore(s => s.theme);
  const isDark = theme.mode === 'dark';
  // Reactive once on mount; theme.reducedMotion already covers the app-level flag.
  const prefersReducedMotion = useMemo(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  );
  const reduceMotion = theme.reducedMotion || prefersReducedMotion;
  const a = ACCENTS[accent];

  return (
    <motion.div
      variants={variants}
      whileHover={reduceMotion ? undefined : { y: -4, transition: { duration: 0.25, ease: 'easeOut' } }}
      className={`group relative flex min-h-[180px] flex-col overflow-hidden rounded-3xl border border-white/15
                  shadow-lg shadow-black/10 transition-[border-color] duration-300 hover:border-white/30
                  ${a.focusRing} ${className ?? ''}`}
    >
      {/* Full-bleed background image */}
      <img
        src={isDark ? image.dark : image.light}
        srcSet={isDark ? image.darkSrcSet : image.lightSrcSet}
        sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
        alt=""
        aria-hidden="true"
        loading="lazy"
        draggable={false}
        className="absolute inset-0 h-full w-full select-none object-cover object-center transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      />

      {/* Readability gradient — transparent top, strong bottom */}
      <div
        aria-hidden="true"
        className={`absolute inset-0 ${
          isDark
            ? 'bg-gradient-to-b from-black/35 via-black/45 to-black/85'
            : 'bg-gradient-to-b from-black/10 via-black/30 to-black/75'
        }`}
      />
      {/* Hover deepening layer */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/15 opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:hidden"
      />
      {/* Accent wash — subtle, stronger in dark mode */}
      <div
        aria-hidden="true"
        className={`absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t ${a.wash} ${
          isDark ? 'opacity-60' : 'opacity-30'
        } to-transparent`}
      />

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col p-6">
        {/* Category badges */}
        <div className="flex flex-wrap items-center gap-2">
          {badges.map((badge, i) => (
            <span
              key={badge}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/25 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white/90 backdrop-blur-md"
            >
              {i === 0 && <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${a.dot}`} />}
              {badge}
            </span>
          ))}
        </div>

        {/* Bottom-anchored editorial content */}
        <div className="mt-auto pt-24">
          <h3 className="font-display text-2xl font-extrabold leading-tight tracking-tight text-white [text-shadow:0_1px_12px_rgba(0,0,0,0.35)]">
            {title}
          </h3>

          {/* Supporting information */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {chips.map(chip => (
              <span
                key={chip.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/85 backdrop-blur-md"
              >
                {chip.icon}
                {chip.label}
              </span>
            ))}
          </div>

          {/* Primary action */}
          <button
            type="button"
            onClick={onAction}
            className={`mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-5 py-3.5 text-xs font-bold text-white backdrop-blur-md transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${a.actionHover}`}
          >
            {actionLabel}
            <ArrowRight
              size={16}
              aria-hidden="true"
              className="transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
            />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
