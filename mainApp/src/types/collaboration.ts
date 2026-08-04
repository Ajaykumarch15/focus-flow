export type WorkspaceType = 'Personal' | 'Startup' | 'College Project' | 'Open Source' | 'Internship' | 'Enterprise';
export type MemberRole = 'Owner' | 'Admin' | 'Manager' | 'Developer' | 'Viewer';
export type MemberStatus = 'available' | 'in_focus' | 'away' | 'in_meeting' | 'offline';
export type SprintStatus = 'backlog' | 'ready' | 'in_progress' | 'review' | 'done';
export type BlockerSeverity = 'critical' | 'high' | 'medium' | 'low';
export type BlockerStatus = 'open' | 'investigating' | 'resolved';
export type DocCategory = 'Architecture' | 'Meeting Notes' | 'API Documentation' | 'Coding Standards' | 'Onboarding' | 'Retrospectives';
export type EventType = 'sprint' | 'deadline' | 'leave' | 'milestone' | 'release' | 'focus_block';

export interface WorkspaceMember {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: MemberRole;
  teams: string[]; // e.g. ['Frontend', 'AI']
  status: MemberStatus;
  currentFocusTask?: string;
  currentFocusTimeMs?: number;
  joinedAt: string;
}

export interface WorkspaceTeam {
  id: string;
  name: string; // e.g. 'Frontend', 'Backend', 'AI', 'QA', 'Design', 'DevOps'
  description: string;
  memberIds: string[];
  color: string;
  leaderId?: string;
}

export interface Workspace {
  id: string;
  name: string;
  type: WorkspaceType;
  icon: string;
  description: string;
  membersCount: number;
  projectsCount: number;
  createdAt: string;
  settings: {
    allowMemberInvites: boolean;
    requireReviewForDone: boolean;
    autoSyncTimerWorkLogs: boolean;
    defaultVisibility: 'Private' | 'Team' | 'Project' | 'Workspace';
  };
}

export interface ProjectMilestone {
  id: string;
  title: string;
  dueDate: string;
  status: 'planning' | 'active' | 'completed';
  targetPoints: number;
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  key: string; // e.g. 'FF'
  description: string;
  repositoryUrl?: string;
  members: string[]; // memberIds
  teamIds: string[];
  status: 'planning' | 'active' | 'completed' | 'on_hold';
  milestones: ProjectMilestone[];
  createdAt: string;
}

export interface Sprint {
  id: string;
  workspaceId: string;
  projectId: string;
  name: string; // e.g. 'Sprint 24 — AI Copilot'
  startDate: string;
  endDate: string;
  goal: string;
  status: 'future' | 'active' | 'completed';
  capacityHours: number;
  targetVelocity: number;
  actualVelocity?: number;
}

// IES-R1: Feature/FeatureType mirror the server Feature model (server/models/Feature.js).
// `sprintId` absent/null means the feature lives in the Project Backlog.
export type FeatureType = 'feature' | 'bug' | 'spike' | 'chore' | 'research' | 'debt' | 'improvement';
export type FeatureStatus = SprintStatus; // server enum: backlog | ready | in_progress | review | done

export interface Feature {
  id: string;
  projectId: string;
  sprintId?: string;
  workspaceId: string;
  name: string;
  description: string;
  type: FeatureType;
  labels: string[];
  ownerId?: string;
  estimatedHours: number;
  status: FeatureStatus;
  order: number;
  createdAt: string;
}

export interface GitContext {
  repository?: string;
  branch?: string;
  commitHash?: string;
  prNumber?: number;
  prUrl?: string;
  reviewStatus?: 'pending' | 'approved' | 'changes_requested';
  reviewerName?: string;
  mergeStatus?: 'open' | 'merged' | 'closed';
  deploymentStatus?: 'staging' | 'production' | 'failed' | 'not_deployed';
}

export interface CollaborativeTask {
  id: string;
  workspaceId: string;
  projectId: string;
  sprintId?: string;
  featureId?: string;
  title: string;
  description: string;
  sprintStatus: SprintStatus;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  ownerId: string;
  assigneeId?: string;
  reviewerId?: string;
  followerIds: string[];
  labels: string[];
  dependencies: string[]; // task IDs
  estimatedHours: number;
  actualHours: number;
  gitContext?: GitContext;
  subtasks: { id: string; title: string; completed: boolean }[];
  createdAt: string;
  updatedAt: string;
}

// IES-P2-04: real workspace activity, shaped by GET /api/workspaces/:id/activity
// (workspace-scoped, newest-first, keyset-paginated).
export interface WorkspaceActivity {
  id: string;
  workspaceId: string;
  actor: {
    id: string;
    name: string;
    email?: string;
    avatar?: string;
  };
  action: string;
  details: Record<string, any>;
  timestamp: string;
}

export interface DiscussionComment {
  id: string;
  workspaceId: string;
  targetType: 'task' | 'worklog' | 'project' | 'doc';
  targetId: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  content: string;
  createdAt: string;
  reactions: Record<string, string[]>; // e.g. { '👍': ['m1', 'm2'] }
  replies: DiscussionComment[];
  isResolved?: boolean;
  mentions?: string[]; // memberIds or teamNames
}

export interface NotificationItem {
  id: string;
  workspaceId: string;
  recipientId: string;
  actor: {
    id: string;
    name: string;
    avatar?: string;
  };
  type:
    | 'assigned'
    | 'mentioned'
    | 'completed'
    | 'review_requested'
    | 'blocker_added'
    | 'sprint_started'
    | 'report_shared'
    | 'invited'
    | 'role_changed'
    | 'removed';
  title: string;
  body: string;
  targetUrl?: string;
  createdAt: string;
  read: boolean;
}

export interface KnowledgeDoc {
  id: string;
  workspaceId: string;
  title: string;
  category: DocCategory;
  content: string; // Markdown
  authorId: string;
  version: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CentralBlocker {
  id: string;
  workspaceId: string;
  taskId?: string;
  worklogId?: string;
  title: string;
  severity: BlockerSeverity;
  ownerId: string;
  reporterId: string;
  status: BlockerStatus;
  impactDescription: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface TeamCalendarEvent {
  id: string;
  workspaceId: string;
  title: string;
  type: EventType;
  date: string;
  endDate?: string;
  memberIds?: string[];
  color: string;
}

// IES-P2-06: normalized search result rendered by both the command palette and
// the SearchResults page. `kind` mirrors the server facet a result came from.
export interface SearchResultItem {
  kind: 'project' | 'team' | 'member' | 'task' | 'worklog' | 'workspace';
  id: string;
  title: string;
  subtitle: string;
  workspaceId?: string;
  url: string;
}

export interface SearchResults {
  query: string;
  workspaceId?: string;
  projects: SearchResultItem[];
  teams: SearchResultItem[];
  members: SearchResultItem[];
  tasks: SearchResultItem[];
  worklogs: SearchResultItem[];
  workspaces: SearchResultItem[];
}
