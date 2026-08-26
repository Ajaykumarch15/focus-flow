const mongoose = require('mongoose');
const PersonalRoadmap = require('../models/PersonalRoadmap');
const PersonalRoadmapPhase = require('../models/PersonalRoadmapPhase');
const PersonalRoadmapMilestone = require('../models/PersonalRoadmapMilestone');

/**
 * Validate an optional roadmap/phase/milestone link subset on a PersonalTask
 * before it is written. Uses Personal* models (isolated from worklog roadmaps).
 *
 * @returns {Promise<{ ok: true } | { ok: false, status: number, message: string }>}
 */
async function resolvePersonalRoadmapLink(userId, { roadmapRef, phaseRef, milestoneRef } = {}) {
  const hasAny = Boolean(roadmapRef || phaseRef || milestoneRef);
  if (!hasAny) return { ok: true };

  const badId = (field) => ({ ok: false, status: 404, message: `${field} not found` });

  let roadmap = null;
  let phase = null;
  let milestone = null;

  if (roadmapRef) {
    if (!mongoose.isValidObjectId(roadmapRef)) return badId('Roadmap');
    roadmap = await PersonalRoadmap.findOne({ _id: roadmapRef, userId });
    if (!roadmap) return badId('Roadmap');
  }

  if (phaseRef) {
    if (!mongoose.isValidObjectId(phaseRef)) return badId('Phase');
    phase = await PersonalRoadmapPhase.findOne({ _id: phaseRef, userId });
    if (!phase) return badId('Phase');
    if (roadmap && String(phase.roadmapId) !== String(roadmap._id)) {
      return { ok: false, status: 400, message: 'Phase does not belong to the given roadmap' };
    }
  }

  if (milestoneRef) {
    if (!mongoose.isValidObjectId(milestoneRef)) return badId('Milestone');
    milestone = await PersonalRoadmapMilestone.findOne({ _id: milestoneRef, userId });
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

module.exports = { resolvePersonalRoadmapLink };
