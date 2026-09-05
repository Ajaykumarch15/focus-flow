import type { WorkspaceMember } from '@collab/types/collaboration';

export interface PersonStats {
  member: WorkspaceMember;
  projectCount: number;
  completedTasks: number;
  activeTasks: number;
  productivity: number;
  projects: Array<{ id: string; name: string; progress: number }>;
}
