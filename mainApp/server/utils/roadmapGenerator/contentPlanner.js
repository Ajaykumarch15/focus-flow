const milestoneGenerator = require('./milestoneGenerator');
const taskGenerator = require('./taskGenerator');

let phaseCounter = 0;

function resetCounter() {
  phaseCounter = 0;
}

function nextPhaseId() {
  return `phase-${phaseCounter++}`;
}

function planContent(input) {
  const { rules } = input;
  const phases = [];

  for (const phaseInput of input.phases) {
    const milestones = milestoneGenerator.generateMilestones(
      phaseInput.topics,
      rules.milestoneGroupSize,
      rules,
      phaseInput.name
    );

    const phaseTasks = taskGenerator.generatePhaseTasks(rules, phaseInput.name);

    phases.push({
      id: nextPhaseId(),
      title: phaseInput.name,
      description: phaseInput.description || '',
      order: phases.length,
      startDate: null,
      targetDate: null,
      milestones,
      _phaseTasks: phaseTasks,
    });
  }

  return phases;
}

module.exports = { resetCounter, planContent };
