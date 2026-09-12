function generateWarnings(capacityResult, phases) {
  const warnings = [];

  if (capacityResult.isOverloaded) {
    warnings.push({
      type: 'overload',
      severity: 'warning',
      requiredHours: capacityResult.totalTaskHours,
      availableHours: capacityResult.availableHours,
      shortageHours: Math.round((capacityResult.totalTaskHours - capacityResult.availableHours) * 10) / 10,
      message: `Roadmap requires ${capacityResult.totalTaskHours}h but only ${capacityResult.availableHours}h available. Short by ${capacityResult.shortageHours}h.`,
    });
  }

  if (capacityResult.isTight) {
    warnings.push({
      type: 'tight',
      severity: 'info',
      utilization: capacityResult.utilization,
      message: `Schedule is ${capacityResult.utilization}% utilized. Consider adding more buffer time.`,
    });
  }

  if (capacityResult.isOverflow) {
    warnings.push({
      type: 'deadline_conflict',
      severity: 'warning',
      overflowDays: capacityResult.overflowDays,
      lastTaskDeadline: capacityResult.lastTaskDeadline,
      message: `Schedule extends ${capacityResult.overflowDays} day(s) past your deadline. Last task finishes on ${capacityResult.lastTaskDeadline}.`,
    });
  }

  for (const phase of phases) {
    const totalTasks = phase.milestones.reduce((sum, m) => sum + m.tasks.length, 0);
    if (totalTasks === 0) {
      warnings.push({
        type: 'empty_phase',
        severity: 'error',
        phaseId: phase.id,
        phaseTitle: phase.title,
        message: `Phase "${phase.title}" has no tasks. Add topics or remove this phase.`,
      });
    }
  }

  return warnings;
}

module.exports = { generateWarnings };
