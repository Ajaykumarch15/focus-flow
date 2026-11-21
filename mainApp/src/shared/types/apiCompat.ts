// Minimal client-side shapes for legacy API groups. These used to come from the
// removed collab module; keeping them here lets the remaining personal/WorkLog
// code compile without depending on that module.

export type Sprint = Record<string, any>;
export type SprintStats = Record<string, any>;
export type WorkspaceActivity = Record<string, any>;
export type NotificationItem = Record<string, any>;
export type ProjectPatch = Record<string, any>;
export type RoadmapMilestone = Record<string, any>;
export type RoadmapPhase = Record<string, any>;
export type RoadmapModule = Record<string, any>;
export type RoadmapStatus = string;
export type GitContext = Record<string, any>;

export interface Feature {
  id: string;
  type?: string;
  status?: string;
  [key: string]: any;
}

export interface DiscussionComment {
  targetType: string;
  [key: string]: any;
}

export interface TaskAttachment {
  targetType: string;
  [key: string]: any;
}

export type SearchResultKind = 'project' | 'task' | 'worklog';

export interface SearchResultItem {
  id: string;
  kind: SearchResultKind;
  title: string;
  subtitle: string;
  url: string;
}

export interface SearchResults {
  query: string;
  workspaceId?: string;
  projects: SearchResultItem[];
  tasks: SearchResultItem[];
  worklogs: SearchResultItem[];
}
