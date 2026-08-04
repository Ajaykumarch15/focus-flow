export type WorkspaceMaturityLevel = 1 | 2 | 3 | 4;

export interface WorkspaceCounts {
  membersCount: number;
  projectsCount: number;
  sprintsCount: number;
  featuresCount: number;
  blockersCount: number;
  qaTasksCount: number;
  reportsCount: number;
}

/**
 * Computes workspace maturity level based on data present:
 * Level 1: Solo Developer (default / minimal data)
 * Level 2: Growing Team (>= 2 members OR >= 1 project OR >= 1 sprint)
 * Level 3: Engineering Team (>= 3 members AND >= 2 projects/sprints)
 * Level 4: Enterprise (>= 5 members AND >= 3 projects AND >= 2 sprints)
 */
export function getWorkspaceMaturityLevel(counts: WorkspaceCounts): WorkspaceMaturityLevel {
  const { membersCount, projectsCount, sprintsCount } = counts;

  if (membersCount >= 5 && projectsCount >= 3 && sprintsCount >= 2) {
    return 4;
  }
  if (membersCount >= 3 && (projectsCount >= 2 || sprintsCount >= 2)) {
    return 3;
  }
  if (membersCount >= 2 || projectsCount >= 1 || sprintsCount >= 1) {
    return 2;
  }
  return 1;
}

export function isFeatureVisibleForMaturity(
  featureKey: 'teams' | 'projects' | 'sprints' | 'qa' | 'analytics' | 'reports' | 'blockers' | 'admin',
  maturityLevel: WorkspaceMaturityLevel
): boolean {
  switch (featureKey) {
    case 'projects':
    case 'sprints':
    case 'teams':
      return maturityLevel >= 2;
    case 'blockers':
    case 'qa':
    case 'analytics':
    case 'reports':
      return maturityLevel >= 3;
    case 'admin':
      return maturityLevel >= 4;
    default:
      return true;
  }
}
