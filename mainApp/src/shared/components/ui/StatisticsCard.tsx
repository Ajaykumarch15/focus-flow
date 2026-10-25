import { useEffect, useRef, type ReactNode } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import lottie from 'lottie-web';
import { cn } from '@shared/utils/cn';
import { Badge, type BadgeTone } from '@shared/components/ui/Badge';
import rippleAnimationData from '@/assets/ripple.lottie.json';

/**
 * Accent variants map directly onto the existing project's semantic
 * color scales (`--color-*` tokens) so light/dark theming works for free.
 */
export type StatisticsCardAccent = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface StatisticsCardProps {
  /** Short label shown in the inset header strip. */
  title: string;
  /** The prominent number/statistic. */
  value: string | number;
  /** Muted supporting line under the value. Defaults to "Since Last Week". */
  description?: string;
  /** Compact change indicator, e.g. "20%". */
  trend?: string;
  /** Arrow direction for the trend badge. */
  trendDirection?: 'up' | 'down';
  /** Semantic meaning of the trend; drives badge tone. */
  trendType?: 'positive' | 'negative' | 'neutral';
  /** Leading icon rendered in the header strip. */
  icon: ReactNode;
  /** Optional decorative illustration/icon shown on the right of the header. */
  illustration?: ReactNode;
  /** When true, renders the card surface as transparent. */
  transparent?: boolean;
  /** When true, the card border is always tinted with the accent colour instead of neutral surface. */
  alwaysShowBorder?: boolean;
  /** Optional decorative vector illustration rendered as a low-opacity background. */
  backgroundImage?: string;
  /** Corner anchoring for the background illustration. Defaults to "bottom-right". */
  backgroundPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'top';
  className?: string;
  /** Existing project accent variant. Defaults to "brand". */
  accent?: StatisticsCardAccent;
}

const accentClasses: Record<StatisticsCardAccent, string> = {
  brand: 'bg-brand-500/10 text-brand-700 dark:text-brand-300',
  success: 'bg-success-500/10 text-success-700 dark:text-success-300',
  warning: 'bg-warning-500/10 text-warning-700 dark:text-warning-300',
  danger: 'bg-danger-500/10 text-danger-700 dark:text-danger-300',
  info: 'bg-info-500/10 text-info-700 dark:text-info-300',
  neutral: 'bg-surface-800/70 text-surface-300 dark:text-surface-400',
};

const accentInteractionClasses: Record<StatisticsCardAccent, string> = {
  brand: 'hover:border-brand-500/40 hover:shadow-lg hover:shadow-brand-500/20 focus-visible:ring-brand-500/40',
  success: 'hover:border-success-500/40 hover:shadow-lg hover:shadow-success-500/20 focus-visible:ring-success-500/40',
  warning: 'hover:border-warning-500/40 hover:shadow-lg hover:shadow-warning-500/20 focus-visible:ring-warning-500/40',
  danger: 'hover:border-danger-500/60 hover:shadow-lg hover:shadow-danger-500/30 focus-visible:ring-danger-500/40',
  info: 'hover:border-info-500/40 hover:shadow-lg hover:shadow-info-500/20 focus-visible:ring-info-500/40',
  neutral: 'hover:border-surface-700 hover:shadow-lg hover:shadow-surface-900/20 focus-visible:ring-surface-400/40',
};

const accentFillClasses: Record<StatisticsCardAccent, string> = {
  brand: 'bg-gradient-to-t from-brand-500/25 via-brand-500/5 to-transparent',
  success: 'bg-gradient-to-t from-success-500/25 via-success-500/5 to-transparent',
  warning: 'bg-gradient-to-t from-warning-500/25 via-warning-500/5 to-transparent',
  danger: 'bg-gradient-to-t from-danger-500/25 via-danger-500/5 to-transparent',
  info: 'bg-gradient-to-t from-info-500/25 via-info-500/5 to-transparent',
  neutral: 'bg-gradient-to-t from-surface-700/25 via-surface-700/5 to-transparent',
};

const accentBorderClasses: Record<StatisticsCardAccent, string> = {
  brand: 'border-brand-500/30',
  success: 'border-success-500/30',
  warning: 'border-warning-500/30',
  danger: 'border-danger-500/60',
  info: 'border-info-500/30',
  neutral: 'border-surface-800',
};

const backgroundPositionClasses: Record<
  NonNullable<StatisticsCardProps['backgroundPosition']>,
  string
> = {
  'bottom-right': '-right-2 bottom-0',
  'bottom-left': '-left-2 bottom-0',
  'top-right': '-right-2 top-0',
  'top-left': '-left-2 top-0',
  top: 'inset-x-0 -top-1',
};

const trendToneByType: Record<NonNullable<StatisticsCardProps['trendType']>, BadgeTone> = {
  positive: 'success',
  negative: 'danger',
  neutral: 'neutral',
};

/**
 * StatisticsCard — standalone, reusable statistic tile.
 *
 * Layout: inset accent header strip (icon + title) on top, a large
 * statistic value underneath, and a muted description row with an
 * optional trend badge on the right.
 */
export function StatisticsCard({
  title,
  value,
  description = 'Since Last Week',
  trend,
  trendDirection = 'up',
  trendType,
  icon,
  illustration,
  transparent,
  alwaysShowBorder,
  backgroundImage,
  backgroundPosition = 'bottom-right',
  className,
  accent = 'brand',
}: StatisticsCardProps) {
  const resolvedTrendType: NonNullable<StatisticsCardProps['trendType']> =
    trendType ?? (trendDirection === 'down' ? 'negative' : 'positive');
  const TrendIcon = trendDirection === 'down' ? ArrowDown : ArrowUp;

  // Continuous attention ripple — mounted only for the danger (Overdue) accent.
  const rippleRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (accent !== 'danger') return;
    const container = rippleRef.current;
    if (!container) return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    let animation: ReturnType<typeof lottie.loadAnimation> | null = null;
    const start = () => {
      if (animation) return;
      animation = lottie.loadAnimation({
        container,
        renderer: 'svg',
        loop: true,
        autoplay: true,
        animationData: rippleAnimationData,
      });
    };
    const stop = () => {
      animation?.destroy();
      animation = null;
    };
    const handleMotionChange = (event: MediaQueryListEvent) => (event.matches ? stop() : start());

    if (!mediaQuery.matches) start();
    mediaQuery.addEventListener('change', handleMotionChange);

    return () => {
      mediaQuery.removeEventListener('change', handleMotionChange);
      stop();
    };
  }, [accent]);

  return (
    <div
      className={cn(
        'w-full rounded-2xl p-3 sm:p-4 transition-all duration-200 ease-snappy group relative overflow-hidden',
        'hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:animate-none',
        'focus-visible:outline-none focus-visible:ring-2',
        accent === 'danger'
          ? 'border border-danger-500/60 shadow-md shadow-danger-500/25 ring-1 ring-danger-500/20 animate-danger-blink'
          : alwaysShowBorder
            ? cn('border shadow-sm', accentBorderClasses[accent])
            : 'border border-surface-800 shadow-sm',
        transparent ? 'bg-transparent' : 'bg-surface-900',
        accentInteractionClasses[accent],
        className,
      )}
    >
      {/* Accent fill that pours up from the bottom on hover */}
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-0 translate-y-full transition-transform duration-500 ease-out group-hover:translate-y-0 motion-reduce:transition-none',
          accentFillClasses[accent],
        )}
      />

      {/* Continuous ripple attention effect (danger/Overdue only) */}
      {accent === 'danger' && (
        <div
          ref={rippleRef}
          aria-hidden="true"
          className="statistics-card-ripple pointer-events-none absolute inset-0 opacity-40"
        />
      )}

      {/* Decorative vector illustration as card background */}
      {backgroundImage && (
        <img
          src={backgroundImage}
          alt=""
          aria-hidden="true"
          loading="lazy"
          draggable={false}
          className={cn(
            'pointer-events-none absolute z-0 h-20 w-auto max-w-[55%] object-contain',
            backgroundPositionClasses[backgroundPosition],
            'opacity-25 dark:opacity-[0.18] select-none transition-opacity duration-300',
          )}
        />
      )}

      {/* Inset header strip */}
      <div className={cn('relative z-10 flex items-center gap-2 rounded-xl px-2.5 py-2', accentClasses[accent])}>
        {icon}
        <span className="text-sm font-bold tracking-tight">{title}</span>
        {illustration && <span className="ml-auto opacity-70">{illustration}</span>}
      </div>

      {/* Stat value */}
      <p className="relative z-10 mt-2 text-2xl sm:text-3xl font-display font-extrabold leading-none text-surface-50">
        {value}
      </p>

      {/* Description + trend row */}
      {(description || trend) && (
        <div className="relative z-10 mt-2 flex items-center justify-between gap-3">
          <p className="text-sm text-surface-400">{description}</p>
          {trend && (
            <Badge tone={trendToneByType[resolvedTrendType]} icon={<TrendIcon size={12} />}>
              {trend}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
