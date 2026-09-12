let taskCounter = 0;

function resetCounter() {
  taskCounter = 0;
}

function nextTaskId() {
  return `task-${taskCounter++}`;
}

function extractTag(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 30);
}

function generateSubtasks(topic, rules) {
  if (!rules.includeSubtasks) return [];
  if (topic.subtopics && topic.subtopics.length > 0) {
    return topic.subtopics.map((st) => ({ title: st, completed: false }));
  }
  const count = rules.defaultSubtaskCount;
  const base = topic.title;
  const templates = [
    `Read about ${base}`,
    `Take notes on ${base}`,
    `Watch tutorial on ${base}`,
    `Create summary for ${base}`,
    `Find examples of ${base}`,
  ];
  return templates.slice(0, count).map((title) => ({ title, completed: false }));
}

function generateTasksForTopics(topicsChunk, rules, milestoneIndex) {
  const tasks = [];
  const tag = extractTag(topicsChunk[0]?.title || 'topic');

  for (const topic of topicsChunk) {
    const hours = topic.estimatedHours || rules.defaultTaskHours;

    const learnTask = {
      id: nextTaskId(),
      title: `Learn ${topic.title}`,
      description: '',
      category: 'learning',
      estimatedHours: hours,
      priority: topic.priority || 'medium',
      scheduledDate: null,
      deadline: null,
      durationDays: null,
      order: tasks.length,
      tags: [tag],
      subtasks: generateSubtasks(topic, rules),
      dependencies: [],
    };
    tasks.push(learnTask);

    if (rules.includePractice) {
      const practiceHours = Math.max(0.5, Math.ceil(hours * 0.6));
      tasks.push({
        id: nextTaskId(),
        title: `Practice ${topic.title} exercises`,
        description: '',
        category: 'practice',
        estimatedHours: practiceHours,
        priority: topic.priority || 'medium',
        scheduledDate: null,
        deadline: null,
        durationDays: null,
        order: tasks.length,
        tags: [tag],
        subtasks: [],
        dependencies: [learnTask.id],
      });
    }
  }

  return tasks;
}

function generateMilestoneTasks(topicsChunk, rules, milestoneName) {
  const tasks = generateTasksForTopics(topicsChunk, rules);

  if (rules.includeQuiz) {
    tasks.push({
      id: nextTaskId(),
      title: `Quiz: ${milestoneName}`,
      description: '',
      category: 'quiz',
      estimatedHours: 1.0,
      priority: 'medium',
      scheduledDate: null,
      deadline: null,
      durationDays: null,
      order: tasks.length,
      tags: ['quiz'],
      subtasks: [],
      dependencies: [],
    });
  }

  if (rules.includeRevision) {
    tasks.push({
      id: nextTaskId(),
      title: `Revision: ${milestoneName}`,
      description: '',
      category: 'revision',
      estimatedHours: 1.5,
      priority: 'medium',
      scheduledDate: null,
      deadline: null,
      durationDays: null,
      order: tasks.length,
      tags: ['revision'],
      subtasks: [],
      dependencies: [],
    });
  }

  return tasks;
}

function generatePhaseTasks(rules, phaseName) {
  const tasks = [];

  if (rules.includeProjects) {
    tasks.push({
      id: nextTaskId(),
      title: `Mini-project: ${phaseName}`,
      description: '',
      category: 'project',
      estimatedHours: 3.0,
      priority: 'high',
      scheduledDate: null,
      deadline: null,
      durationDays: null,
      order: 0,
      tags: ['project'],
      subtasks: [],
      dependencies: [],
    });
  }

  tasks.push({
    id: nextTaskId(),
    title: `Phase review: ${phaseName}`,
    description: '',
    category: 'review',
    estimatedHours: 1.0,
    priority: 'medium',
    scheduledDate: null,
    deadline: null,
    durationDays: null,
    order: tasks.length,
    tags: ['review'],
    subtasks: [],
    dependencies: [],
  });

  return tasks;
}

module.exports = {
  resetCounter,
  generateTasksForTopics,
  generateMilestoneTasks,
  generatePhaseTasks,
};
