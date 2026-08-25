/**
 * B7 · Basic Roadmap progress engine (V1).
 *
 * Single source of truth for progress math across the roadmap hierarchy:
 *   Task completion -> Milestone progress -> Phase progress -> Roadmap progress.
 *
 * V1 is strictly unweighted ratio math. No mastery, competency, learning
 * scores, weighting, or adaptivity belongs here.
 *
 * Empty denominators return null so callers can distinguish "nothing linked
 * yet" (explicit state) from a real measured 0% - never fabricate 100%.
 */
'use strict';

function pct(done, total) {
  if (!Number.isFinite(total) || total <= 0) return null;
  const d = Number.isFinite(Number(done)) ? Number(done) : 0;
  const value = Math.round((d / total) * 100);
  return Math.max(0, Math.min(100, value));
}

/** Milestone progress from its linked Tasks. */
function milestoneProgress(completedTasks, totalTasks) {
  return pct(completedTasks, totalTasks);
}

/** Phase progress from its Milestones. */
function phaseProgress(completedMilestones, totalMilestones) {
  return pct(completedMilestones, totalMilestones);
}

/** Roadmap progress from its Milestones (existing FocusFlow behavior). */
function roadmapProgress(completedMilestones, totalMilestones) {
  return pct(completedMilestones, totalMilestones);
}

/**
 * Serializer helper: keeps the numeric API contract (`progress: number`)
 * while exposing emptiness explicitly via `progressEmpty`.
 */
function serializeProgress(p) {
  return { progress: p === null ? 0 : p, progressEmpty: p === null };
}

module.exports = { pct, milestoneProgress, phaseProgress, roadmapProgress, serializeProgress };
