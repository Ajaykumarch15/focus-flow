import { useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus } from 'lucide-react';
import { KanbanToolbar } from '@worklog/components/kanban/KanbanToolbar';
import { KanbanBoard } from '@worklog/components/kanban/KanbanBoard';
import { KanbanFilters } from '@worklog/components/kanban/KanbanFilters';
import { ListView } from '@worklog/components/kanban/ListView';
import { CalendarView } from '@worklog/components/kanban/CalendarView';
import { AddTaskModal } from '@worklog/components/kanban/AddTaskModal';
import { TaskDetailsPanel } from '@worklog/components/kanban/TaskDetailsPanel';
import { useKanbanStore } from '@worklog/components/kanban/kanbanStore';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { Button } from '@shared/components/ui/Button';
import { api } from '@shared/utils/api';

export function ProjectKanbanPage() {
  const { workspaceId, projectId } = useParams<{ workspaceId: string; projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeView, openAddModal, showAddModal, closeAddModal, openDetailsPanel, setWorklogTaskIds, tasks } = useKanbanStore();
  const loadFromProject = useKanbanStore((s) => s.loadFromProject);
  const setContext = useKanbanStore((s) => s.setContext);

  const collabTasks = useCollaborationStore((s) => s.tasks);
  const members = useCollaborationStore((s) => s.members);
  const projects = useCollaborationStore((s) => s.projects);

  const project = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId],
  );

  const membersMap = useMemo(() => {
    const map: Record<string, { name: string; avatar?: string }> = {};
    for (const m of members) map[m.id] = { name: m.name, avatar: m.avatar };
    return map;
  }, [members]);

  // Fetch user's worklogs and build taskId -> worklogId map
  useEffect(() => {
    let cancelled = false;
    async function fetchWorklogMap() {
      try {
        const logs = await api.workLogs.list();
        const map = new Map<string, string>();
        for (const log of logs) {
          if (log.taskRef?._id) {
            map.set(log.taskRef._id, log._id);
          }
        }
        if (!cancelled) setWorklogTaskIds(map);
      } catch (err) {
        console.error('Failed to fetch worklog map:', err);
      }
    }
    fetchWorklogMap();
    return () => { cancelled = true; };
  }, [setWorklogTaskIds]);

  // Handle ?select= query param to open task details panel
  useEffect(() => {
    const selectId = searchParams.get('select');
    if (selectId && tasks.some((t) => t.id === selectId)) {
      openDetailsPanel(selectId);
      // Clean up the query param after opening
      const params = new URLSearchParams(searchParams);
      params.delete('select');
      setSearchParams(params, { replace: true });
    }
  }, [searchParams, tasks, openDetailsPanel, setSearchParams]);

  useEffect(() => {
    if (!workspaceId || !projectId) return;
    const store = useCollaborationStore.getState();
    store.loadProjects(workspaceId);
    store.loadTasks(workspaceId, projectId);
    store.loadMembers(workspaceId);
    setContext(workspaceId, projectId, membersMap);
  }, [workspaceId, projectId, membersMap, setContext]);

  useEffect(() => {
    const projectTasks = collabTasks.filter((t) => t.projectId === projectId);
    loadFromProject(projectTasks, membersMap);
  }, [collabTasks, projectId, membersMap, loadFromProject]);

  return (
    <div className="min-h-screen bg-surface-950 relative overflow-x-hidden overflow-y-auto">
      {/* Background decorative gradients */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-info-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Content */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:p-8 relative z-10">
        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6"
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`/collab/${workspaceId}/team/${projectId}`)}
              className="flex items-center gap-1.5 text-xs font-bold text-surface-400 hover:text-surface-100 transition-colors bg-surface-900 hover:bg-surface-800 px-3 py-2 rounded-xl border border-surface-800"
            >
              <ArrowLeft size={14} /> Back
            </button>
            <div>
              <h1 className="text-2xl font-display font-extrabold text-surface-50 tracking-tight">
                {project?.name ?? 'Project'} — Kanban
              </h1>
              <p className="text-sm text-surface-400 mt-0.5">
                Manage and track tasks across your workflow.
              </p>
            </div>
          </div>
          <Button onClick={() => openAddModal()} leftIcon={<Plus size={16} />}>
            Add Task
          </Button>
        </motion.div>

        {/* Toolbar */}
        <KanbanToolbar />

        {/* Filters */}
        <KanbanFilters />

        {/* Active view */}
        {activeView === 'board' && <KanbanBoard />}
        {activeView === 'list' && (
          <div className="rounded-2xl border border-surface-800 bg-surface-900 overflow-hidden">
            <ListView />
          </div>
        )}
        {activeView === 'calendar' && (
          <div className="rounded-2xl border border-surface-800 bg-surface-900 p-5">
            <CalendarView />
          </div>
        )}
      </div>

      {/* Modals & Panels */}
      <AddTaskModal open={showAddModal} onClose={closeAddModal} />
      <TaskDetailsPanel />
    </div>
  );
}
