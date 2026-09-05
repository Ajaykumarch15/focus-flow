// B7 · Basic Roadmap progress engine (frontend side).
//
// Single source of truth for every progress formula used by roadmap UI.
// React components must import from here - never re-implement the math.
// V1 is strictly unweighted; no mastery/competency/scores.
import type { RoadmapListItem } from '../types/roadmap';

/** Coerce any API progress value into a clean 0..100 integer. */
export function safeProgress(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(100, Math.round(n));
}

/**
 * Explicit empty state: a denominator of 0 means "nothing linked yet",
 * which must not be presented as a real measured percentage.
 */
export function hasData(count?: number | null): boolean {
  return typeof count === 'number' && Number.isFinite(count) && count > 0;
}

/**
 * Display helper: em-dash for empty states, "N%" otherwise.
 */
export function formatProgress(percent: unknown, total?: number | null): string {
  if (!hasData(total)) return '—';
  return `${safeProgress(percent)}%`;
}

export type HealthTone = 'success' | 'warning' | 'danger' | 'neutral';

export interface ListHealth {
  label: string;
  tone: HealthTone;
}

// B10 · Single health core. Compares ACTUAL progress against the progress
// "expected" from elapsed roadmap time. Phase/milestone names are irrelevant
// by construction - only numbers and dates enter the math.
//
// Audited B10 semantics (thresholds ±10 / ±25 preserved):
//  - completed status OR progress >= 100 -> Completed (never schedule-shamed)
//  - archived / paused -> static states, no live schedule pressure
//  - no target date    -> On Track (nothing to fall behind on)
//  - before start date -> On Track (explicitly handled, was implicit before)
//  - expired           -> Behind regardless of remaining progress
//  - FIX: `progress === 0` no longer force-reports On Track mid-schedule.
export interface RoadmapHealthInput {
  status?: string | null;
  progress: number;
  startDate?: string | null;
  targetDate?: string | null;
  createdAt?: string | null;
}

export interface RoadmapHealth {
  label: string;
  tone: HealthTone;
  description: string;
}

export function computeRoadmapHealth(
  input: RoadmapHealthInput,
  now: number = Date.now(),
): RoadmapHealth {
  const progress = safeProgress(input.progress);
  const status = input.status ?? null;

  if (status === 'completed' || progress >= 100) {
    return { label: 'Completed', tone: 'success', description: 'All milestones are complete.' };
  }
  if (status === 'archived') {
    return { label: 'Archived', tone: 'neutral', description: 'This roadmap is archived.' };
  }
  if (status === 'paused') {
    return { label: 'Paused', tone: 'warning', description: 'Schedule health resumes when this roadmap is active again.' };
  }
  if (!input.targetDate) {
    return { label: 'On Track', tone: 'success', description: 'No target date set — work at your own pace.' };
  }

  const target = new Date(input.targetDate).getTime();
  const startMs = new Date(input.startDate || input.createdAt || new Date(0).toISOString()).getTime();

  if (now < startMs) {
    return { label: 'On Track', tone: 'success', description: 'Has not started yet — nothing is due.' };
  }

  const totalMs = target - startMs;
  if (totalMs <= 0 || now > target) {
    return { label: 'Behind', tone: 'danger', description: 'The target date has passed.' };
  }

  const expectedProgress = Math.min(100, ((now - startMs) / totalMs) * 100);

  if (progress >= expectedProgress - 10) {
    return { label: 'On Track', tone: 'success', description: 'Your current progress is sufficient to reach the target date.' };
  }
  if (progress >= expectedProgress - 25) {
    return { label: 'At Risk', tone: 'warning', description: "You're slightly behind schedule." };
  }
  return { label: 'Behind', tone: 'danger', description: "You're behind schedule." };
}

/** Schedule health for a roadmap list card. */
export function getListHealth(roadmap: RoadmapListItem, now: number = Date.now()): ListHealth {
  const health = computeRoadmapHealth(roadmap, now);
  return { label: health.label, tone: health.tone };
}

const DETAIL_TONE_STYLES: Record<HealthTone, { color: string; className: string }> = {
  success: { color: 'text-emerald-400', className: 'bg-emerald-500/10 border-emerald-500/20' },
  warning: { color: 'text-yellow-400', className: 'bg-yellow-500/10 border-yellow-500/20' },
  danger: { color: 'text-red-400', className: 'bg-red-500/10 border-red-500/20' },
  neutral: { color: 'text-surface-400', className: 'bg-surface-800/60 border-surface-700' },
};

export interface DetailHealth extends RoadmapHealth {
  color: string;
  className: string;
}

/** Richer health for the roadmap detail hero (same core as the card badge). */
export function getDetailHealth(roadmap: RoadmapHealthInput, now: number = Date.now()): DetailHealth {
  const health = computeRoadmapHealth(roadmap, now);
  return { ...health, ...DETAIL_TONE_STYLES[health.tone] };
}

export interface DetailHealth extends RoadmapHealth {
  color: string;
  className: string;
}
