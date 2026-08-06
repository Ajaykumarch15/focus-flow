import type { RoadmapMilestone, RoadmapPhase, RoadmapStatus } from '../types/collaboration';

// EEP2-P3.4.1 / DDS §9: pure Roadmap selectors — the ordered Milestone spine,
// progress rollups (Feature → Module → Phase → Milestone), and date bucketing.
// The server already sorts by `order, targetDate, createdAt`; these are the
// client-side equivalents so components and unit tests share one source of truth.

export interface ProgressRollup {
  done: number;
  total: number;
  pct: number;
}

const NEVER = '9999-12-31';

// Roadmap ordering: `order` asc, then `targetDate` asc (undated last), then
// `createdAt` as the stable tiebreaker (DDS §9).
export function selectRoadmapOrdered(milestones: RoadmapMilestone[]): RoadmapMilestone[] {
  return [...milestones].sort((a, b) => {
    const orderDelta = (a.order ?? 0) - (b.order ?? 0);
    if (orderDelta !== 0) return orderDelta;
    const dateDelta = (a.targetDate ?? NEVER).localeCompare(b.targetDate ?? NEVER);
    if (dateDelta !== 0) return dateDelta;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

// A Milestone's progress is derived from its Phases (single source, DDS §9):
// done = Phases with status `completed`; `pct` = 0 when the Milestone has no
// Phases yet (pages show an honest "No phases yet" off a total of 0).
export function selectMilestoneProgress(milestone: RoadmapMilestone, phases: RoadmapPhase[]): ProgressRollup {
  const owned = phases.filter((p) => p.milestoneId === milestone.id);
  const total = owned.length;
  const done = owned.filter((p) => p.status === 'completed').length;
  return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
}

// Mirror of selectMilestoneProgress one level down: a Phase's progress is
// derived from its Modules.
export function selectPhaseProgress(phase: RoadmapPhase, modules: { phaseId: string; status: RoadmapStatus }[]): ProgressRollup {
  const owned = modules.filter((m) => m.phaseId === phase.id);
  const total = owned.length;
  const done = owned.filter((m) => m.status === 'completed').length;
  return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
}

// Bucket the Roadmap by `targetDate` for the timeline view (DDS §9: dates +
// progress bars). Dated buckets sort chronologically; the undated bucket (null)
// sorts last. Each bucket keeps Roadmap ordering inside.
export function selectMilestonesByDate(
  milestones: RoadmapMilestone[],
): { targetDate: string | null; items: RoadmapMilestone[] }[] {
  const buckets = new Map<string | null, RoadmapMilestone[]>();
  for (const m of milestones) {
    const key = m.targetDate;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(m);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => {
      if (a === null) return 1;
      if (b === null) return -1;
      return a.localeCompare(b);
    })
    .map(([targetDate, items]) => ({ targetDate, items: selectRoadmapOrdered(items) }));
}
