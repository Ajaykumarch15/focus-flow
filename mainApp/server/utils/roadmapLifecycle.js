/**
 * B8 · Basic Roadmap status lifecycle.
 *
 * Sensible transition rules per level + completion cascades.
 *
 * Rules:
 *  - Same-value status patches are always no-ops (allowed).
 *  - Completing a Roadmap completes its remaining Phases and Milestones so
 *    stored status never contradicts derived progress (which hits 100%).
 *    Tasks are NEVER mutated by roadmap operations - that contract predates
 *    B8 and stays intact.
 *  - Completing a Phase completes its remaining Milestones (siblings and the
 *    parent Roadmap are untouched).
 *  - Leaving `completed` does not auto-reopen children; users reopen
 *    explicitly. Paused/archived mutate nothing.
 */
'use strict';

const ROADMAP_TRANSITIONS = {
  planning: ['active', 'paused', 'archived'],
  active: ['completed', 'paused', 'archived'],
  paused: ['active', 'completed', 'archived'],
  completed: ['active', 'archived'],
  archived: ['active'],
};

const PHASE_TRANSITIONS = {
  upcoming: ['active', 'paused'],
  active: ['completed', 'paused', 'upcoming'],
  paused: ['active', 'upcoming'],
  completed: ['active'],
};

const MILESTONE_TRANSITIONS = {
  todo: ['in-progress', 'completed'],
  'in-progress': ['todo', 'completed'],
  completed: ['todo', 'in-progress'],
};

function canTransition(transitions, from, to) {
  if (!to || to === from) return true;
  const allowed = transitions[from];
  return Array.isArray(allowed) ? allowed.includes(to) : false;
}

/**
 * Cascade completion down the hierarchy (never touches Tasks).
 * Returns the raw updateMany results so callers/tests can assert scope.
 */
async function completeChildrenForRoadmap(RoadmapPhase, RoadmapMilestone, roadmapId, userId) {
  const [phases, milestones] = await Promise.all([
    RoadmapPhase.updateMany(
      { roadmapId, userId, status: { $ne: 'completed' } },
      { $set: { status: 'completed' } },
    ),
    RoadmapMilestone.updateMany(
      { roadmapId, userId, status: { $ne: 'completed' } },
      { $set: { status: 'completed' } },
    ),
  ]);
  return { phasesUpdated: phases.modifiedCount || 0, milestonesUpdated: milestones.modifiedCount || 0 };
}

async function completeMilestonesForPhase(RoadmapMilestone, phaseId, userId) {
  const res = await RoadmapMilestone.updateMany(
    { phaseId, userId, status: { $ne: 'completed' } },
    { $set: { status: 'completed' } },
  );
  return { milestonesUpdated: res.modifiedCount || 0 };
}

module.exports = {
  ROADMAP_TRANSITIONS,
  PHASE_TRANSITIONS,
  MILESTONE_TRANSITIONS,
  canTransition,
  completeChildrenForRoadmap,
  completeMilestonesForPhase,
};
