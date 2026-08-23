import { useState } from 'react';
import { cn } from '../../lib/cn';

// ── FocusFlow Avatar system ───────────────────────────────────────────────────
// Image (when a URL exists) → initials fallback → inline-SVG default icon.
// No image assets, no external services; works purely with existing user data.

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface SizeStyle {
  box: string;
  text: string;
  icon: number;
  chip: string;
}

const SIZES: Record<AvatarSize, SizeStyle> = {
  xs: { box: 'h-6 w-6', text: 'text-[9px]', icon: 12, chip: 'h-6 min-w-6 px-1 text-[9px]' },
  sm: { box: 'h-8 w-8', text: 'text-[11px]', icon: 15, chip: 'h-8 min-w-8 px-1.5 text-[10px]' },
  md: { box: 'h-10 w-10', text: 'text-[13px]', icon: 19, chip: 'h-10 min-w-10 px-2 text-xs' },
  lg: { box: 'h-14 w-14', text: 'text-lg', icon: 27, chip: 'h-14 min-w-14 px-2.5 text-sm' },
  xl: { box: 'h-24 w-24', text: 'text-[28px]', icon: 46, chip: 'h-24 min-w-24 px-3 text-lg' },
};

/** First letter of the first and last meaningful words: "Ajay Kumar" → "AK". */
export function getInitials(name?: string | null): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return `${first}${last}`.toUpperCase();
}

export interface AvatarProps {
  /** Optional avatar URL. Falls back to initials/default icon on absence or load failure. */
  src?: string | null;
  /** Full display name — drives initials and accessibility labels. */
  name?: string | null;
  size?: AvatarSize;
  className?: string;
  title?: string;
}

export function Avatar({ src, name, size = 'md', className, title }: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const s = SIZES[size];
  const initials = getInitials(name);
  const showImage = Boolean(src) && failedSrc !== src;
  const label = name || 'User';

  return (
    <span
      {...(!showImage && { role: 'img', 'aria-label': label })}
      title={title ?? name ?? undefined}
      className={cn(
        'relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full border',
        'border-surface-200 dark:border-white/10',
        'bg-gradient-to-br from-brand-500/15 via-cyan-500/10 to-violet-500/15',
        'dark:from-brand-500/30 dark:via-cyan-500/15 dark:to-violet-500/25',
        s.box,
        className,
      )}
    >
      {showImage ? (
        <img
          src={src ?? undefined}
          alt={name || ''}
          loading="lazy"
          draggable={false}
          onError={() => setFailedSrc(src ?? null)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : initials ? (
        <span
          aria-hidden="true"
          className={cn('font-display font-bold leading-none tracking-wide text-brand-800 dark:text-white', s.text)}
        >
          {initials}
        </span>
      ) : (
        <svg
          aria-hidden="true"
          width={s.icon}
          height={s.icon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-surface-400 dark:text-surface-500"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
        </svg>
      )}
    </span>
  );
}

export interface AvatarGroupProps {
  items: Array<{ src?: string | null; name?: string | null }>;
  /** How many avatars to show before collapsing into an overflow chip. */
  max?: number;
  size?: AvatarSize;
  className?: string;
}

/** Stacked avatar list with a "+N" overflow chip. */
export function AvatarGroup({ items, max = 3, size = 'sm', className }: AvatarGroupProps) {
  const s = SIZES[size];
  const visible = items.slice(0, Math.max(0, max));
  const overflow = items.length - visible.length;

  return (
    <div
      className={cn('flex items-center', className)}
      {...(items.length > 0 && { role: 'group', 'aria-label': `${items.length} member${items.length !== 1 ? 's' : ''}` })}
    >
      <div className="flex -space-x-1.5">
        {visible.map((m, i) => (
          <Avatar
            key={`${m.name ?? 'user'}-${i}`}
            src={m.src}
            name={m.name}
            size={size}
            className="ring-2 ring-surface-900 dark:ring-surface-900"
          />
        ))}
      </div>
      {overflow > 0 && (
        <span
          aria-hidden="true"
          className={cn(
            '-ml-1.5 inline-flex items-center justify-center rounded-full border border-surface-700/70',
            'bg-surface-800 font-bold text-surface-300 ring-2 ring-surface-900',
            s.chip,
          )}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
