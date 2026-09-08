import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import { Users, FolderOpen, CheckSquare, Map, ArrowRight, Clock, TrendingUp } from 'lucide-react';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { useRoadmapStore } from '@personal/services/useRoadmapStore';
import { Card } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import { Badge } from '@shared/components/ui/Badge';
import { Progress } from '@shared/components/ui/Progress';

const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };
const stagger = { show: { transition: { staggerChildren: 0.06 } } };

const STATUS_COLORS: Record<string, string> = {
  active: 'text-emerald-400',
  in_progress: 'text-blue-400',
  completed: 'text-brand-400',
  on_hold: 'text-amber-400',
};

export function CollabDashboard() {
  const navigate = useNavigate();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { projects, tasks, members, workspaces } = useCollaborationStore();
  const { roadmaps, loadRoadmaps } = useRoadmapStore();

  useEffect(() => {
    if (!workspaceId) return;
    useCollaborationStore.getState().loadProjects(workspaceId);
    useCollaborationStore.getState().loadTasks(workspaceId);
    useCollaborationStore.getState().loadMembers(workspaceId);
    loadRoadmaps();
  }, [workspaceId, loadRoadmaps]);

  const stats = useMemo(() => {
    const wsProjects = projects.filter((p) => p.workspaceId === workspaceId);
    const wsTasks = tasks.filter((t) => t.workspaceId === workspaceId);
    const doneTasks = wsTasks.filter((t) => t.sprintStatus === 'done').length;
    const activeTasks = wsTasks.filter((t) => t.sprintStatus === 'in_progress').length;
    const activeRoadmaps = roadmaps.filter((r) => r.status === 'active' || r.status === 'planning');

    return {
      projectCount: wsProjects.length,
      taskCount: wsTasks.length,
      doneTasks,
      activeTasks,
      memberCount: members.length,
      roadmapCount: activeRoadmaps.length,
    };
  }, [projects, tasks, members, roadmaps, workspaceId]);

  const recentProjects = useMemo(() => {
    return projects
      .filter((p) => p.workspaceId === workspaceId)
      .sort((a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime())
      .slice(0, 4);
  }, [projects, workspaceId]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-display font-extrabold text-surface-50">Collab Dashboard</h1>
          <p className="text-sm text-surface-400 mt-0.5">Work together, manage shared projects & coordinate team execution.</p>
        </div>
        <Button onClick={() => navigate(`/collab/${workspaceId}/team`)} rightIcon={<ArrowRight size={14} />}>
          View Projects
        </Button>
      </motion.div>

      {/* Stat Cards */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Projects', value: stats.projectCount, icon: FolderOpen, color: '#10b981' },
          { label: 'Shared Tasks', value: stats.taskCount, icon: CheckSquare, color: '#0ea5e9' },
          { label: 'Team Members', value: stats.memberCount, icon: Users, color: '#8b5cf6' },
          { label: 'Active Roadmaps', value: stats.roadmapCount, icon: Map, color: '#f97316' },
        ].map(({ label, value, icon: Icon, color }) => (
          <motion.div key={label} variants={fadeUp}>
            <Card className="p-4">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon size={13} style={{ color }} />
                <span className="text-[11px] text-surface-400 font-medium">{label}</span>
              </div>
              <p className="text-lg font-display font-bold text-surface-50">{value}</p>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Task Breakdown */}
      <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <motion.div variants={fadeUp}>
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-surface-300">Completion Rate</span>
              <TrendingUp size={14} className="text-emerald-400" />
            </div>
            <p className="text-2xl font-display font-extrabold text-surface-50">
              {stats.taskCount > 0 ? Math.round((stats.doneTasks / stats.taskCount) * 100) : 0}%
            </p>
            <Progress
              value={stats.taskCount > 0 ? (stats.doneTasks / stats.taskCount) * 100 : 0}
              tone="success"
              className="mt-2 h-1.5"
            />
          </Card>
        </motion.div>
        <motion.div variants={fadeUp}>
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-surface-300">In Progress</span>
              <Clock size={14} className="text-blue-400" />
            </div>
            <p className="text-2xl font-display font-extrabold text-surface-50">{stats.activeTasks}</p>
            <p className="text-[11px] text-surface-500 mt-1">tasks actively being worked on</p>
          </Card>
        </motion.div>
        <motion.div variants={fadeUp}>
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-surface-300">Completed</span>
              <CheckSquare size={14} className="text-emerald-400" />
            </div>
            <p className="text-2xl font-display font-extrabold text-surface-50">{stats.doneTasks}</p>
            <p className="text-[11px] text-surface-500 mt-1">of {stats.taskCount} total tasks</p>
          </Card>
        </motion.div>
      </motion.div>

      {/* Recent Projects */}
      {recentProjects.length > 0 && (
        <motion.div variants={stagger} initial="hidden" animate="show">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display font-bold text-surface-50 text-base">Recent Projects</h2>
            <Button variant="ghost" size="xs" onClick={() => navigate(`/collab/${workspaceId}/team`)}>
              View All
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recentProjects.map((project) => {
              const projectTasks = tasks.filter((t) => t.projectId === project.id);
              const doneCount = projectTasks.filter((t) => t.sprintStatus === 'done').length;
              const progress = projectTasks.length > 0 ? Math.round((doneCount / projectTasks.length) * 100) : 0;

              return (
                <motion.button
                  key={project.id}
                  variants={fadeUp}
                  onClick={() => navigate(`/collab/${workspaceId}/team/${project.id}`)}
                  className="card card-hover p-4 text-left group cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-surface-50 text-sm group-hover:text-brand-400 transition-colors truncate">
                      {project.name}
                    </h3>
                    <Badge tone={project.status === 'active' ? 'success' : project.status === 'in_progress' ? 'info' : 'neutral'}>
                      {project.status?.replace('_', ' ')}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-surface-500 mb-3 line-clamp-1">{project.description || 'No description'}</p>
                  <div className="flex items-center gap-3">
                    <Progress value={progress} className="flex-1 h-1.5" />
                    <span className="text-[11px] font-medium text-surface-300">{progress}%</span>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-surface-500">
                    <span>{projectTasks.length} tasks</span>
                    <span>{doneCount} done</span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="p-6">
          <h2 className="font-display font-bold text-surface-50 text-base mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Button
              variant="secondary"
              onClick={() => navigate(`/collab/${workspaceId}/team`)}
              leftIcon={<FolderOpen size={14} />}
              className="justify-start"
            >
              All Projects
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate(`/collab/${workspaceId}/people`)}
              leftIcon={<Users size={14} />}
              className="justify-start"
            >
              Team Members
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate('/home')}
              leftIcon={<ArrowRight size={14} />}
              className="justify-start"
            >
              Home
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate(`/collab/${workspaceId}/leaderboard`)}
              leftIcon={<TrendingUp size={14} />}
              className="justify-start"
            >
              Leaderboard
            </Button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
