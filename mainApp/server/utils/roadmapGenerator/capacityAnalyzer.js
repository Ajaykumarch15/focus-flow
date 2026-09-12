function analyzeCapacity(flatTasks, input, overflowDays) {
  const totalTaskHours = flatTasks.reduce((sum, t) => sum + t.estimatedHours, 0);

  const { startDate, deadline } = input.project;
  const { workingDays, hoursPerDay, bufferDays } = input.schedule;

  const effectiveEnd = addDays(deadline, -bufferDays);
  const workingDaysCount = countWorkingDays(startDate, effectiveEnd, workingDays);
  const availableHours = workingDaysCount * hoursPerDay;

  const utilization = availableHours > 0 ? (totalTaskHours / availableHours) * 100 : 100;

  const lastTaskDeadline = flatTasks.length > 0
    ? flatTasks.reduce((latest, t) => (t.deadline && t.deadline > latest ? t.deadline : latest), '')
    : '';

  return {
    totalTaskHours: Math.round(totalTaskHours * 100) / 100,
    availableHours: Math.round(availableHours * 100) / 100,
    utilization: Math.round(utilization * 10) / 10,
    workingDaysCount,
    overflowDays: overflowDays || 0,
    isOverloaded: totalTaskHours > availableHours,
    isTight: utilization > 90 && utilization <= 100,
    isOverflow: overflowDays > 0,
    lastTaskDeadline,
  };
}

function countWorkingDays(startDate, endDate, workingDays) {
  const daySet = new Set(workingDays);
  const dayNameMap = {
    0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday',
    4: 'Thursday', 5: 'Friday', 6: 'Saturday',
  };
  let count = 0;
  const current = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  while (current <= end) {
    if (daySet.has(dayNameMap[current.getUTCDay()])) count++;
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return count;
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

module.exports = { analyzeCapacity };
