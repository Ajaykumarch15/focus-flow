const mongoose = require('mongoose');
const Roadmap = require('../models/Roadmap');
const RoadmapPhase = require('../models/RoadmapPhase');
const RoadmapMilestone = require('../models/RoadmapMilestone');

/**
 * B2 data-layer integrity: validate an optional roadmap/phase/milestone link
 * subset on a Task before it is written.
 *
 * Guarantees (all scoped to the authenticated user):
 *  - every provided ref exists AND belongs to `userId`
 *  - provided refs are mutually consistent
 *    (milestone.phaseId === phaseId, milestone.roadmapId === roadmapId,
 *     phase.roadmapId === roadmapId)
 *  - malformed ids are treated as "not found", never as cast errors
 *
 * Partial links are legitimate (e.g. a milestone delete clears only
 * milestoneRef), so any consistent subset passes; an empty set short-circuits.
 *
 * @returns {Promise<{ ok: true } | { ok: false, status: number, message: string }>}
 */
async function resolveRoadmapLink(userId, { roadmapRef, phaseRef, milestoneRef } = {}) {
  const hasAny = Boolean(roadmapRef || phaseRef || milestoneRef);
  if (!hasAny) return { ok: true };

  const badId = (field) => ({ ok: false, status: 404, message: `${field} not found` });

  let roadmap = null;
  let phase = null;
  let milestone = null;

  if (roadmapRef) {
    if (!mongoose.isValidObjectId(roadmapRef)) return badId('Roadmap');
    roadmap = await Roadmap.findOne({ _id: roadmapRef, userId });
    if (!roadmap) return badId('Roadmap');
  }

  if (phaseRef) {
    if (!mongoose.isValidObjectId(phaseRef)) return badId('Phase');
    phase = await RoadmapPhase.findOne({ _id: phaseRef, userId });
    if (!phase) return badId('Phase');
    if (roadmap && String(phase.roadmapId) !== String(roadmap._id)) {
      return { ok: false, status: 400, message: 'Phase does not belong to the given roadmap' };
    }
  }

  if (milestoneRef) {
    if (!mongoose.isValidObjectId(milestoneRef)) return badId('Milestone');
    milestone = await RoadmapMilestone.findOne({ _id: milestoneRef, userId });
    if (!milestone) return badId('Milestone');
    if (phase && String(milestone.phaseId) !== String(phase._id)) {
      return { ok: false, status: 400, message: 'Milestone does not belong to the given phase' };
    }
    if (roadmap && String(milestone.roadmapId) !== String(roadmap._id)) {
      return { ok: false, status: 400, message: 'Milestone does not belong to the given roadmap' };
    }
  }

  return { ok: true };
}

module.exports = { resolveRoadmapLink };
