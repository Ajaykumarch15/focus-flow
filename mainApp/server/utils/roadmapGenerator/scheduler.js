function buildWorkingDayCalendar(startDate, endDate, workingDays) {
  const days = [];
  const daySet = new Set(workingDays);
  const dayNameMap = {
    0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday',
    4: 'Thursday', 5: 'Friday', 6: 'Saturday',
  };

  const current = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');

  while (current <= end) {
    const dayName = dayNameMap[current.getUTCDay()];
    if (daySet.has(dayName)) {
      days.push(current.toISOString().slice(0, 10));
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return days;
}

function daysBetween(dateStr1, dateStr2) {
  const d1 = new Date(dateStr1 + 'T00:00:00Z');
  const d2 = new Date(dateStr2 + 'T00:00:00Z');
  return Math.round((d2 - d1) / 86400000);
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function scheduleTasks(flatTasks, input) {
  const { startDate, deadline } = input.project;
  const { workingDays, hoursPerDay, bufferDays } = input.schedule;

  const effectiveEnd = addDays(deadline, -bufferDays);
  const workingDaysList = buildWorkingDayCalendar(startDate, effectiveEnd, workingDays);

  if (workingDaysList.length === 0) {
    return { flatTasks, overflow: true, overflowDays: 0 };
  }

  let currentDayIndex = 0;
  let hoursUsedToday = 0;
  let overflow = false;

  for (const task of flatTasks) {
    if (task.dependencies.length > 0) {
      let latestDepDeadline = null;
      for (const depId of task.dependencies) {
        const depTask = flatTasks.find((t) => t.id === depId);
        if (depTask && depTask.deadline) {
          if (!latestDepDeadline || depTask.deadline > latestDepDeadline) {
            latestDepDeadline = depTask.deadline;
          }
        }
      }

      if (latestDepDeadline) {
        while (
          currentDayIndex < workingDaysList.length &&
          workingDaysList[currentDayIndex] <= latestDepDeadline
        ) {
          currentDayIndex++;
          hoursUsedToday = 0;
        }
      }
    }

    if (currentDayIndex >= workingDaysList.length) {
      overflow = true;
      task.scheduledDate = workingDaysList[workingDaysList.length - 1] || startDate;
      task.deadline = task.scheduledDate;
      task.durationDays = 1;
      continue;
    }

    if (hoursUsedToday + task.estimatedHours > hoursPerDay) {
      currentDayIndex++;
      hoursUsedToday = 0;

      if (currentDayIndex >= workingDaysList.length) {
        overflow = true;
        task.scheduledDate = workingDaysList[workingDaysList.length - 1] || startDate;
        task.deadline = task.scheduledDate;
        task.durationDays = 1;
        continue;
      }
    }

    task.scheduledDate = workingDaysList[currentDayIndex];
    task.deadline = workingDaysList[currentDayIndex];

    const remainingAfterToday = task.estimatedHours - (hoursPerDay - hoursUsedToday);
    hoursUsedToday += task.estimatedHours;

    if (remainingAfterToday > 0) {
      let remaining = remainingAfterToday;
      while (remaining > 0) {
        currentDayIndex++;
        hoursUsedToday = 0;
        if (currentDayIndex >= workingDaysList.length) {
          overflow = true;
          break;
        }
        task.deadline = workingDaysList[currentDayIndex];
        remaining -= hoursPerDay;
      }
    }

    task.durationDays = daysBetween(task.scheduledDate, task.deadline) + 1;
  }

  let overflowDays = 0;
  if (overflow && flatTasks.length > 0) {
    const lastTask = flatTasks[flatTasks.length - 1];
    if (lastTask.deadline && lastTask.deadline > deadline) {
      overflowDays = daysBetween(deadline, lastTask.deadline);
    }
  }

  return { flatTasks, overflow, overflowDays };
}

module.exports = { buildWorkingDayCalendar, scheduleTasks, daysBetween, addDays };
