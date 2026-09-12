function addMetadata(plan) {
  plan.generationMetadata = {
    generatedAt: new Date().toISOString(),
    generatorVersion: '2.0',
    inputVersion: '1.0',
  };
  return plan;
}

module.exports = { addMetadata };
