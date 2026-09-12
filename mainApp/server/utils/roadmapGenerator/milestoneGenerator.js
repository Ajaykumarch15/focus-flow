const taskGenerator = require('./taskGenerator');

let milestoneCounter = 0;

function resetCounter() {
  milestoneCounter = 0;
}

function nextMilestoneId() {
  return `milestone-${milestoneCounter++}`;
}

function chunk(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function generateMilestoneName(topics, chunkIndex, totalChunks, phaseName) {
  const topicWords = topics.map((t) => t.title).join(', ');
  const shortName = topicWords.length > 50 ? topicWords.slice(0, 47) + '...' : topicWords;

  if (totalChunks === 1) {
    return `Understand and master ${shortName}`;
  }
  if (chunkIndex === 0) {
    return `Understand ${shortName}`;
  }
  if (chunkIndex === totalChunks - 1) {
    return `Master ${shortName} and complete assessment`;
  }
  return `Learn ${shortName}`;
}

function generateCompletionCriteria(topics, includeQuiz) {
  const criteria = [];
  for (const topic of topics) {
    criteria.push(`Explain ${topic.title}`);
    criteria.push(`Apply ${topic.title} in practice`);
  }
  if (includeQuiz) {
    criteria.push('Pass quiz on this section');
  }
  return criteria;
}

function generateMilestones(topics, groupSize, rules, phaseName) {
  const chunks = chunk(topics, groupSize);
  const milestones = [];
  let globalIndex = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunkTopics = chunks[i];
    const milestoneName = generateMilestoneName(chunkTopics, i, chunks.length, phaseName);

    const tasks = taskGenerator.generateMilestoneTasks(chunkTopics, rules, milestoneName);

    milestones.push({
      id: nextMilestoneId(),
      title: milestoneName,
      description: '',
      order: globalIndex,
      targetDate: null,
      completionCriteria: generateCompletionCriteria(chunkTopics, rules.includeQuiz),
      tasks,
    });

    globalIndex++;
  }

  return milestones;
}

module.exports = { resetCounter, generateMilestones };
