import type { CollaborativeTask } from '../types/collaboration';

// ── S4-T2: single computed source for shared collaboration KPIs ─────────────
// ECIS B.9 / IA §6: "One KPI per page; helpers reused". Mission Control and
// Project Reports both surface sprint velocity, and Reports/Features surface
// completion, so the math lives here (R3/R5) and every page imports it instead
// of re-implementing it. 100% pure — same inputs always produce the same result.

// IES-R1 (P6-T5): the server persists capacity/target velocity but NOT an
// `actualVelocity`, so delivered velocity is derived from live task data:
// committed effort (`estimatedHours`) delivered across `done` tasks. The raw
// `delivered` figure is the same number Mission Control shows; `pct` compares
// it against the sprint target (null when no target — never a fabricated 0%).
export function computeVelocity(
  tasks: Pick<CollaborativeTask, 'sprintStatus' | 'estimatedHours'>[],
  targetVelocity: number,
): { delivered: number; pct: number | null } {
  const delivered = tasks
    .filter((t) => t.sprintStatus === 'done')
    .reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
  return {
    delivered,
    pct: targetVelocity > 0 ? Math.round((delivered / targetVelocity) * 100) : null,
  };
}

// IES-P1-20: an empty feature set is not a 100% completion rate — it's "no data".
// Returns null so callers can render an explicit empty state instead of a
// fabricated metric. Accepts either a Feature (`status`) or a CollaborativeTask
// (`sprintStatus`) shape so the same KPI works over both live collections.
export function computeFeatureCompletionRate(items: { sprintStatus?: string; status?: string }[]): number | null {
  if (items.length === 0) return null;
  const isDone = (i: { sprintStatus?: string; status?: string }) =>
    i.status === 'done' || i.sprintStatus === 'done';
  const completed = items.filter(isDone).length;
  return Math.round((completed / items.length) * 100);
}
