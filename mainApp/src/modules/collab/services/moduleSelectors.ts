import type { Feature, RoadmapModule } from '@collab/types/collaboration';

// EEP2-P3.4.1 / DDS §4.8: Module-level selectors — completion rollup from the
// Module's Features and the module-scoped feature list (used by ModuleDetailPage,
// FeaturesPage grouping, and the module picker).

export interface ModuleCompletionRollup {
  done: number;
  total: number;
  pct: number;
}

// A Module is complete when all its Features are `done` (derived, DDS §9).
// `pct` = 0 when the Module has no Features yet.
export function selectModuleCompletion(module: RoadmapModule, features: Feature[]): ModuleCompletionRollup {
  const owned = features.filter((f) => f.moduleId === module.id);
  const total = owned.length;
  const done = owned.filter((f) => f.status === 'done').length;
  return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
}

export function selectFeaturesByModule(features: Feature[], moduleId: string): Feature[] {
  return features
    .filter((f) => f.moduleId === moduleId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.createdAt.localeCompare(b.createdAt));
}
