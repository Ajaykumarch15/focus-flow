import { useParams } from 'react-router-dom';
import { NavLink } from 'react-router-dom';
import {
  LayoutGrid, Zap, Layers, ClipboardList, Sparkles, ShieldCheck,
  AlertOctagon, Clock, LineChart, BookOpen, Calendar, FolderOpen,
  Users, UserCheck, Settings, type LucideIcon,
} from 'lucide-react';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import { getWorkspaceMaturityLevel, isFeatureVisibleForMaturity } from '../../utils/workspaceMaturity';
import type { WorkspaceMaturityLevel } from '../../utils/workspaceMaturity';

type NavKey = 'teams' | 'projects' | 'sprints' | 'qa' | 'analytics' | 'reports' | 'blockers' | 'admin';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  color: string;
  badge?: number;
  key?: NavKey;
  end?: boolean;
}

// Workspace section navigation — a single horizontal tab bar (GitHub/Linear
// style) replacing the old left sidebar. Maturity gating and live badges are
// preserved from the sidebar it replaces.
export function WorkspaceNav() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const {
    activeWorkspaceId, tasks, blockers, docs, projects, sprints,
  } = useCollaborationStore();

  const wsKey = workspaceId || activeWorkspaceId;
  const wsTasks = tasks.filter((t) => t.workspaceId === wsKey);
  const openBlockers = blockers.filter((b) => b.workspaceId === wsKey && b.status !== 'resolved');
  const wsDocs = docs.filter((d) => d.workspaceId === wsKey);
  const wsProjects = projects.filter((p) => p.workspaceId === wsKey);
  const wsSprints = sprints.filter((s) => s.workspaceId === wsKey);

  const maturityLevel: WorkspaceMaturityLevel = getWorkspaceMaturityLevel({
    membersCount: 0,
    projectsCount: wsProjects.length,
    sprintsCount: wsSprints.length,
    featuresCount: 0,
    blockersCount: openBlockers.length,
    qaTasksCount: wsTasks.filter((t) => t.sprintStatus === 'review').length,
    reportsCount: 0,
  });

  const items: NavItem[] = [
    { to: `/w/${wsKey}`, label: 'Home', icon: LayoutGrid, color: 'text-brand-400', end: true },
    { to: `/w/${wsKey}/overview`, label: 'Mission Control', icon: Zap, color: 'text-amber-400' },
    { to: `/w/${wsKey}/sprints`, label: 'Sprint Board', icon: Layers, color: 'text-brand-400', key: 'sprints', badge: wsTasks.length },
    { to: `/w/${wsKey}/backlog`, label: 'Backlog', icon: ClipboardList, color: 'text-emerald-400' },
    { to: `/w/${wsKey}/features`, label: 'Features', icon: Sparkles, color: 'text-purple-400' },
    { to: `/w/${wsKey}/qa`, label: 'QA', icon: ShieldCheck, color: 'text-indigo-400', key: 'qa' },
    { to: `/w/${wsKey}/blockers`, label: 'Blockers', icon: AlertOctagon, color: 'text-red-400', key: 'blockers', badge: openBlockers.length },
    { to: `/w/${wsKey}/activity`, label: 'Activity', icon: Clock, color: 'text-pink-400' },
    { to: `/w/${wsKey}/reports`, label: 'Reports', icon: LineChart, color: 'text-blue-400', key: 'reports' },
    { to: `/w/${wsKey}/knowledge`, label: 'Knowledge', icon: BookOpen, color: 'text-violet-400', badge: wsDocs.length },
    { to: `/w/${wsKey}/calendar`, label: 'Calendar', icon: Calendar, color: 'text-amber-300' },
    { to: `/w/${wsKey}/projects`, label: 'Projects', icon: FolderOpen, color: 'text-cyan-400', key: 'projects', badge: wsProjects.length },
    { to: `/w/${wsKey}/teams`, label: 'Teams', icon: Users, color: 'text-emerald-400', key: 'teams' },
    { to: `/w/${wsKey}/members`, label: 'Members', icon: UserCheck, color: 'text-sky-400' },
    { to: `/w/${wsKey}/settings`, label: 'Settings', icon: Settings, color: 'text-surface-400', key: 'admin' },
  ];

  const visible = items.filter((item) => !item.key || isFeatureVisibleForMaturity(item.key, maturityLevel));

  return (
    <nav aria-label="Workspace sections" className="flex-shrink-0 border-b border-surface-800 bg-surface-950/60">
      <div className="flex items-center gap-0.5 px-2 sm:px-4 overflow-x-auto no-scrollbar">
        {visible.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                isActive
                  ? 'text-surface-50 border-brand-500 bg-brand-500/5'
                  : 'text-surface-400 hover:text-surface-100 border-transparent hover:bg-surface-850/40'
              }`
            }
          >
            <item.icon size={14} className={item.color} />
            <span className="hidden sm:inline">{item.label}</span>
            {item.badge !== undefined && item.badge > 0 && (
              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-surface-800 text-surface-300">
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
