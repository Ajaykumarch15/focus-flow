import { create } from 'zustand';
import {
  Workspace, WorkspaceTeam, WorkspaceMember, Project, Feature,
  Sprint, CollaborativeTask, WorkspaceActivity, DiscussionComment,
  NotificationItem, KnowledgeDoc, CentralBlocker, TeamCalendarEvent,
  SprintStatus, BlockerSeverity, DocCategory, EventType, MemberRole
} from '../types/collaboration';
import { toast } from './useToastStore';
import { api } from '../utils/api';
import { runMutation } from '../utils/mutation';
import { useAuthStore } from './useAuthStore';

// IES-R1 (P5-T4): real authenticated user identity — replaces the hardcoded
// `'m1'` mock owner/author ids. Empty string when offline / not signed in.
function currentUserId(): string {
  return useAuthStore.getState().user?._id ?? '';
}

function currentUserName(): string {
  return useAuthStore.getState().user?.name ?? 'Unknown';
}

// ── API → frontend shape mappers (IES-P2-07: server docs → client models) ─────
const DEFAULT_WORKSPACE_SETTINGS: Workspace['settings'] = {
  allowMemberInvites: true,
  requireReviewForDone: false,
  autoSyncTimerWorkLogs: true,
  defaultVisibility: 'Workspace',
};

function workspaceIconFor(type: string): string {
  switch (type) {
    case 'Personal': return '🚀';
    case 'Startup': return '⚡';
    case 'Enterprise': return '🏢';
    case 'Open Source': return '🌐';
    case 'College Project': return '🎓';
    case 'Internship': return '💼';
    default: return '🚀';
  }
}

function toWorkspace(raw: any): Workspace {
  return {
    id: String(raw.id ?? raw._id ?? ''),
    name: raw.name ?? 'Untitled Workspace',
    type: raw.type ?? 'Startup',
    icon: raw.icon ?? '🚀',
    description: raw.description ?? '',
    membersCount: Number(raw.membersCount ?? 0),
    projectsCount: Number(raw.projectsCount ?? 0),
    createdAt: raw.createdAt ?? new Date().toISOString(),
    settings: {
      allowMemberInvites: raw.settings?.allowMemberInvites ?? DEFAULT_WORKSPACE_SETTINGS.allowMemberInvites,
      requireReviewForDone: raw.settings?.requireReviewForDone ?? DEFAULT_WORKSPACE_SETTINGS.requireReviewForDone,
      autoSyncTimerWorkLogs: raw.settings?.autoSyncTimerWorkLogs ?? DEFAULT_WORKSPACE_SETTINGS.autoSyncTimerWorkLogs,
      defaultVisibility: raw.settings?.defaultVisibility ?? DEFAULT_WORKSPACE_SETTINGS.defaultVisibility,
    },
  };
}

function toMember(raw: any): WorkspaceMember {
  return {
    id: String(raw.id ?? raw._id ?? ''),
    name: raw.name ?? 'Unknown Member',
    email: raw.email ?? '',
    avatar: raw.avatar,
    role: raw.role ?? 'Developer',
    teams: raw.teams ?? [],
    status: 'available',
    currentFocusTask: undefined,
    currentFocusTimeMs: undefined,
    joinedAt: raw.joinedAt ? new Date(raw.joinedAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
  };
}

function toTeam(raw: any): WorkspaceTeam {
  return {
    id: String(raw._id ?? raw.id ?? ''),
    name: raw.name ?? 'Untitled Team',
    description: raw.description ?? '',
    memberIds: (raw.members ?? []).map((m: any) => String(m._id ?? m.id ?? m)),
    color: raw.color ?? '#0ea5e9',
    leaderId: raw.leaderId ? String(raw.leaderId) : undefined,
  };
}

function toProject(raw: any): Project {
  return {
    id: String(raw._id ?? raw.id ?? ''),
    workspaceId: raw.workspaceRef ? String(raw.workspaceRef) : '',
    name: raw.name ?? 'Untitled Project',
    key: raw.nameKey ? raw.nameKey.toUpperCase() : (raw.name || 'PRJ').substring(0, 3).toUpperCase(),
    description: raw.description ?? '',
    repositoryUrl: raw.repositoryUrl,
    members: (raw.members ?? []).map((m: any) => String(m._id ?? m.id ?? m)),
    teamIds: (raw.teamIds ?? []).map(String),
    status: raw.status ?? 'active',
    milestones: raw.milestones ?? [],
    createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
  };
}

// ── IES-R1 (P5-T1): sprint/feature/collab-task mappers (mirror toProject) ──────
function toSprint(raw: any): Sprint {
  return {
    id: String(raw._id ?? raw.id ?? ''),
    workspaceId: raw.workspaceRef ? String(raw.workspaceRef) : '',
    projectId: raw.projectRef ? String(raw.projectRef) : '',
    name: raw.name ?? 'Untitled Sprint',
    startDate: raw.startDate ? new Date(raw.startDate).toISOString().slice(0, 10) : '',
    endDate: raw.endDate ? new Date(raw.endDate).toISOString().slice(0, 10) : '',
    goal: raw.goal ?? '',
    status: raw.status ?? 'future',
    capacityHours: Number(raw.capacityHours ?? 0),
    targetVelocity: Number(raw.targetVelocity ?? 0),
    actualVelocity: raw.actualVelocity != null ? Number(raw.actualVelocity) : undefined,
  };
}

function toFeature(raw: any): Feature {
  return {
    id: String(raw._id ?? raw.id ?? ''),
    projectId: raw.projectRef ? String(raw.projectRef) : '',
    sprintId: raw.sprintRef ? String(raw.sprintRef) : undefined,
    workspaceId: raw.workspaceRef ? String(raw.workspaceRef) : '',
    name: raw.name ?? 'Untitled Feature',
    description: raw.description ?? '',
    type: raw.type ?? 'feature',
    labels: (raw.labels ?? []).map(String),
    ownerId: raw.ownerId ? String(raw.ownerId) : undefined,
    estimatedHours: Number(raw.estimatedHours ?? 0),
    status: raw.status ?? 'backlog',
    order: Number(raw.order ?? 0),
    createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
  };
}

function toCollabTask(raw: any): CollaborativeTask {
  return {
    id: String(raw._id ?? raw.id ?? ''),
    workspaceId: raw.workspaceRef ? String(raw.workspaceRef) : '',
    projectId: raw.projectRef ? String(raw.projectRef) : '',
    sprintId: raw.sprintRef ? String(raw.sprintRef) : undefined,
    featureId: raw.featureRef ? String(raw.featureRef) : undefined,
    title: raw.title ?? 'Untitled Task',
    description: raw.description ?? '',
    sprintStatus: raw.sprintStatus ?? 'backlog',
    priority: raw.priority ?? 'medium',
    ownerId: String(raw.ownerId ?? raw.userId ?? ''),
    assigneeId: raw.assigneeId ? String(raw.assigneeId) : undefined,
    reviewerId: raw.reviewerId ? String(raw.reviewerId) : undefined,
    followerIds: (raw.followerIds ?? []).map(String),
    labels: (raw.labels ?? []).map(String),
    dependencies: (raw.dependencies ?? []).map(String),
    estimatedHours: Number(raw.estimatedHours ?? 0),
    actualHours: Number(raw.actualHours ?? 0),
    gitContext: raw.gitContext ?? undefined,
    subtasks: Array.isArray(raw.subtasks)
      ? raw.subtasks.map((s: any) => ({
          id: String(s._id ?? s.id ?? ''),
          title: s.title ?? '',
          completed: Boolean(s.completed),
        }))
      : [],
    createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
  };
}

// ── Interface & State ──────────────────────────────────────────────────────────
interface CollaborationStore {
  workspaces: Workspace[];
  workspacesLoading: boolean;
  activeWorkspaceId: string;
  members: WorkspaceMember[];
  teams: WorkspaceTeam[];
  projects: Project[];
  sprints: Sprint[];
  features: Feature[];
  tasks: CollaborativeTask[];
  activities: WorkspaceActivity[];
  activityLoading: boolean;
  activityHasMore: boolean;
  activityNextCursor: string | null;
  discussions: DiscussionComment[];
  notifications: NotificationItem[];
  notificationsLoading: boolean;
  notificationsHasMore: boolean;
  notificationsNextCursor: string | null;
  docs: KnowledgeDoc[];
  blockers: CentralBlocker[];
  events: TeamCalendarEvent[];

  // Loaders (IES-P2-07: real data replaces the removed seed).
  loadWorkspaces: () => Promise<void>;
  loadMembers: (workspaceId: string) => Promise<void>;
  loadTeams: () => Promise<void>;
  loadProjects: () => Promise<void>;
  loadSprints: () => Promise<void>;
  loadFeatures: () => Promise<void>;
  loadTasks: () => Promise<void>;
  loadCollabData: () => Promise<void>;

  // Actions
  setActiveWorkspace: (id: string) => void;
  updateWorkspaceSettings: (workspaceId: string, settings: Partial<Workspace['settings']>) => Promise<void>;
  createWorkspace: (name: string, type: any, description: string) => Promise<Workspace | undefined>;
  createTeam: (name: string, description: string, color: string, memberIds: string[]) => Promise<void>;
  updateMemberRole: (memberId: string, role: MemberRole) => Promise<void>;
  updateMemberStatus: (memberId: string, status: any, currentTask?: string) => void;

  // Project & Sprint Actions
  createProject: (data: Partial<Project>) => Promise<Project | undefined>;
  createFeature: (data: Partial<Feature>) => Promise<Feature | undefined>;
  createSprint: (projectId: string, name: string, startDate: string, endDate: string, goal: string, opts?: { capacityHours?: number; targetVelocity?: number }) => Promise<Sprint | undefined>;
  createTask: (data: Partial<CollaborativeTask>) => Promise<CollaborativeTask | undefined>;
  updateTaskStatus: (taskId: string, sprintStatus: SprintStatus) => Promise<void>;
  // IES-R1 (P6-T3): drag a feature into/out of a Sprint (backlog ⇄ sprintRef).
  // `null` un-tethers the feature (back to the Project Backlog).
  moveFeature: (featureId: string, sprintId: string | null) => Promise<void>;
  updateGitContext: (taskId: string, gitData: Partial<CollaborativeTask['gitContext']>) => Promise<void>;

  // Discussions & Comments
  addComment: (targetType: 'task' | 'worklog' | 'project' | 'doc', targetId: string, content: string, parentCommentId?: string) => void;
  addReaction: (commentId: string, emoji: string) => void;
  resolveThread: (commentId: string) => void;

  // Notifications (IES-P2-05: real, user-scoped — no more seed data)
  loadNotifications: (opts?: { limit?: number; cursor?: string; append?: boolean }) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;

  // Knowledge Base & Blockers & Calendar
  createDoc: (title: string, category: DocCategory, content: string, tags: string[]) => KnowledgeDoc;
  updateDoc: (id: string, title: string, content: string, tags: string[]) => void;
  createBlocker: (title: string, severity: BlockerSeverity, impactDescription: string, taskId?: string) => void;
  resolveBlocker: (id: string) => void;
  createEvent: (title: string, type: EventType, date: string, color: string) => void;

  // IES-P2-04: real workspace activity feed
  loadWorkspaceActivity: (workspaceId: string, opts?: { limit?: number; cursor?: string; append?: boolean }) => Promise<void>;
}

export const useCollaborationStore = create<CollaborationStore>((set, get) => ({
  workspaces: [],
  workspacesLoading: false,
  activeWorkspaceId: '',
  members: [],
  teams: [],
  projects: [],
  sprints: [],
  features: [],
  tasks: [],
  activities: [],
  activityLoading: false,
  activityHasMore: false,
  activityNextCursor: null,
  discussions: [],
  notifications: [],
  notificationsLoading: false,
  notificationsHasMore: false,
  notificationsNextCursor: null,
  docs: [],
  blockers: [],
  events: [],

  // ── Loaders ─────────────────────────────────────────────────────────────────
  loadWorkspaces: async () => {
    set({ workspacesLoading: true });
    try {
      const rawList = await api.workspaces.list();
      const workspaces = (Array.isArray(rawList) ? rawList : []).map(toWorkspace);
      set((state) => {
        const stillValid = workspaces.some((w) => w.id === state.activeWorkspaceId);
        return {
          workspaces,
          activeWorkspaceId: stillValid ? state.activeWorkspaceId : workspaces[0]?.id ?? '',
        };
      });
    } catch {
      // IES-P2-07: a failed fetch must never crash the workspace pages (offline).
      set({ workspaces: [], activeWorkspaceId: '' });
    } finally {
      set({ workspacesLoading: false });
    }
  },

  loadMembers: async (workspaceId) => {
    if (!workspaceId) {
      set({ members: [] });
      return;
    }
    try {
      const rawList = await api.workspaces.members(workspaceId);
      set({ members: (Array.isArray(rawList) ? rawList : []).map(toMember) });
    } catch {
      set({ members: [] });
    }
  },

  loadTeams: async () => {
    const workspaceId = get().activeWorkspaceId;
    try {
      const rawList = await api.teams.list();
      set({
        teams: (Array.isArray(rawList) ? rawList : [])
          .filter((t: any) => !workspaceId || String(t.workspaceRef ?? t.workspaceId ?? '') === workspaceId)
          .map(toTeam),
      });
    } catch {
      set({ teams: [] });
    }
  },

  loadProjects: async () => {
    const workspaceId = get().activeWorkspaceId;
    if (!workspaceId) {
      set({ projects: [] });
      return;
    }
    try {
      const rawList = await api.projects.list(workspaceId);
      set({ projects: (Array.isArray(rawList) ? rawList : []).map(toProject) });
    } catch {
      set({ projects: [] });
    }
  },

  // ── IES-R1 (P5-T2): sprint/feature/task loaders (workspace-keyed, offline-safe).
  loadSprints: async () => {
    const projects = get().projects;
    if (!projects.length) {
      set({ sprints: [] });
      return;
    }
    try {
      const lists = await Promise.all(
        projects.map((p) => api.sprints.list(p.id).catch(() => [] as Sprint[])),
      );
      set({ sprints: lists.flat().map(toSprint) });
    } catch {
      set({ sprints: [] });
    }
  },

  loadFeatures: async () => {
    const projects = get().projects;
    if (!projects.length) {
      set({ features: [] });
      return;
    }
    try {
      const lists = await Promise.all(
        projects.map((p) => api.features.list({ projectId: p.id }).catch(() => [] as Feature[])),
      );
      set({ features: lists.flat().map(toFeature) });
    } catch {
      set({ features: [] });
    }
  },

  loadTasks: async () => {
    const workspaceId = get().activeWorkspaceId;
    if (!workspaceId) {
      set({ tasks: [] });
      return;
    }
    try {
      const rawList = await api.tasks.list({ workspaceId });
      set({ tasks: (Array.isArray(rawList) ? rawList : []).map(toCollabTask) });
    } catch {
      set({ tasks: [] });
    }
  },

  loadCollabData: async () => {
    await get().loadWorkspaces();
    await Promise.all([
      get().loadMembers(get().activeWorkspaceId),
      get().loadTeams(),
    ]);
    await get().loadProjects();
    await Promise.all([
      get().loadSprints(),
      get().loadFeatures(),
      get().loadTasks(),
    ]);
  },

  // ── Actions ─────────────────────────────────────────────────────────────────
  setActiveWorkspace: (id) => {
    set({ activeWorkspaceId: id });
    const ws = get().workspaces.find(w => w.id === id);
    if (ws) toast.info(`Switched to workspace: ${ws.name}`);
  },

  updateWorkspaceSettings: async (workspaceId, settings) => {
    const prev = get().workspaces.find((w) => w.id === workspaceId)?.settings;
    await runMutation(
      () => {
        set((state) => ({
          workspaces: state.workspaces.map((w) =>
            w.id === workspaceId ? { ...w, settings: { ...w.settings, ...settings } } : w
          ),
        }));
        return () => {
          set((state) => ({
            workspaces: state.workspaces.map((w) =>
              w.id === workspaceId && prev ? { ...w, settings: prev } : w
            ),
          }));
        };
      },
      () => api.workspaces.update(workspaceId, { settings }),
      { errorTitle: 'Settings save failed' },
    );
  },

  createWorkspace: async (name, type, description) => {
    const tempId = `ws-tmp-${Date.now()}`;
    const prevActive = get().activeWorkspaceId;
    const temp: Workspace = {
      id: tempId,
      name,
      type,
      icon: workspaceIconFor(type),
      description,
      membersCount: 1,
      projectsCount: 0,
      createdAt: new Date().toISOString(),
      settings: { ...DEFAULT_WORKSPACE_SETTINGS },
    };
    const created = await runMutation(
      () => {
        set((state) => ({ workspaces: [temp, ...state.workspaces], activeWorkspaceId: tempId }));
        return () => {
          set((state) => ({
            workspaces: state.workspaces.filter((w) => w.id !== tempId),
            activeWorkspaceId: prevActive,
          }));
        };
      },
      () => api.workspaces.create({ name, type, description }),
      { errorTitle: 'Workspace creation failed' },
    );
    if (!created) return undefined;
    const ws = toWorkspace(created);
    set((state) => ({
      workspaces: state.workspaces.map((w) => (w.id === tempId ? ws : w)),
      activeWorkspaceId: ws.id,
    }));
    toast.success('Workspace created', `You are now in ${ws.name}`);
    return ws;
  },

  createTeam: async (name, description, color, memberIds) => {
    const tempId = `team-${Date.now()}`;
    const temp: WorkspaceTeam = {
      id: tempId,
      name,
      description,
      memberIds,
      color,
      leaderId: memberIds[0],
    };
    const created = await runMutation(
      () => {
        set((state) => ({ teams: [...state.teams, temp] }));
        return () => set((state) => ({ teams: state.teams.filter((t) => t.id !== tempId) }));
      },
      () => api.teams.create({ name, description, members: memberIds, color, workspaceId: get().activeWorkspaceId || undefined }),
      { errorTitle: 'Team creation failed' },
    );
    if (!created) return;
    const team = toTeam(created);
    set((state) => ({
      teams: state.teams.map((t) => (t.id === tempId ? team : t)),
    }));
    toast.success(`Team ${team.name} created`);
  },

  updateMemberRole: async (memberId, role) => {
    const workspaceId = get().activeWorkspaceId;
    if (!workspaceId) return;
    const prevRole = get().members.find((m) => m.id === memberId)?.role;
    await runMutation(
      () => {
        set((state) => ({
          members: state.members.map((m) => (m.id === memberId ? { ...m, role } : m)),
        }));
        return () => {
          set((state) => ({
            members: state.members.map((m) =>
              m.id === memberId && prevRole ? { ...m, role: prevRole } : m
            ),
          }));
        };
      },
      () => api.workspaces.setRole(workspaceId, memberId, role),
      { errorTitle: 'Role update failed' },
    );
  },

  updateMemberStatus: (memberId, status, currentTask) => {
    set((state) => ({
      members: state.members.map((m) =>
        m.id === memberId ? { ...m, status, currentFocusTask: currentTask } : m
      ),
    }));
  },

  createProject: async (data) => {
    const activeWsId = get().activeWorkspaceId;
    const tempId = `proj-${Date.now()}`;
    const prevProjects = get().projects;
    const temp: Project = {
      id: tempId,
      workspaceId: activeWsId,
      name: data.name || 'New Engineering Project',
      key: (data.name || 'PROJ').substring(0, 3).toUpperCase(),
      description: data.description || '',
      repositoryUrl: data.repositoryUrl || '',
      members: data.members || [],
      teamIds: data.teamIds || [],
      status: 'active',
      milestones: data.milestones || [],
      createdAt: new Date().toISOString().slice(0, 10),
    };
    const created = await runMutation(
      () => {
        set((state) => ({ projects: [temp, ...state.projects] }));
        return () => set({ projects: prevProjects });
      },
      () => api.projects.create({ name: temp.name, workspaceId: activeWsId || undefined }),
      { errorTitle: 'Project creation failed' },
    );
    if (!created) return undefined;
    const project = toProject(created);
    set((state) => ({
      projects: state.projects.map((p) => (p.id === tempId ? project : p)),
    }));
    toast.success('Project created', `${project.name} is ready for tracking.`);
    return project;
  },

  // IES-R1 (P6-T5/UX-R1): create a backlog feature (sprintRef stays null). Real
  // owner comes from the modal's member picker; falls back to the auth user.
  createFeature: async (data) => {
    const activeWsId = get().activeWorkspaceId;
    const tempId = `ft-${Date.now()}`;
    const prevFeatures = get().features;
    const temp: Feature = {
      id: tempId,
      workspaceId: activeWsId,
      projectId: data.projectId || '',
      name: data.name || 'Untitled Feature',
      description: data.description || '',
      type: data.type || 'feature',
      labels: data.labels || [],
      ownerId: data.ownerId || currentUserId(),
      estimatedHours: data.estimatedHours || 0,
      status: data.status || 'backlog',
      order: data.order ?? 0,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    const created = await runMutation(
      () => {
        set((state) => ({ features: [temp, ...state.features] }));
        return () => set({ features: prevFeatures });
      },
      () => api.features.create({
        projectId: temp.projectId,
        name: temp.name,
        description: temp.description,
        type: temp.type,
        labels: temp.labels,
        ownerId: temp.ownerId || undefined,
        estimatedHours: temp.estimatedHours,
        status: temp.status,
        order: temp.order,
      }),
      { errorTitle: 'Feature creation failed' },
    );
    if (!created) return undefined;
    const feature = toFeature(created);
    set((state) => ({ features: state.features.map((f) => (f.id === tempId ? feature : f)) }));
    toast.success('Feature created', feature.name);
    return feature;
  },

  createSprint: async (projectId, name, startDate, endDate, goal, opts) => {
    const activeWsId = get().activeWorkspaceId;
    const capacityHours = opts?.capacityHours ?? 160;
    const targetVelocity = opts?.targetVelocity ?? 80;
    const tempId = `sp-${Date.now()}`;
    const prevSprints = get().sprints;
    const temp: Sprint = {
      id: tempId,
      workspaceId: activeWsId,
      projectId,
      name,
      startDate,
      endDate,
      goal,
      status: 'future',
      capacityHours,
      targetVelocity,
    };
    const created = await runMutation(
      () => {
        set((state) => ({ sprints: [...state.sprints, temp] }));
        return () => set({ sprints: prevSprints });
      },
      () => api.sprints.create({ projectId, name, startDate, endDate, goal, capacityHours, targetVelocity }),
      { errorTitle: 'Sprint creation failed' },
    );
    if (!created) return undefined;
    const sprint = toSprint(created);
    set((state) => ({ sprints: state.sprints.map((s) => (s.id === tempId ? sprint : s)) }));
    toast.success('Sprint created', name);
    return sprint;
  },

  createTask: async (data) => {
    const activeWsId = get().activeWorkspaceId;
    const ownerId = currentUserId();
    const tempId = `ct-${Date.now()}`;
    const prevTasks = get().tasks;
    const tempTask: CollaborativeTask = {
      id: tempId,
      workspaceId: activeWsId,
      projectId: data.projectId || '',
      sprintId: data.sprintId || get().sprints[0]?.id,
      featureId: data.featureId,
      title: data.title || 'Untitled Task',
      description: data.description || '',
      sprintStatus: data.sprintStatus || 'backlog',
      priority: data.priority || 'medium',
      ownerId,
      assigneeId: data.assigneeId || ownerId,
      reviewerId: data.reviewerId,
      followerIds: ownerId ? [ownerId] : [],
      labels: data.labels || ['General'],
      dependencies: data.dependencies || [],
      estimatedHours: data.estimatedHours || 8,
      actualHours: data.actualHours || 0,
      gitContext: data.gitContext,
      subtasks: data.subtasks || [],
      createdAt: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    const created = await runMutation(
      () => {
        set((state) => ({ tasks: [tempTask, ...state.tasks] }));
        return () => set({ tasks: prevTasks });
      },
      () => api.tasks.create({
        title: tempTask.title,
        description: tempTask.description,
        priority: tempTask.priority,
        status: 'todo',
        category: 'Work',
        color: '#0ea5e9',
        tags: [],
        subtasks: [],
        workspaceId: activeWsId || undefined,
        projectId: tempTask.projectId || undefined,
        sprintId: tempTask.sprintId || undefined,
        featureId: tempTask.featureId || undefined,
        assigneeId: tempTask.assigneeId || undefined,
        reviewerId: tempTask.reviewerId || undefined,
        followerIds: tempTask.followerIds,
        labels: tempTask.labels,
        dependencies: tempTask.dependencies,
        estimatedHours: tempTask.estimatedHours,
        actualHours: tempTask.actualHours,
        sprintStatus: tempTask.sprintStatus,
      }),
      { errorTitle: 'Task creation failed' },
    );
    if (!created) return undefined;
    const task = toCollabTask(created);
    set((state) => ({ tasks: state.tasks.map((t) => (t.id === tempId ? task : t)) }));
    toast.success('Task created', task.title);
    return task;
  },

  updateTaskStatus: async (taskId, sprintStatus) => {
    const prevTask = get().tasks.find((t) => t.id === taskId);
    await runMutation(
      () => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId ? { ...t, sprintStatus, updatedAt: new Date().toISOString() } : t
          ),
        }));
        return () => {
          set((state) => ({
            tasks: state.tasks.map((t) =>
              t.id === taskId && prevTask
                ? { ...t, sprintStatus: prevTask.sprintStatus, updatedAt: prevTask.updatedAt }
                : t
            ),
          }));
        };
      },
      () => api.tasks.update(taskId, { sprintStatus }),
      { errorTitle: 'Status update failed' },
    );
    toast.info('Status updated', `Task moved to ${sprintStatus.replace('_', ' ').toUpperCase()}`);
  },

  // IES-R1 (P6-T3): moveFeature persists the sprintRef change via
  // `PATCH /features/:id { sprintId }` (server validates same-project). Dropping
  // back onto the Backlog sends `sprintId: null` (explicit un-tether).
  moveFeature: async (featureId, sprintId) => {
    const prevFeature = get().features.find((f) => f.id === featureId);
    await runMutation(
      () => {
        set((state) => ({
          features: state.features.map((f) =>
            f.id === featureId
              ? { ...f, sprintId: sprintId ?? undefined }
              : f
          ),
        }));
        return () => {
          set((state) => ({
            features: state.features.map((f) =>
              f.id === featureId && prevFeature
                ? { ...f, sprintId: prevFeature.sprintId }
                : f
            ),
          }));
        };
      },
      () => api.features.update(featureId, { sprintId }),
      { errorTitle: 'Feature move failed' },
    );
  },

  updateGitContext: async (taskId, gitData) => {
    const prevTask = get().tasks.find((t) => t.id === taskId);
    await runMutation(
      () => {
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
        return () => {
          set((state) => ({
            tasks: state.tasks.map((t) =>
              t.id === taskId && prevTask
                ? { ...t, gitContext: prevTask.gitContext, updatedAt: prevTask.updatedAt }
                : t
            ),
          }));
        };
      },
      () => api.tasks.patchGit(taskId, gitData ?? {}),
      { errorTitle: 'Git details save failed' },
    );
    toast.success('Git details linked');
  },

  addComment: (targetType, targetId, content, parentCommentId) => {
    const newComment: DiscussionComment = {
      id: `comm-${Date.now()}`,
      workspaceId: get().activeWorkspaceId,
      targetType,
      targetId,
      author: { id: currentUserId(), name: currentUserName() },
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
    const me = currentUserId();
    set((state) => ({
      discussions: state.discussions.map((c) => {
        if (c.id === commentId) {
          const current = c.reactions[emoji] || [];
          const updated = current.includes(me)
            ? current.filter((id) => id !== me)
            : [...current, me];
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

  loadNotifications: async (opts) => {
    set({ notificationsLoading: true });
    try {
      const page = await api.notifications.list({
        limit: opts?.limit,
        cursor: opts?.cursor,
        unreadOnly: opts?.append ? undefined : false,
      });
      const items: NotificationItem[] = page.items.map((it: any) => ({
        id: String(it.id),
        workspaceId: it.workspaceId ?? '',
        recipientId: it.recipientId ?? '',
        actor: {
          id: String(it.actor?.id ?? ''),
          name: it.actor?.name ?? 'Unknown',
          avatar: it.actor?.avatar,
        },
        type: it.type,
        title: it.title,
        body: it.body ?? '',
        targetUrl: it.targetUrl,
        createdAt: it.createdAt,
        read: Boolean(it.read),
      }));
      set((state) => ({
        notifications: opts?.append ? [...state.notifications, ...items] : items,
        notificationsHasMore: page.hasMore,
        notificationsNextCursor: page.nextCursor,
      }));
    } catch {
      // IES-P2-05: a failed feed must never crash the header (demo/offline).
      if (!opts?.append) set({ notifications: [], notificationsHasMore: false, notificationsNextCursor: null });
    } finally {
      set({ notificationsLoading: false });
    }
  },

  markNotificationRead: async (id) => {
    // Optimistic local flip; the server round-trip is fire-and-forget so the UI
    // reflects the read state immediately and heals on the next poll.
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }));
    try {
      await api.notifications.markRead(id);
    } catch {
      // Re-sync on the next poll — never block the UI on a failed mark.
    }
  },

  markAllNotificationsRead: async () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    }));
    try {
      await api.notifications.markAllRead();
    } catch {
      // Re-sync on the next poll — never block the UI on a failed mark.
    }
  },

  createDoc: (title, category, content, tags) => {
    const newDoc: KnowledgeDoc = {
      id: `doc-${Date.now()}`,
      workspaceId: get().activeWorkspaceId,
      title,
      category,
      content,
      authorId: currentUserId(),
      version: 1,
      tags,
      createdAt: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString().slice(0, 10),
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
              updatedAt: new Date().toISOString().slice(0, 10),
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
      ownerId: currentUserId(),
      reporterId: currentUserId(),
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

  loadWorkspaceActivity: async (workspaceId, opts) => {
    set({ activityLoading: true });
    try {
      const page = await api.workspaces.activity(workspaceId, opts?.limit, opts?.cursor);
      const items: WorkspaceActivity[] = page.items.map((it: any) => ({
        id: String(it._id),
        workspaceId: String(it.workspaceRef),
        actor: {
          id: String(it.userId?._id ?? ''),
          name: it.userId?.name ?? 'Unknown',
          email: it.userId?.email,
          avatar: it.userId?.avatar,
        },
        action: it.action,
        details: it.details ?? {},
        timestamp: it.createdAt,
      }));
      set((state) => ({
        activities: opts?.append ? [...state.activities, ...items] : items,
        activityHasMore: page.hasMore,
        activityNextCursor: page.nextCursor,
      }));
    } catch {
      // IES-P2-04: a failed feed must never crash the page (demo/offline).
      if (!opts?.append) set({ activities: [], activityHasMore: false, activityNextCursor: null });
    } finally {
      set({ activityLoading: false });
    }
  },
}));
