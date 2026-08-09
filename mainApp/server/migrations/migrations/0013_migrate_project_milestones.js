// EEP2-P3.1.5 / DDS §4.5 + ark-domain-model §7: move legacy embedded
// `projects.milestones[]` into the `milestones` collection. Additive only —
// the legacy array stays in place (read-compatible during the transition;
// removed by a later migration once all clients read from the collection).
//
// Mapping: `title`→name, `dueDate`(string)→targetDate(Date), legacy status
// `planning`→`planned`, `order` = explicit order or array index, `createdBy` =
// project.userId. Idempotent: each item is upserted with `$setOnInsert` keyed
// on `{ projectRef, name }`, so re-runs never duplicate.
'use strict';

const STATUS_MAP = { planning: 'planned', active: 'active', completed: 'completed' };

function parseTargetDate(dueDate) {
  if (!dueDate || typeof dueDate !== 'string') return null;
  const d = new Date(dueDate);
  return Number.isNaN(d.getTime()) ? null : d;
}

module.exports = {
  async up({ db }) {
    const projects = await db
      .collection('projects')
      .find({ milestones: { $exists: true, $ne: [] } })
      .toArray();

    let inserted = 0;
    let processed = 0;
    const now = new Date();
    for (const project of projects) {
      const projectRef = project._id;
      const workspaceRef = project.workspaceRef ?? null;
      const milestones = Array.isArray(project.milestones) ? project.milestones : [];
      if (milestones.length === 0) continue;
      processed += 1;
      for (let i = 0; i < milestones.length; i += 1) {
        const m = milestones[i];
        if (!m || !m.title) continue;
        const result = await db
          .collection('milestones')
          .updateOne(
            { projectRef: project._id, name: m.title },
            {
              $setOnInsert: {
                projectRef,
                workspaceRef,
                name: m.title,
                description: typeof m.description === 'string' ? m.description : '',
                targetDate: parseTargetDate(m.dueDate),
                status: STATUS_MAP[m.status] || 'planned',
                order: typeof m.order === 'number' ? m.order : i,
                createdBy: project.userId ?? null,
                createdAt: now,
                updatedAt: now,
              },
            },
            { upsert: true }
          );
        inserted += result.upsertedCount || 0;
      }
    }
    return { projectsProcessed: processed, inserted };
  },
};
