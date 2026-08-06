// EEP2-P4.2.2/P4.2.3 (DDS §10): capacity and velocity math for Sprint planning.
//
// Capacity: the plan budget is `capacityHours` (a sprint with capacityHours = 0
// is uncapped). Planned load = Σ estimatedHours of assigned work items —
// Features and Tasks carrying the sprint's sprintRef. `targetVelocity` is the
// planning target, not the budget.
//
// Velocity: Σ estimatedHours of completed items only — Features with
// status 'done' plus Tasks with sprintStatus 'done' ("completed story
// points/days", EEP_V2 Phase 4 summaryStats).
//
// All helpers are pure so they can be unit-tested without a database.

function sumEstimated(items = []) {
  return items.reduce((acc, item) => acc + (Number(item.estimatedHours) || 0), 0);
}

function computeSprintLoad(features = [], tasks = []) {
  const featureHours = sumEstimated(features);
  const taskHours = sumEstimated(tasks);
  return { featureHours, taskHours, total: featureHours + taskHours };
}

function computeSprintStats({ sprint, features = [], tasks = [] }) {
  const load = computeSprintLoad(features, tasks);
  const capacityHours = Number(sprint && sprint.capacityHours) || 0;
  const targetVelocity = Number(sprint && sprint.targetVelocity) || 0;
  const doneFeatures = features.filter((f) => f.status === 'done');
  const doneTasks = tasks.filter((t) => t.sprintStatus === 'done');
  const velocity = sumEstimated(doneFeatures) + sumEstimated(doneTasks);
  return {
    sprintId: sprint ? String(sprint._id) : null,
    capacityHours,
    targetVelocity,
    load: load.total,
    loadBreakdown: { features: load.featureHours, tasks: load.taskHours },
    loadPct: capacityHours > 0 ? Math.round((load.total / capacityHours) * 100) : 0,
    remainingHours: Math.max(0, capacityHours - load.total),
    overCapacity: capacityHours > 0 && load.total > capacityHours,
    velocity,
    velocityBreakdown: { features: sumEstimated(doneFeatures), tasks: sumEstimated(doneTasks) },
    completedCount: { features: doneFeatures.length, tasks: doneTasks.length },
  };
}

// Capacity guard — returns null (allowed) or `{ status: 409, message }`. Only
// enforced when the sprint has a positive capacityHours budget; `incomingHours`
// is the estimate of the item being planned into (or left in) the sprint.
function assertWithinCapacity({ sprint, features = [], tasks = [], incomingHours = 0 }) {
  const capacityHours = Number(sprint && sprint.capacityHours) || 0;
  if (capacityHours <= 0) return null;
  const load = computeSprintLoad(features, tasks).total;
  const incoming = Number(incomingHours) || 0;
  const projected = load + incoming;
  if (projected > capacityHours) {
    return {
      status: 409,
      message: `Planned ${projected}h exceeds the ${capacityHours}h sprint capacity (planned ${load}h + incoming ${incoming}h)`,
    };
  }
  return null;
}

module.exports = { sumEstimated, computeSprintLoad, computeSprintStats, assertWithinCapacity };
