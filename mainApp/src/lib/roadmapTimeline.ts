// B9 · Basic Roadmap timeline math (pure, framework-free).
//
// Single home for the milestone time-axis primitives previously living inside
// components/roadmap/RoadmapTimeline.tsx, now shared by the collaboration
// roadmap AND the personal Basic Roadmap timeline. Dates are 'YYYY-MM-DD'
// strings interpreted as UTC midnight - an undated milestone never gets a
// fabricated position.
import type { RoadmapMilestoneDoc } from '../types/roadmap';

export const DAY_MS = 86_400_000;

/** Anything that can sit on the timeline axis (collab + personal shapes). */
export interface TimelineDated {
  targetDate?: string | null;
  order?: number;
}

export interface TimelineSpan {
  min: number;
  max: number;
}

export interface TimelineTick {
  x: number;
  label: string;
}

export function parseUtc(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getTime();
}

/**
 * Chronological comparator: dated milestones ascending, undated last,
 * stable via `order` tiebreak. Used identically by both timeline UIs.
 */
export function compareByTargetDate<T extends TimelineDated>(a: T, b: T): number {
  const aDate = a.targetDate ?? '9999-12-31';
  const bDate = b.targetDate ?? '9999-12-31';
  const dateDelta = aDate.localeCompare(bDate);
  if (dateDelta !== 0) return dateDelta;
  return (a.order ?? 0) - (b.order ?? 0);
}

/** Dated rows (chronological) and undated rows, never mixed, never dropped. */
export function splitDatedUndated<T extends TimelineDated>(rows: T[]): { dated: T[]; undated: T[] } {
  const sorted = [...rows].sort(compareByTargetDate);
  return {
    dated: sorted.filter(r => !!r.targetDate),
    undated: sorted.filter(r => !r.targetDate),
  };
}

// A degenerate span (single date, or dates within 30 days) is padded by a
// fortnight on each side so the marker reads as a point, not a full-width bar.
export function expandSpan(min: number, max: number): TimelineSpan {
  if (Number.isFinite(min) && Number.isFinite(max) && max - min < DAY_MS * 30) {
    return { min: min - DAY_MS * 15, max: max + DAY_MS * 15 };
  }
  return { min, max };
}

// The visible axis is bounded by the earliest and latest target dates. When no
// milestone is dated there is no axis - only the Undated lane renders.
export function selectTimelineSpan(milestones: TimelineDated[]): TimelineSpan | null {
  const dates = milestones
    .map((m) => m.targetDate)
    .filter((d): d is string => Boolean(d))
    .map(parseUtc);
  if (dates.length === 0) return null;
  return expandSpan(Math.min(...dates), Math.max(...dates));
}

export function selectTimelineTicks(span: TimelineSpan, count = 5): TimelineTick[] {
  const ticks: TimelineTick[] = [];
  for (let i = 0; i < count; i++) {
    const t = span.min + ((span.max - span.min) * i) / (count - 1);
    ticks.push({
      x: (i / (count - 1)) * 100,
      label: new Date(t).toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
    });
  }
  return ticks;
}

// Horizontal position (0-100) of a milestone's target date on the axis, or null
// when the milestone has no date (honest `-`, never a fabricated placement).
export function milestoneAxisX(milestone: TimelineDated, span: TimelineSpan): number | null {
  if (!milestone.targetDate) return null;
  if (span.max === span.min) return 50;
  return ((parseUtc(milestone.targetDate) - span.min) / (span.max - span.min)) * 100;
}

/**
 * Position of "today" on the axis, or null when today falls outside the span
 * (the marker must not pretend the range extends to now).
 * Accepts a UTC 'YYYY-MM-DD' key to stay deterministic in tests/UI.
 */
export function todayAxisX(todayKey: string, span: TimelineSpan): number | null {
  const now = parseUtc(todayKey);
  if (now < span.min || now > span.max || span.max === span.min) return null;
  return ((now - span.min) / (span.max - span.min)) * 100;
}

/** Convenience for callers holding personal milestone docs. */
export function sortMilestonesChronologically(milestones: RoadmapMilestoneDoc[]): RoadmapMilestoneDoc[] {
  return [...milestones].sort(compareByTargetDate);
}
