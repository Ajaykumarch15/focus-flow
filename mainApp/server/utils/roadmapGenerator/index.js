const schemaValidator = require('./schemaValidator');
const contentPlanner = require('./contentPlanner');
const milestoneGenerator = require('./milestoneGenerator');
const taskGenerator = require('./taskGenerator');
const dependencyResolver = require('./dependencyResolver');
const scheduler = require('./scheduler');
const capacityAnalyzer = require('./capacityAnalyzer');
const warningEngine = require('./warningEngine');
const metadataGenerator = require('./metadataGenerator');

const ICON_KEYWORDS = {
  learn: 'GraduationCap',
  study: 'BookOpen',
  build: 'Rocket',
  create: 'Rocket',
  interview: 'Briefcase',
  code: 'Code',
  design: 'Palette',
  health: 'Heart',
  career: 'Briefcase',
  cert: 'Award',
  default: 'Map',
};

function detectIcon(name) {
  const lower = name.toLowerCase();
  for (const [keyword, icon] of Object.entries(ICON_KEYWORDS)) {
    if (lower.includes(keyword)) return icon;
  }
  return ICON_KEYWORDS.default;
}

function computeStats(phases, capacityResult, input) {
  let totalMilestones = 0;
  let totalTasks = 0;
  let totalEstimatedHours = 0;
  const hoursByType = {};

  for (const phase of phases) {
    totalMilestones += phase.milestones.length;
    for (const milestone of phase.milestones) {
      for (const task of milestone.tasks) {
        totalTasks++;
        totalEstimatedHours += task.estimatedHours;
        hoursByType[task.category] = (hoursByType[task.category] || 0) + task.estimatedHours;
      }
    }
    for (const task of phase._phaseTasks || []) {
      totalTasks++;
      totalEstimatedHours += task.estimatedHours;
      hoursByType[task.category] = (hoursByType[task.category] || 0) + task.estimatedHours;
    }
  }

  for (const key of Object.keys(hoursByType)) {
    hoursByType[key] = Math.round(hoursByType[key] * 10) / 10;
  }

  return {
    totalPhases: phases.length,
    totalMilestones,
    totalTasks,
    totalEstimatedHours: Math.round(totalEstimatedHours * 10) / 10,
    totalWorkingDays: capacityResult.workingDaysCount,
    availableHours: capacityResult.availableHours,
    bufferDays: input.schedule.bufferDays,
    utilization: capacityResult.utilization,
    hoursByType,
  };
}

function buildPlan(input, phases, capacityResult) {
  const roadmapPhases = phases.map((phase) => {
    const allMilestoneTasks = phase.milestones.flatMap((m) => m.tasks);
    const allTasks = [...allMilestoneTasks, ...(phase._phaseTasks || [])];

    const startDate = allTasks
      .filter((t) => t.scheduledDate)
      .reduce((min, t) => (!min || t.scheduledDate < min ? t.scheduledDate : min), null);

    const targetDate = allTasks
      .filter((t) => t.deadline)
      .reduce((max, t) => (!max || t.deadline > max ? t.deadline : max), null);

    return {
      id: phase.id,
      title: phase.title,
      description: phase.description,
      order: phase.order,
      startDate,
      targetDate,
      milestones: phase.milestones.map((m) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        order: m.order,
        targetDate: m.tasks
          .filter((t) => t.deadline)
          .reduce((max, t) => (!max || t.deadline > max ? t.deadline : max), null),
        completionCriteria: m.completionCriteria,
        tasks: m.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          category: t.category,
          estimatedHours: t.estimatedHours,
          priority: t.priority,
          scheduledDate: t.scheduledDate,
          deadline: t.deadline,
          durationDays: t.durationDays,
          order: t.order,
          tags: t.tags,
          subtasks: t.subtasks,
          dependencies: t.dependencies,
        })),
      })),
    };
  });

  const roadmapStartDate = input.project.startDate;
  let roadmapTargetDate = input.project.deadline;

  if (capacityResult.isOverflow && roadmapPhases.length > 0) {
    const lastPhase = roadmapPhases[roadmapPhases.length - 1];
    if (lastPhase.targetDate) {
      roadmapTargetDate = lastPhase.targetDate;
    }
  }

  return {
    roadmap: {
      title: input.project.name,
      description: input.project.description || '',
      startDate: roadmapStartDate,
      targetDate: roadmapTargetDate,
      status: 'planning',
      icon: detectIcon(input.project.name),
      color: '#6366f1',
      type: 'learning',
    },
    phases: roadmapPhases,
    warnings: [],
    stats: computeStats(phases, capacityResult, input),
  };
}

function generate(input) {
  taskGenerator.resetCounter();
  milestoneGenerator.resetCounter();
  contentPlanner.resetCounter();

  const validated = schemaValidator.validateInput(input);
  if (!validated.valid) {
    const err = new Error('Validation failed: ' + validated.errors.join('; '));
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const data = validated.data;

  const phases = contentPlanner.planContent(data);

  const flatTasks = dependencyResolver.resolveDependencies(phases);

  const { overflow, overflowDays } = scheduler.scheduleTasks(flatTasks, data);

  const capacityResult = capacityAnalyzer.analyzeCapacity(flatTasks, data, overflowDays);

  const warnings = warningEngine.generateWarnings(capacityResult, phases);

  const plan = buildPlan(data, phases, capacityResult);
  plan.warnings = warnings;

  metadataGenerator.addMetadata(plan);

  return { plan, warnings };
}

module.exports = { generate };
