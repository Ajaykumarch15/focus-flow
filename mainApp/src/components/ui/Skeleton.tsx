import { CSSProperties } from 'react';

interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
}

/** Base animated placeholder block (GPU-friendly shimmer). */
export function Skeleton({ className = '', style }: SkeletonProps) {
  return <div className={`skeleton ${className}`} style={style} />;
}

/** Placeholder circle (avatar, icon). */
export function SkeletonCircle({ size = 40, className = '' }: { size?: number } & SkeletonProps) {
  return <Skeleton className={`rounded-full flex-shrink-0 ${className}`} style={{ width: size, height: size }} />;
}

/** Placeholder text lines. */
export function SkeletonText({ lines = 3, className = '' }: { lines?: number } & SkeletonProps) {
  return (
    <div className={`space-y-2.5 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-3.5 rounded"
          style={{ width: i === lines - 1 ? '60%' : '100%' }}
        />
      ))}
    </div>
  );
}

/** Stat card skeleton — matches the StatCard pattern used in Dashboard/Analytics/Admin. */
export function SkeletonStatCard({ className = '' }: SkeletonProps) {
  return (
    <div className={`card p-5 relative overflow-hidden ${className}`}>
      <div className="flex items-start justify-between mb-3">
        <Skeleton className="w-9 h-9 rounded-xl" />
      </div>
      <Skeleton className="h-7 w-20 rounded mb-1.5" />
      <Skeleton className="h-3.5 w-16 rounded" />
    </div>
  );
}

/** Generic card skeleton with optional header and content lines. */
export function SkeletonCard({ headerWidth = '40%', lines = 3, className = '' }: {
  headerWidth?: string;
  lines?: number;
} & SkeletonProps) {
  return (
    <div className={`card p-5 ${className}`}>
      {headerWidth && (
        <Skeleton className="h-5 rounded mb-4" style={{ width: headerWidth }} />
      )}
      <SkeletonText lines={lines} />
    </div>
  );
}

/** Task card skeleton — matches TaskCard layout. */
export function SkeletonTaskCard({ className = '' }: SkeletonProps) {
  return (
    <div className={`card p-4 relative overflow-hidden ${className}`}>
      <Skeleton className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" />
      <div className="pl-2">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Skeleton className="h-5 w-14 rounded-lg" />
              <Skeleton className="h-5 w-16 rounded-lg" />
            </div>
            <Skeleton className="h-4 w-3/4 rounded mb-2" />
            <Skeleton className="h-3 w-1/2 rounded" />
          </div>
          <Skeleton className="h-4 w-16 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-16 rounded-lg" />
          <Skeleton className="h-7 w-16 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

/** Chart card skeleton — matches Recharts chart card pattern. */
export function SkeletonChart({ height = 200, className = '' }: { height?: number } & SkeletonProps) {
  return (
    <div className={`card p-4 ${className}`}>
      <Skeleton className="h-5 w-32 rounded mb-4" />
      <Skeleton className="w-full rounded-xl" style={{ height }} />
    </div>
  );
}
