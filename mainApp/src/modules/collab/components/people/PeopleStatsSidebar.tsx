import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Zap, FolderOpen, TrendingUp } from 'lucide-react';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { useAuthStore } from '@shared/services/useAuthStore';
import { Avatar } from '@shared/components/ui/Avatar';


interface CircularProgressProps {
  value: number;
  size?: number;
  strokeWidth?: number;
}

function CircularProgress({ value, size = 120, strokeWidth = 8 }: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="rotate-[-90deg]"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-surface-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-brand-500 transition-all duration-700 ease-snappy"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-display font-extrabold text-surface-50">
          {value}%
        </span>
      </div>
    </div>
  );
}

export function PeopleStatsSidebar() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { members, projects, tasks } = useCollaborationStore();

  const currentUserMember = useMemo(
    () => members.find((m) => m.email === user?.email),
    [members, user?.email],
  );

  const stats = useMemo(() => {
    if (!currentUserMember) return { completed: 0, active: 0, projectCount: 0, productivity: 0 };
    const assigned = tasks.filter((t) => t.assigneeId === currentUserMember.id);
    const completed = assigned.filter((t) => t.sprintStatus === 'done').length;
    const active = assigned.filter(
      (t) => t.sprintStatus === 'in_progress' || t.sprintStatus === 'review',
    ).length;
    const total = completed + active;
    const productivity = total > 0 ? Math.round((completed / total) * 100) : 0;
    const projectCount = projects.filter((p) => p.members.includes(currentUserMember.id)).length;
    return { completed, active, projectCount, productivity };
  }, [currentUserMember, tasks, projects]);

  const myProjects = useMemo(() => {
    if (!currentUserMember) return [];
    return projects
      .filter((p) => p.members.includes(currentUserMember.id))
      .slice(0, 3)
      .map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
      }));
  }, [currentUserMember, projects]);

  const displayName = user?.name || currentUserMember?.name || 'Team Member';
  const displayRole = currentUserMember?.role || 'Member';

  return (
    <aside className="w-full lg:w-80 shrink-0 space-y-5">
      {/* Profile Summary */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <Avatar src={user?.avatar || currentUserMember?.avatar} name={displayName} size="md" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-surface-50 truncate">{displayName}</p>
            <p className="text-[11px] text-surface-400 truncate">{displayRole}</p>
          </div>
        </div>

        {/* Circular Productivity */}
        <div className="flex flex-col items-center gap-3 py-2">
          <CircularProgress value={stats.productivity} />
          <div className="flex items-center gap-1.5 text-success-400">
            <TrendingUp size={13} />
            <span className="text-xs font-semibold">Productivity</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-surface-850 border border-surface-800">
            <CheckCircle2 size={14} className="text-success-400" />
            <span className="text-lg font-display font-extrabold text-surface-50">
              {stats.completed}
            </span>
            <span className="text-[9px] font-semibold text-surface-400 uppercase tracking-wider">
              Done
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-surface-850 border border-surface-800">
            <Zap size={14} className="text-brand-400" />
            <span className="text-lg font-display font-extrabold text-surface-50">
              {stats.active}
            </span>
            <span className="text-[9px] font-semibold text-surface-400 uppercase tracking-wider">
              Active
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-surface-850 border border-surface-800">
            <FolderOpen size={14} className="text-info-400" />
            <span className="text-lg font-display font-extrabold text-surface-50">
              {stats.projectCount}
            </span>
            <span className="text-[9px] font-semibold text-surface-400 uppercase tracking-wider">
              Projects
            </span>
          </div>
        </div>
      </div>

      {/* My Projects */}
      <div className="card p-5 space-y-3">
        <h3 className="font-display font-bold text-surface-50 text-sm">My Projects</h3>
        <div className="space-y-2.5">
          {myProjects.length === 0 ? (
            <p className="text-xs text-surface-400 italic">No projects assigned</p>
          ) : (
            myProjects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => navigate(`/collab/team`)}
                className="w-full text-left p-3 rounded-xl bg-surface-850 border border-surface-800 hover:border-surface-700 transition-colors group"
              >
                <p className="text-xs font-bold text-surface-100 group-hover:text-brand-300 transition-colors truncate">
                  {project.name}
                </p>
                <p className="text-[10px] text-surface-500 mt-0.5 capitalize">
                  {project.status.replace('_', ' ')}
                </p>
              </button>
            ))
          )}
        </div>
        {myProjects.length > 0 && (
          <button
            type="button"
            onClick={() => navigate('/collab/team')}
            className="w-full text-center text-xs font-semibold text-brand-400 hover:text-brand-300 transition-colors py-1.5"
          >
            View all
          </button>
        )}
      </div>
    </aside>
  );
}
