const RoadmapMilestone = require('../models/RoadmapMilestone');
const RoadmapPhase = require('../models/RoadmapPhase');
const Roadmap = require('../models/Roadmap');
const Task = require('../models/Task');

/**
 * After a task status change, cascade auto-updates:
 * 1. Milestone → in-progress when any linked task leaves 'todo'
 * 2. Milestone → completed when ALL linked tasks are completed
 * 3. Milestone → in-progress when tasks are un-completed from a completed milestone
 * 4. Phase → active when first milestone becomes active
 * 5. Phase → completed when ALL milestones are completed
 */
async function cascadeTaskStatusChange(task) {
  if (!task.milestoneRef) return;

  try {
    const milestone = await RoadmapMilestone.findById(task.milestoneRef);
    if (!milestone) return;

    // ── Milestone auto-status ──
    const milestoneTasks = await Task.find({ milestoneRef: milestone._id, userId: task.userId });
    const allCompleted = milestoneTasks.length > 0 && milestoneTasks.every(t => t.status === 'completed');
    const anyNonTodo = milestoneTasks.some(t => t.status !== 'todo');

    let milestoneChanged = false;
    if (allCompleted && milestone.status !== 'completed') {
      milestone.status = 'completed';
      milestoneChanged = true;
    } else if (anyNonTodo && milestone.status === 'todo') {
      milestone.status = 'in-progress';
      milestoneChanged = true;
    } else if (!allCompleted && !anyNonTodo && milestone.status === 'in-progress') {
      milestone.status = 'todo';
      milestoneChanged = true;
    } else if (!allCompleted && milestone.status === 'completed') {
      milestone.status = 'in-progress';
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
    } else if (!allMsCompleted && phase.status === 'completed') {
      // Milestones un-completed — revert phase to active
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

    // ── Roadmap auto-completion: when all phases are completed ──
    const roadmap = await Roadmap.findById(phase.roadmapId);
    if (roadmap) {
      const allPhases = await RoadmapPhase.find({ roadmapId: phase.roadmapId, userId: task.userId });
      const allPhasesCompleted = allPhases.length > 0 && allPhases.every(p => p.status === 'completed');
      const anyPhaseActive = allPhases.some(p => p.status === 'active' || p.status === 'completed');

      if (allPhasesCompleted && roadmap.status !== 'completed') {
        roadmap.status = 'completed';
        await roadmap.save();
      } else if (!allPhasesCompleted && roadmap.status === 'completed') {
        // Phases un-completed — revert roadmap to active
        roadmap.status = 'active';
        await roadmap.save();
      } else if (anyPhaseActive && roadmap.status === 'planning') {
        roadmap.status = 'active';
        await roadmap.save();
      }
    }
  } catch (err) {
    // Silently fail — don't break the task update for auto-status issues
    console.error('cascadeTaskStatusChange error:', err.message);
  }
}

module.exports = { cascadeTaskStatusChange };
