import type { Feature, Sprint, CollaborativeTask } from '@collab/types/collaboration';

// EEP2-P4.3.1 (DDS §10): pure client-side Sprint planning selectors.
//
// Units mirror the P4.2.x server (routes/sprints.js `GET /:id/stats` +
// utils/sprintMetrics.js): every estimate is hours. `capacityHours` is the
// plan budget (0 = uncapped); load = Σ estimatedHours of planned work items
// (Features + Tasks carrying the sprint's sprintRef); velocity = Σ
// estimatedHours of completed items ONLY (done Features + done Tasks). The
// selectors are 100% pure — same inputs, same outputs, no Date.now(), no
// store access — so the planning page, the board capacity bar, and the unit
// tests share one source of truth.

export interface SprintCapacity {
  capacityHours: number;
  load: number;
  loadBreakdown: { features: number; tasks: number };
  loadPct: number;
  remainingHours: number;
  overCapacity: boolean;
}

export interface SprintVelocity {
  velocity: number;
  velocityBreakdown: { features: number; tasks: number };
  completedCount: { features: number; tasks: number };
}

function sumHours(items: Array<{ estimatedHours?: number }>): number {
  return items.reduce((acc, item) => acc + (Number(item.estimatedHours) || 0), 0);
}

// The sprint's planned Features, in backlog order. Passing `undefined` yields
// the Project Backlog (features with no sprintRef), which is how the planning
// page derives its un-planned pane.
export function selectSprintFeatures(sprintId: string | undefined, features: Feature[]): Feature[] {
  return features
    .filter((f) => f.sprintId === sprintId)
    .sort((a, b) => a.order - b.order);
}

// Capacity snapshot for a sprint's planned scope. `features`/`tasks` must be the
// sprint's own items (the output of selectSprintFeatures + a sprintId task
// filter); mirroring computeSprintStats, the selector does no re-filtering.
export function selectSprintCapacity(
  sprint: Pick<Sprint, 'capacityHours'> | null | undefined,
  features: Feature[],
  tasks: CollaborativeTask[],
): SprintCapacity {
  const capacityHours = Number(sprint?.capacityHours) || 0;
  const featureHours = sumHours(features);
  const taskHours = sumHours(tasks);
  const load = featureHours + taskHours;
  return {
    capacityHours,
    load,
    loadBreakdown: { features: featureHours, tasks: taskHours },
    loadPct: capacityHours > 0 ? Math.round((load / capacityHours) * 100) : 0,
    remainingHours: Math.max(0, capacityHours - load),
    overCapacity: capacityHours > 0 && load > capacityHours,
  };
}

// Completed-only velocity (DDS §10 / EEP2-P4.2.3): done Features + done Tasks.
export function selectSprintVelocity(features: Feature[], tasks: CollaborativeTask[]): SprintVelocity {
  const doneFeatures = features.filter((f) => f.status === 'done');
  const doneTasks = tasks.filter((t) => t.sprintStatus === 'done');
  const featureHours = sumHours(doneFeatures);
  const taskHours = sumHours(doneTasks);
  return {
    velocity: featureHours + taskHours,
    velocityBreakdown: { features: featureHours, tasks: taskHours },
    completedCount: { features: doneFeatures.length, tasks: doneTasks.length },
  };
}

// Headroom before the sprint's capacity budget is exhausted (clamped ≥ 0).
export function selectSprintRemaining(
  sprint: Pick<Sprint, 'capacityHours'> | null | undefined,
  features: Feature[],
  tasks: CollaborativeTask[],
): number {
  return selectSprintCapacity(sprint, features, tasks).remainingHours;
}

// The sprint whose time-box covers `date` (inclusive both ends), or null.
// Accepts an ISO date string or a Date; comparison is on the YYYY-MM-DD slice
// so time-of-day never bleeds into the boundary check.
export function selectSprintByDate(sprints: Sprint[], date: string | Date): Sprint | null {
  const target = date instanceof Date ? date.toISOString().slice(0, 10) : String(date).slice(0, 10);
  return sprints.find((s) => s.startDate <= target && target <= s.endDate) ?? null;
}
