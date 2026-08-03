import { create } from 'zustand';
import {
  Workspace, WorkspaceTeam, WorkspaceMember, Project,
  Sprint, CollaborativeTask, WorkspaceActivity, DiscussionComment,
  NotificationItem, KnowledgeDoc, CentralBlocker, TeamCalendarEvent,
  SprintStatus, BlockerSeverity, DocCategory, EventType, MemberRole
} from '../types/collaboration';
import { toast } from './useToastStore';
import { api } from '../utils/api';
import { runMutation } from '../utils/mutation';

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

// ── Interface & State ──────────────────────────────────────────────────────────
interface CollaborationStore {
  workspaces: Workspace[];
  workspacesLoading: boolean;
  activeWorkspaceId: string;
  members: WorkspaceMember[];
  teams: WorkspaceTeam[];
  projects: Project[];
  sprints: Sprint[];
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
  createSprint: (projectId: string, name: string, startDate: string, endDate: string, goal: string) => void;
  createTask: (data: Partial<CollaborativeTask>) => CollaborativeTask;
  updateTaskStatus: (taskId: string, sprintStatus: SprintStatus) => void;
  updateGitContext: (taskId: string, gitData: Partial<CollaborativeTask['gitContext']>) => void;

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

  loadCollabData: async () => {
    await get().loadWorkspaces();
    await Promise.all([
      get().loadMembers(get().activeWorkspaceId),
      get().loadTeams(),
      get().loadProjects(),
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
      projectId: data.projectId || '',
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
      createdAt: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    set((state) => ({ tasks: [newTask, ...state.tasks] }));
    toast.success('Task created', newTask.title);
    return newTask;
  },

  updateTaskStatus: (taskId, sprintStatus) => {
    set((state) => {
      const task = state.tasks.find((t) => t.id === taskId);
      if (!task) return state;

      return {
        tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, sprintStatus, updatedAt: new Date().toISOString() } : t)),
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
      authorId: 'm1',
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
