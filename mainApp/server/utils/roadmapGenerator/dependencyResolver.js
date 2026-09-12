function resolveDependencies(phases) {
  const allTasks = [];
  const taskMap = new Map();

  for (const phase of phases) {
    for (const milestone of phase.milestones) {
      for (const task of milestone.tasks) {
        allTasks.push(task);
        taskMap.set(task.id, task);
      }
    }
    for (const task of phase._phaseTasks || []) {
      allTasks.push(task);
      taskMap.set(task.id, task);
    }
  }

  for (const phase of phases) {
    let lastTaskOfPreviousMilestone = null;

    for (let mi = 0; mi < phase.milestones.length; mi++) {
      const milestone = phase.milestones[mi];
      const tasks = milestone.tasks;

      const learningPracticeTasks = tasks.filter(
        (t) => t.category === 'learning' || t.category === 'practice'
      );
      const quizTask = tasks.find((t) => t.category === 'quiz');
      const revisionTask = tasks.find((t) => t.category === 'revision');

      for (let i = 1; i < tasks.length; i++) {
        const task = tasks[i];
        if (task.category !== 'quiz' && task.category !== 'revision') {
          if (!task.dependencies.includes(tasks[i - 1].id)) {
            task.dependencies.push(tasks[i - 1].id);
          }
        }
      }

      if (mi > 0 && lastTaskOfPreviousMilestone && learningPracticeTasks.length > 0) {
        const firstTask = learningPracticeTasks[0];
        if (!firstTask.dependencies.includes(lastTaskOfPreviousMilestone.id)) {
          firstTask.dependencies.push(lastTaskOfPreviousMilestone.id);
        }
      }

      if (quizTask && learningPracticeTasks.length > 0) {
        quizTask.dependencies = learningPracticeTasks.map((t) => t.id);
      }

      if (revisionTask && quizTask) {
        revisionTask.dependencies = [quizTask.id];
      }

      if (learningPracticeTasks.length > 0) {
        lastTaskOfPreviousMilestone = learningPracticeTasks[learningPracticeTasks.length - 1];
      } else if (tasks.length > 0) {
        lastTaskOfPreviousMilestone = tasks[tasks.length - 1];
      }
    }

    const phaseTasks = phase._phaseTasks || [];
    const projectTask = phaseTasks.find((t) => t.category === 'project');
    const reviewTask = phaseTasks.find((t) => t.category === 'review');

    const allMilestoneTasks = phase.milestones.flatMap((m) => m.tasks);
    const quizAndRevision = allMilestoneTasks.filter(
      (t) => t.category === 'quiz' || t.category === 'revision'
    );

    if (projectTask && quizAndRevision.length > 0) {
      projectTask.dependencies = quizAndRevision.map((t) => t.id);
    }

    if (reviewTask && projectTask) {
      reviewTask.dependencies = [projectTask.id];
    } else if (reviewTask && quizAndRevision.length > 0) {
      reviewTask.dependencies = quizAndRevision.map((t) => t.id);
    }
  }

  for (let pi = 1; pi < phases.length; pi++) {
    const prevPhase = phases[pi - 1];
    const currPhase = phases[pi];

    const prevLastTask = getLastTask(prevPhase);
    const currFirstTask = getFirstLearningTask(currPhase);

    if (prevLastTask && currFirstTask) {
      if (!currFirstTask.dependencies.includes(prevLastTask.id)) {
        currFirstTask.dependencies.push(prevLastTask.id);
      }
    }
  }

  detectCycles(allTasks, taskMap);

  return topologicalSort(allTasks, taskMap);
}

function getLastTask(phase) {
  const phaseTasks = phase._phaseTasks || [];
  if (phaseTasks.length > 0) return phaseTasks[phaseTasks.length - 1];

  const lastMilestone = phase.milestones[phase.milestones.length - 1];
  if (lastMilestone && lastMilestone.tasks.length > 0) {
    return lastMilestone.tasks[lastMilestone.tasks.length - 1];
  }
  return null;
}

function getFirstLearningTask(phase) {
  for (const milestone of phase.milestones) {
    const lt = milestone.tasks.find((t) => t.category === 'learning' || t.category === 'practice');
    if (lt) return lt;
  }
  const phaseTasks = phase._phaseTasks || [];
  return phaseTasks[0] || null;
}

function detectCycles(allTasks, taskMap) {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map();
  allTasks.forEach((t) => color.set(t.id, WHITE));

  function dfs(nodeId) {
    color.set(nodeId, GRAY);
    const node = taskMap.get(nodeId);
    if (!node) { color.set(nodeId, BLACK); return; }
    for (const depId of node.dependencies) {
      if (!taskMap.has(depId)) continue;
      if (color.get(depId) === GRAY) {
        throw new Error(`Dependency cycle detected involving task ${depId}`);
      }
      if (color.get(depId) === WHITE) dfs(depId);
    }
    color.set(nodeId, BLACK);
  }

  for (const task of allTasks) {
    if (color.get(task.id) === WHITE) dfs(task.id);
  }
}

function topologicalSort(allTasks, taskMap) {
  const visited = new Set();
  const result = [];

  function visit(nodeId) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    const node = taskMap.get(nodeId);
    if (!node) return;
    for (const depId of node.dependencies) {
      if (taskMap.has(depId)) visit(depId);
    }
    result.push(node);
  }

  for (const task of allTasks) {
    visit(task.id);
  }

  return result;
}

module.exports = { resolveDependencies };
