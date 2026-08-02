import { create } from 'zustand';
import {
  Workspace, WorkspaceTeam, WorkspaceMember, Project,
  Sprint, CollaborativeTask, EngineeringActivity, DiscussionComment,
  NotificationItem, KnowledgeDoc, CentralBlocker, TeamCalendarEvent,
  SprintStatus, BlockerSeverity, DocCategory, EventType, MemberRole
} from '../types/collaboration';
import { toast } from './useToastStore';

// ── Default Initial Mock Data ──────────────────────────────────────────────────
const INITIAL_WORKSPACES: Workspace[] = [
  {
    id: 'ws-acme-dev',
    name: 'Acme AI Engineering',
    type: 'Startup',
    icon: '⚡',
    description: 'Core platform engineering workspace for Acme AI',
    membersCount: 8,
    projectsCount: 3,
    createdAt: '2026-01-15T00:00:00.000Z',
    settings: {
      allowMemberInvites: true,
      requireReviewForDone: true,
      autoSyncTimerWorkLogs: true,
      defaultVisibility: 'Workspace',
    },
  },
  {
    id: 'ws-personal-dev',
    name: 'Personal Sandbox',
    type: 'Personal',
    icon: '🚀',
    description: 'Personal side-projects & continuous learning',
    membersCount: 1,
    projectsCount: 2,
    createdAt: '2026-02-01T00:00:00.000Z',
    settings: {
      allowMemberInvites: false,
      requireReviewForDone: false,
      autoSyncTimerWorkLogs: true,
      defaultVisibility: 'Private',
    },
  },
  {
    id: 'ws-open-source',
    name: 'FocusFlow Open Source',
    type: 'Open Source',
    icon: '🌐',
    description: 'Community-driven tools for deep focus & developer productivity',
    membersCount: 14,
    projectsCount: 4,
    createdAt: '2026-03-10T00:00:00.000Z',
    settings: {
      allowMemberInvites: true,
      requireReviewForDone: true,
      autoSyncTimerWorkLogs: false,
      defaultVisibility: 'Workspace',
    },
  },
];

const INITIAL_MEMBERS: WorkspaceMember[] = [
  { id: 'm1', name: 'Ajay Kumar', email: 'ajay@focusflow.io', role: 'Owner', teams: ['Frontend', 'AI'], status: 'in_focus', currentFocusTask: 'Refactoring Work Log Kanban Engine', currentFocusTimeMs: 4200000, joinedAt: '2026-01-15' },
  { id: 'm2', name: 'Rahul Sharma', email: 'rahul@focusflow.io', role: 'Admin', teams: ['Backend', 'DevOps'], status: 'available', currentFocusTask: undefined, joinedAt: '2026-01-16' },
  { id: 'm3', name: 'Sneha Patel', email: 'sneha@focusflow.io', role: 'Manager', teams: ['AI', 'Frontend'], status: 'in_meeting', currentFocusTask: 'Sprint 24 Planning & Roadmapping', joinedAt: '2026-01-20' },
  { id: 'm4', name: 'Ravi Teja', email: 'ravi@focusflow.io', role: 'Developer', teams: ['Backend'], status: 'in_focus', currentFocusTask: 'gRPC Microservice API Optimization', currentFocusTimeMs: 2700000, joinedAt: '2026-02-01' },
  { id: 'm5', name: 'Priya Sundaram', email: 'priya@focusflow.io', role: 'Developer', teams: ['QA', 'DevOps'], status: 'away', joinedAt: '2026-02-05' },
  { id: 'm6', name: 'David Chen', email: 'david@focusflow.io', role: 'Developer', teams: ['Design', 'Frontend'], status: 'available', joinedAt: '2026-02-12' },
];

const INITIAL_TEAMS: WorkspaceTeam[] = [
  { id: 't1', name: 'Frontend', description: 'React, Vite, UI components & design system', memberIds: ['m1', 'm3', 'm6'], color: '#0ea5e9', leaderId: 'm1' },
  { id: 't2', name: 'Backend', description: 'Node.js, PostgreSQL, Redis & API gateway', memberIds: ['m2', 'm4'], color: '#8b5cf6', leaderId: 'm2' },
  { id: 't3', name: 'AI', description: 'LLM agents, vector embeddings & smart automation', memberIds: ['m1', 'm3'], color: '#f59e0b', leaderId: 'm3' },
  { id: 't4', name: 'DevOps', description: 'Docker, Kubernetes, CI/CD pipelines & telemetry', memberIds: ['m2', 'm5'], color: '#10b981', leaderId: 'm2' },
];

const INITIAL_PROJECTS: Project[] = [
  {
    id: 'p1',
    workspaceId: 'ws-acme-dev',
    name: 'FocusFlow Core Web App',
    key: 'FF',
    description: 'Next-gen developer operating system with live time tracking & collaboration',
    repositoryUrl: 'https://github.com/focusflow/focusflow-web',
    members: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'],
    teamIds: ['t1', 't2', 't3', 't4'],
    status: 'active',
    milestones: [
      { id: 'ms1', title: 'Phase X Team Collaboration Release', dueDate: '2026-08-15', status: 'active', targetPoints: 120 },
      { id: 'ms2', title: 'AI Code Review Assistant v2', dueDate: '2026-09-01', status: 'planning', targetPoints: 80 },
    ],
    createdAt: '2026-01-16',
  },
  {
    id: 'p2',
    workspaceId: 'ws-acme-dev',
    name: 'AI Agent Service',
    key: 'AG',
    description: 'High-throughput Rust microservice for real-time code analysis & auto-standups',
    repositoryUrl: 'https://github.com/focusflow/ai-agent-engine',
    members: ['m1', 'm2', 'm4'],
    teamIds: ['t2', 't3'],
    status: 'active',
    milestones: [
      { id: 'ms3', title: 'gRPC Pipeline Optimization', dueDate: '2026-08-10', status: 'active', targetPoints: 60 },
    ],
    createdAt: '2026-02-10',
  },
];

const INITIAL_SPRINTS: Sprint[] = [
  {
    id: 'sp-24',
    workspaceId: 'ws-acme-dev',
    projectId: 'p1',
    name: 'Sprint 24 — Developer Workspace & Team Hub',
    startDate: '2026-07-27',
    endDate: '2026-08-10',
    goal: 'Ship Phase X Collaboration engine: Live presence, Kanban, Knowledge Base, and Blocker management',
    status: 'active',
    capacityHours: 160,
    targetVelocity: 85,
    actualVelocity: 62,
  },
  {
    id: 'sp-25',
    workspaceId: 'ws-acme-dev',
    projectId: 'p1',
    name: 'Sprint 25 — Git Integrations & Deep Telemetry',
    startDate: '2026-08-11',
    endDate: '2026-08-25',
    goal: 'Enable 1-click GitHub OAuth sync and automatic PR status updates',
    status: 'future',
    capacityHours: 160,
    targetVelocity: 90,
  },
];

const INITIAL_TASKS: CollaborativeTask[] = [
  {
    id: 'ct-101',
    workspaceId: 'ws-acme-dev',
    projectId: 'p1',
    sprintId: 'sp-24',
    title: 'Implement Phase X Team Workspace Architecture',
    description: 'Build central collaboration state, workspace switcher, and role-based permissions model.',
    sprintStatus: 'in_progress',
    priority: 'urgent',
    ownerId: 'm1',
    assigneeId: 'm1',
    reviewerId: 'm3',
    followerIds: ['m2', 'm5'],
    labels: ['Architecture', 'Frontend', 'PhaseX'],
    dependencies: [],
    estimatedHours: 18,
    actualHours: 12,
    gitContext: {
      repository: 'focusflow/focusflow-web',
      branch: 'feature/phase-x-team-collaboration',
      commitHash: 'a78f91c',
      prNumber: 142,
      prUrl: 'https://github.com/focusflow/focusflow-web/pull/142',
      reviewStatus: 'approved',
      reviewerName: 'Sneha Patel',
      mergeStatus: 'open',
      deploymentStatus: 'staging',
    },
    subtasks: [
      { id: 'st1', title: 'Define workspace & member schemas', completed: true },
      { id: 'st2', title: 'Create team dashboard presence widgets', completed: true },
      { id: 'st3', title: 'Build interactive Kanban & Burndown', completed: false },
    ],
    createdAt: '2026-07-28',
    updatedAt: '2026-08-01',
  },
  {
    id: 'ct-102',
    workspaceId: 'ws-acme-dev',
    projectId: 'p1',
    sprintId: 'sp-24',
    title: 'gRPC Gateway & OAuth token refreshing',
    description: 'Optimize user session persistence and handle cross-workspace token rotation cleanly.',
    sprintStatus: 'review',
    priority: 'high',
    ownerId: 'm2',
    assigneeId: 'm4',
    reviewerId: 'm2',
    followerIds: ['m1'],
    labels: ['Backend', 'Security'],
    dependencies: [],
    estimatedHours: 12,
    actualHours: 14,
    gitContext: {
      repository: 'focusflow/ai-agent-engine',
      branch: 'fix/grpc-auth-rotation',
      commitHash: '891c3ef',
      prNumber: 98,
      prUrl: 'https://github.com/focusflow/ai-agent-engine/pull/98',
      reviewStatus: 'approved',
      reviewerName: 'Rahul Sharma',
      mergeStatus: 'merged',
      deploymentStatus: 'production',
    },
    subtasks: [
      { id: 'st4', title: 'Unit test auth interceptor', completed: true },
      { id: 'st5', title: 'Verify benchmark performance', completed: true },
    ],
    createdAt: '2026-07-29',
    updatedAt: '2026-08-01',
  },
  {
    id: 'ct-103',
    workspaceId: 'ws-acme-dev',
    projectId: 'p1',
    sprintId: 'sp-24',
    title: 'Notion-style Engineering Knowledge Base',
    description: 'Create markdown editor with version history, category tagging, and instant search.',
    sprintStatus: 'ready',
    priority: 'medium',
    ownerId: 'm3',
    assigneeId: 'm6',
    reviewerId: 'm1',
    followerIds: ['m3'],
    labels: ['Documentation', 'UI'],
    dependencies: ['ct-101'],
    estimatedHours: 16,
    actualHours: 4,
    subtasks: [],
    createdAt: '2026-07-30',
    updatedAt: '2026-08-01',
  },
  {
    id: 'ct-104',
    workspaceId: 'ws-acme-dev',
    projectId: 'p1',
    sprintId: 'sp-24',
    title: 'Central Blocker Matrix & Resolution Workflow',
    description: 'Enable team members to flag blockers with impact assessment and manager notifications.',
    sprintStatus: 'done',
    priority: 'urgent',
    ownerId: 'm2',
    assigneeId: 'm2',
    reviewerId: 'm3',
    followerIds: ['m1', 'm4'],
    labels: ['Manager', 'Workflow'],
    dependencies: [],
    estimatedHours: 10,
    actualHours: 9,
    subtasks: [
      { id: 'st6', title: 'Design blocker severity matrix', completed: true },
      { id: 'st7', title: 'Add resolution audit logs', completed: true },
    ],
    createdAt: '2026-07-27',
    updatedAt: '2026-07-31',
  },
];

const INITIAL_ACTIVITIES: EngineeringActivity[] = [
  { id: 'act-1', workspaceId: 'ws-acme-dev', actor: { id: 'm1', name: 'Ajay Kumar' }, type: 'focus_session_start', title: 'started Focus Session', detail: 'Task: Implement Phase X Team Workspace Architecture', timestamp: '2026-08-01T10:15:00.000Z' },
  { id: 'act-2', workspaceId: 'ws-acme-dev', actor: { id: 'm2', name: 'Rahul Sharma' }, type: 'pr_merged', title: 'merged PR #98', detail: 'gRPC Gateway & OAuth token refreshing into main', timestamp: '2026-08-01T09:40:00.000Z' },
  { id: 'act-3', workspaceId: 'ws-acme-dev', actor: { id: 'm4', name: 'Ravi Teja' }, type: 'blocker_resolved', title: 'resolved blocker', detail: 'Redis Cluster Memory Spike in Staging Environment', timestamp: '2026-08-01T08:20:00.000Z' },
  { id: 'act-4', workspaceId: 'ws-acme-dev', actor: { id: 'm3', name: 'Sneha Patel' }, type: 'doc_created', title: 'published engineering doc', detail: 'Architecture — FocusFlow Phase X System Design', timestamp: '2026-07-31T16:00:00.000Z' },
  { id: 'act-5', workspaceId: 'ws-acme-dev', actor: { id: 'm1', name: 'Ajay Kumar' }, type: 'task_completed', title: 'completed task', detail: 'WorkLog Home Visual & UX Polish', timestamp: '2026-07-31T14:30:00.000Z' },
];

const INITIAL_DISCUSSIONS: DiscussionComment[] = [
  {
    id: 'disc-1',
    workspaceId: 'ws-acme-dev',
    targetType: 'task',
    targetId: 'ct-101',
    author: { id: 'm3', name: 'Sneha Patel' },
    content: 'Approved PR #142! The state management structure looks clean. Let’s make sure we test cross-tab notifications with `@Frontend` team.',
    createdAt: '2026-08-01T09:30:00.000Z',
    reactions: { '👍': ['m1', 'm2'], '🚀': ['m1'] },
    isResolved: true,
    replies: [
      {
        id: 'disc-1-reply-1',
        workspaceId: 'ws-acme-dev',
        targetType: 'task',
        targetId: 'ct-101',
        author: { id: 'm1', name: 'Ajay Kumar' },
        content: 'Thanks @Sneha! Adding the notification listener now.',
        createdAt: '2026-08-01T09:35:00.000Z',
        reactions: { '🙌': ['m3'] },
        replies: [],
      },
    ],
  },
];

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  { id: 'n1', workspaceId: 'ws-acme-dev', recipientId: 'm1', actor: { id: 'm3', name: 'Sneha Patel' }, type: 'mentioned', title: 'Sneha mentioned you in PR #142', body: 'Let’s make sure we test cross-tab notifications with @Frontend team.', createdAt: '2026-08-01T09:30:00.000Z', read: false },
  { id: 'n2', workspaceId: 'ws-acme-dev', recipientId: 'm1', actor: { id: 'm2', name: 'Rahul Sharma' }, type: 'review_requested', title: 'Review requested on PR #98', body: 'gRPC Gateway & OAuth token refreshing', createdAt: '2026-08-01T08:10:00.000Z', read: true },
  { id: 'n3', workspaceId: 'ws-acme-dev', recipientId: 'm1', actor: { id: 'm4', name: 'Ravi Teja' }, type: 'blocker_added', title: 'New Blocker Reported', body: 'Redis Cluster Memory Spike in Staging Environment', createdAt: '2026-07-31T18:00:00.000Z', read: true },
];

const INITIAL_DOCS: KnowledgeDoc[] = [
  {
    id: 'doc-1',
    workspaceId: 'ws-acme-dev',
    title: 'FocusFlow Developer Workspace Architecture',
    category: 'Architecture',
    content: `# FocusFlow Developer Workspace Architecture

## Overview
FocusFlow expands from personal productivity into a **Developer Operating System** combining asynchronous planning, live engineering telemetry, and focus-preserving collaboration.

### Core Domain Hierarchy
\`\`\`
Workspace → Teams → Members → Projects → Milestones → Tasks → Work Logs → Knowledge Base
\`\`\`

## Key Guidelines
1. **Asynchronous First**: Automatic activity logs eliminate manual status update meetings.
2. **Focus-Preserving**: No aggressive real-time chat popups during Active Focus Sessions.
3. **Role-Based Access**: Owner, Admin, Manager, Developer, Viewer.
4. **Git Context Native**: Deep integration with branch names, PRs, review statuses, and deployments.
`,
    authorId: 'm1',
    version: 3,
    tags: ['Architecture', 'PhaseX', 'System Design'],
    createdAt: '2026-07-25',
    updatedAt: '2026-08-01',
  },
  {
    id: 'doc-2',
    workspaceId: 'ws-acme-dev',
    title: 'Engineering Onboarding & Code Review Standards',
    category: 'Coding Standards',
    content: `# Code Review & Engineering Standards

1. Keep PRs smaller than 400 lines of code.
2. Link every PR to a FocusFlow Collaborative Task.
3. Ensure \`npx tsc --noEmit\` passes with zero errors before requesting review.
4. Record key design decisions in the Work Log before merging.
`,
    authorId: 'm2',
    version: 1,
    tags: ['Onboarding', 'CodeReview', 'Standards'],
    createdAt: '2026-07-20',
    updatedAt: '2026-07-20',
  },
];

const INITIAL_BLOCKERS: CentralBlocker[] = [
  {
    id: 'blk-1',
    workspaceId: 'ws-acme-dev',
    taskId: 'ct-101',
    title: 'Redis Cluster Memory Spike in Staging',
    severity: 'high',
    ownerId: 'm4',
    reporterId: 'm2',
    status: 'resolved',
    impactDescription: 'Delayed staging deploy for 2 hours during cache eviction testing.',
    createdAt: '2026-07-31T18:00:00.000Z',
    resolvedAt: '2026-08-01T08:20:00.000Z',
  },
  {
    id: 'blk-2',
    workspaceId: 'ws-acme-dev',
    taskId: 'ct-103',
    title: 'Staging API Rate Limit Throttling',
    severity: 'medium',
    ownerId: 'm2',
    reporterId: 'm6',
    status: 'investigating',
    impactDescription: 'Intermittent 429 responses during automated integration testing.',
    createdAt: '2026-08-01T09:10:00.000Z',
  },
];

const INITIAL_EVENTS: TeamCalendarEvent[] = [
  { id: 'ev-1', workspaceId: 'ws-acme-dev', title: 'Sprint 24 Launch & Kickoff', type: 'sprint', date: '2026-07-27', endDate: '2026-08-10', color: '#0ea5e9' },
  { id: 'ev-2', workspaceId: 'ws-acme-dev', title: 'Phase X Team Collaboration Release', type: 'release', date: '2026-08-15', color: '#10b981' },
  { id: 'ev-3', workspaceId: 'ws-acme-dev', title: 'Team Architecture Review', type: 'focus_block', date: '2026-08-05', color: '#8b5cf6' },
];

// ── Interface & State ──────────────────────────────────────────────────────────
interface CollaborationStore {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  members: WorkspaceMember[];
  teams: WorkspaceTeam[];
  projects: Project[];
  sprints: Sprint[];
  tasks: CollaborativeTask[];
  activities: EngineeringActivity[];
  discussions: DiscussionComment[];
  notifications: NotificationItem[];
  docs: KnowledgeDoc[];
  blockers: CentralBlocker[];
  events: TeamCalendarEvent[];

  // Actions
  setActiveWorkspace: (id: string) => void;
  updateWorkspaceSettings: (workspaceId: string, settings: Partial<Workspace['settings']>) => void;
  createWorkspace: (name: string, type: any, description: string) => Workspace;
  createTeam: (name: string, description: string, color: string, memberIds: string[]) => void;
  updateMemberRole: (memberId: string, role: MemberRole) => void;
  updateMemberStatus: (memberId: string, status: any, currentTask?: string) => void;

  // Project & Sprint Actions
  createProject: (data: Partial<Project>) => Project;
  createSprint: (projectId: string, name: string, startDate: string, endDate: string, goal: string) => void;
  createTask: (data: Partial<CollaborativeTask>) => CollaborativeTask;
  updateTaskStatus: (taskId: string, sprintStatus: SprintStatus) => void;
  updateGitContext: (taskId: string, gitData: Partial<CollaborativeTask['gitContext']>) => void;

  // Discussions & Comments
  addComment: (targetType: 'task' | 'worklog' | 'project' | 'doc', targetId: string, content: string, parentCommentId?: string) => void;
  addReaction: (commentId: string, emoji: string) => void;
  resolveThread: (commentId: string) => void;

  // Notifications
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;

  // Knowledge Base & Blockers & Calendar
  createDoc: (title: string, category: DocCategory, content: string, tags: string[]) => KnowledgeDoc;
  updateDoc: (id: string, title: string, content: string, tags: string[]) => void;
  createBlocker: (title: string, severity: BlockerSeverity, impactDescription: string, taskId?: string) => void;
  resolveBlocker: (id: string) => void;
  createEvent: (title: string, type: EventType, date: string, color: string) => void;

  // Search
  globalSearch: (query: string) => {
    projects: Project[];
    tasks: CollaborativeTask[];
    members: WorkspaceMember[];
    docs: KnowledgeDoc[];
    blockers: CentralBlocker[];
  };
}

export const useCollaborationStore = create<CollaborationStore>((set, get) => ({
  workspaces: INITIAL_WORKSPACES,
  activeWorkspaceId: 'ws-acme-dev',
  members: INITIAL_MEMBERS,
  teams: INITIAL_TEAMS,
  projects: INITIAL_PROJECTS,
  sprints: INITIAL_SPRINTS,
  tasks: INITIAL_TASKS,
  activities: INITIAL_ACTIVITIES,
  discussions: INITIAL_DISCUSSIONS,
  notifications: INITIAL_NOTIFICATIONS,
  docs: INITIAL_DOCS,
  blockers: INITIAL_BLOCKERS,
  events: INITIAL_EVENTS,

  setActiveWorkspace: (id) => {
    set({ activeWorkspaceId: id });
    const ws = get().workspaces.find(w => w.id === id);
    if (ws) toast.info(`Switched to workspace: ${ws.name}`);
  },

  updateWorkspaceSettings: (workspaceId, settings) => {
    set((state) => ({
      workspaces: state.workspaces.map((w) =>
        w.id === workspaceId ? { ...w, settings: { ...w.settings, ...settings } } : w
      ),
    }));
    toast.success('Settings saved', 'Workspace configuration updated.');
  },

  createWorkspace: (name, type, description) => {
    const newWs: Workspace = {
      id: `ws-${Date.now()}`,
      name,
      type,
      icon: type === 'Startup' ? '⚡' : type === 'Personal' ? '🚀' : '🌐',
      description,
      membersCount: 1,
      projectsCount: 0,
      createdAt: new Date().toISOString(),
      settings: {
        allowMemberInvites: true,
        requireReviewForDone: false,
        autoSyncTimerWorkLogs: true,
        defaultVisibility: 'Workspace',
      },
    };
    set((state) => ({
      workspaces: [newWs, ...state.workspaces],
      activeWorkspaceId: newWs.id,
    }));
    toast.success('Workspace created', `You are now in ${name}`);
    return newWs;
  },

  createTeam: (name, description, color, memberIds) => {
    const newTeam: WorkspaceTeam = {
      id: `team-${Date.now()}`,
      name,
      description,
      memberIds,
      color,
      leaderId: memberIds[0],
    };
    set((state) => ({ teams: [...state.teams, newTeam] }));
    toast.success(`Team ${name} created`);
  },

  updateMemberRole: (memberId, role) => {
    set((state) => ({
      members: state.members.map((m) => (m.id === memberId ? { ...m, role } : m)),
    }));
    toast.success('Role updated', `Member role changed to ${role}`);
  },

  updateMemberStatus: (memberId, status, currentTask) => {
    set((state) => ({
      members: state.members.map((m) =>
        m.id === memberId ? { ...m, status, currentFocusTask: currentTask } : m
      ),
    }));
  },

  createProject: (data) => {
    const activeWsId = get().activeWorkspaceId;
    const newProj: Project = {
      id: `proj-${Date.now()}`,
      workspaceId: activeWsId,
      name: data.name || 'New Engineering Project',
      key: (data.name || 'PROJ').substring(0, 3).toUpperCase(),
      description: data.description || '',
      repositoryUrl: data.repositoryUrl || '',
      members: data.members || ['m1'],
      teamIds: data.teamIds || ['t1'],
      status: 'active',
      milestones: data.milestones || [],
      createdAt: new Date().toISOString().split('T')[0],
    };
    set((state) => ({ projects: [newProj, ...state.projects] }));
    toast.success('Project created', `${newProj.name} is ready for tracking.`);
    return newProj;
  },

  createSprint: (projectId, name, startDate, endDate, goal) => {
    const activeWsId = get().activeWorkspaceId;
    const newSprint: Sprint = {
      id: `sp-${Date.now()}`,
      workspaceId: activeWsId,
      projectId,
      name,
      startDate,
      endDate,
      goal,
      status: 'active',
      capacityHours: 160,
      targetVelocity: 80,
    };
    set((state) => ({ sprints: [...state.sprints, newSprint] }));
    toast.success('Sprint created', `Sprint "${name}" is active.`);
  },

  createTask: (data) => {
    const activeWsId = get().activeWorkspaceId;
    const newTask: CollaborativeTask = {
      id: `ct-${Date.now()}`,
      workspaceId: activeWsId,
      projectId: data.projectId || get().projects[0]?.id || 'p1',
      sprintId: data.sprintId || get().sprints[0]?.id,
      title: data.title || 'Untitled Task',
      description: data.description || '',
      sprintStatus: data.sprintStatus || 'backlog',
      priority: data.priority || 'medium',
      ownerId: 'm1',
      assigneeId: data.assigneeId || 'm1',
      reviewerId: data.reviewerId,
      followerIds: ['m1'],
      labels: data.labels || ['General'],
      dependencies: [],
      estimatedHours: data.estimatedHours || 8,
      actualHours: 0,
      subtasks: [],
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };
    set((state) => ({ tasks: [newTask, ...state.tasks] }));
    toast.success('Task created', newTask.title);
    return newTask;
  },

  updateTaskStatus: (taskId, sprintStatus) => {
    set((state) => {
      const task = state.tasks.find((t) => t.id === taskId);
      if (!task) return state;

      const newActivities = [...state.activities];
      if (sprintStatus === 'done') {
        newActivities.unshift({
          id: `act-${Date.now()}`,
          workspaceId: state.activeWorkspaceId,
          actor: { id: 'm1', name: 'Ajay Kumar' },
          type: 'task_completed',
          title: 'completed task',
          detail: task.title,
          timestamp: new Date().toISOString(),
        });
      }

      return {
        tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, sprintStatus, updatedAt: new Date().toISOString() } : t)),
        activities: newActivities,
      };
    });
    toast.info('Status updated', `Task moved to ${sprintStatus.replace('_', ' ').toUpperCase()}`);
  },

  updateGitContext: (taskId, gitData) => {
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              gitContext: { ...t.gitContext, ...gitData },
              updatedAt: new Date().toISOString(),
            }
          : t
      ),
    }));
    toast.success('Git details linked');
  },

  addComment: (targetType, targetId, content, parentCommentId) => {
    const newComment: DiscussionComment = {
      id: `comm-${Date.now()}`,
      workspaceId: get().activeWorkspaceId,
      targetType,
      targetId,
      author: { id: 'm1', name: 'Ajay Kumar' },
      content,
      createdAt: new Date().toISOString(),
      reactions: {},
      replies: [],
    };

    set((state) => {
      if (parentCommentId) {
        return {
          discussions: state.discussions.map((c) =>
            c.id === parentCommentId ? { ...c, replies: [...c.replies, newComment] } : c
          ),
        };
      }
      return { discussions: [newComment, ...state.discussions] };
    });
    toast.success('Comment posted');
  },

  addReaction: (commentId, emoji) => {
    set((state) => ({
      discussions: state.discussions.map((c) => {
        if (c.id === commentId) {
          const current = c.reactions[emoji] || [];
          const updated = current.includes('m1')
            ? current.filter((id) => id !== 'm1')
            : [...current, 'm1'];
          return {
            ...c,
            reactions: { ...c.reactions, [emoji]: updated },
          };
        }
        return c;
      }),
    }));
  },

  resolveThread: (commentId) => {
    set((state) => ({
      discussions: state.discussions.map((c) =>
        c.id === commentId ? { ...c, isResolved: !c.isResolved } : c
      ),
    }));
    toast.info('Discussion thread updated');
  },

  markNotificationRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }));
  },

  markAllNotificationsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    }));
    toast.info('All notifications marked as read');
  },

  createDoc: (title, category, content, tags) => {
    const newDoc: KnowledgeDoc = {
      id: `doc-${Date.now()}`,
      workspaceId: get().activeWorkspaceId,
      title,
      category,
      content,
      authorId: 'm1',
      version: 1,
      tags,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    };
    set((state) => ({ docs: [newDoc, ...state.docs] }));
    toast.success('Doc created', title);
    return newDoc;
  },

  updateDoc: (id, title, content, tags) => {
    set((state) => ({
      docs: state.docs.map((d) =>
        d.id === id
          ? {
              ...d,
              title,
              content,
              tags,
              version: d.version + 1,
              updatedAt: new Date().toISOString().split('T')[0],
            }
          : d
      ),
    }));
    toast.success('Doc updated', `Saved version ${get().docs.find((d) => d.id === id)?.version || 1}`);
  },

  createBlocker: (title, severity, impactDescription, taskId) => {
    const newBlocker: CentralBlocker = {
      id: `blk-${Date.now()}`,
      workspaceId: get().activeWorkspaceId,
      taskId,
      title,
      severity,
      ownerId: 'm1',
      reporterId: 'm1',
      status: 'open',
      impactDescription,
      createdAt: new Date().toISOString(),
    };
    set((state) => ({ blockers: [newBlocker, ...state.blockers] }));
    toast.error('Blocker reported', `${title} (${severity.toUpperCase()})`);
  },

  resolveBlocker: (id) => {
    set((state) => ({
      blockers: state.blockers.map((b) =>
        b.id === id
          ? { ...b, status: 'resolved', resolvedAt: new Date().toISOString() }
          : b
      ),
    }));
    toast.success('Blocker resolved');
  },

  createEvent: (title, type, date, color) => {
    const newEv: TeamCalendarEvent = {
      id: `ev-${Date.now()}`,
      workspaceId: get().activeWorkspaceId,
      title,
      type,
      date,
      color,
    };
    set((state) => ({ events: [...state.events, newEv] }));
    toast.success('Calendar event added');
  },

  globalSearch: (query) => {
    const q = query.toLowerCase().trim();
    if (!q) return { projects: [], tasks: [], members: [], docs: [], blockers: [] };

    const state = get();
    const wsId = state.activeWorkspaceId;

    return {
      projects: state.projects.filter(
        (p) => p.workspaceId === wsId && (p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
      ),
      tasks: state.tasks.filter(
        (t) =>
          t.workspaceId === wsId &&
          (t.title.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q) ||
            t.gitContext?.branch?.toLowerCase().includes(q))
      ),
      members: state.members.filter(
        (m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || m.teams.some((t) => t.toLowerCase().includes(q))
      ),
      docs: state.docs.filter(
        (d) => d.workspaceId === wsId && (d.title.toLowerCase().includes(q) || d.content.toLowerCase().includes(q))
      ),
      blockers: state.blockers.filter(
        (b) => b.workspaceId === wsId && (b.title.toLowerCase().includes(q) || b.impactDescription.toLowerCase().includes(q))
      ),
    };
  },
}));
