const RoadmapMilestone = require('../models/RoadmapMilestone');
const RoadmapPhase = require('../models/RoadmapPhase');
const Task = require('../models/Task');

/**
 * After a task status change, cascade auto-updates:
 * 1. Milestone → in-progress when any linked task becomes active
 * 2. Milestone → completed when ALL linked tasks are completed
 * 3. Phase → active when first milestone becomes active
 * 4. Phase → completed when ALL milestones are completed
 */
async function cascadeTaskStatusChange(task) {
  if (!task.milestoneRef) return;

  try {
    const milestone = await RoadmapMilestone.findById(task.milestoneRef);
    if (!milestone) return;

    // ── Milestone auto-status ──
    const milestoneTasks = await Task.find({ milestoneRef: milestone._id, userId: task.userId });
    const allCompleted = milestoneTasks.length > 0 && milestoneTasks.every(t => t.status === 'completed');
    const anyActive = milestoneTasks.some(t => t.status === 'active' || t.status === 'paused');

    let milestoneChanged = false;
    if (allCompleted && milestone.status !== 'completed') {
      milestone.status = 'completed';
      milestoneChanged = true;
    } else if (anyActive && milestone.status === 'todo') {
      milestone.status = 'in-progress';
      milestoneChanged = true;
    } else if (!allCompleted && !anyActive && milestone.status === 'in-progress') {
      // All tasks are todo again (e.g., uncompleted) — reset to todo
      milestone.status = 'todo';
      milestoneChanged = true;
    }

    if (milestoneChanged) {
      await milestone.save();
    }

    // ── Phase auto-status ──
    const phase = await RoadmapPhase.findById(milestone.phaseId);
    if (!phase) return;

    const phaseMilestones = await RoadmapMilestone.find({ phaseId: phase._id, userId: task.userId });
    const allMsCompleted = phaseMilestones.length > 0 && phaseMilestones.every(m => m.status === 'completed');
    const anyMsActive = phaseMilestones.some(m => m.status === 'in-progress' || m.status === 'completed');

    let phaseChanged = false;
    if (allMsCompleted && phase.status !== 'completed') {
      phase.status = 'completed';
      phaseChanged = true;
    } else if (anyMsActive && phase.status === 'upcoming') {
      phase.status = 'active';
      phaseChanged = true;
    }

    if (phaseChanged) {
      await phase.save();
    }

    // ── Phase auto-progression: when a phase completes, activate the next ──
    if (phase.status === 'completed') {
      const allPhases = await RoadmapPhase.find({ roadmapId: phase.roadmapId, userId: task.userId }).sort({ order: 1 });
      const currentIdx = allPhases.findIndex(p => String(p._id) === String(phase._id));
      if (currentIdx >= 0 && currentIdx < allPhases.length - 1) {
        const nextPhase = allPhases[currentIdx + 1];
        if (nextPhase.status === 'upcoming') {
          nextPhase.status = 'active';
          await nextPhase.save();
        }
      }
    }
  } catch (err) {
    // Silently fail — don't break the task update for auto-status issues
    console.error('cascadeTaskStatusChange error:', err.message);
  }
}

module.exports = { cascadeTaskStatusChange };
