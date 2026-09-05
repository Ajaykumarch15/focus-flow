// B8 · Status lifecycle (frontend mirror of server/utils/roadmapLifecycle.js).
// Components must derive selectable statuses from here - never hand-roll.
import type { RoadmapStatus, RoadmapPhaseStatus, RoadmapMilestoneStatus } from '../types/roadmap';

export const ROADMAP_TRANSITIONS: Record<RoadmapStatus, RoadmapStatus[]> = {
  planning: ['active', 'paused', 'archived'],
  active: ['completed', 'paused', 'archived'],
  paused: ['active', 'completed', 'archived'],
  completed: ['active', 'archived'],
  archived: ['active'],
};

export const PHASE_TRANSITIONS: Record<RoadmapPhaseStatus, RoadmapPhaseStatus[]> = {
  upcoming: ['active', 'paused'],
  active: ['completed', 'paused', 'upcoming'],
  paused: ['active', 'upcoming'],
  completed: ['active'],
};

export const MILESTONE_TRANSITIONS: Record<RoadmapMilestoneStatus, RoadmapMilestoneStatus[]> = {
  todo: ['in-progress', 'completed'],
  'in-progress': ['todo', 'completed'],
  completed: ['todo', 'in-progress'],
};

/** Statuses the user may pick from `current` (including staying put). */
export function nextRoadmapStatuses(current: RoadmapStatus): RoadmapStatus[] {
  return [current, ...ROADMAP_TRANSITIONS[current]];
}

export function nextPhaseStatuses(current: RoadmapPhaseStatus): RoadmapPhaseStatus[] {
  return [current, ...PHASE_TRANSITIONS[current]];
}

export function nextMilestoneStatuses(current: RoadmapMilestoneStatus): RoadmapMilestoneStatus[] {
  return [current, ...MILESTONE_TRANSITIONS[current]];
}
