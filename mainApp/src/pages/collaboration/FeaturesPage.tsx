import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Plus, Search, Filter, GitBranch, GitPullRequest, Timer, Clock,
  CheckCircle2, Flame, ChevronDown, MessageSquare, ShieldCheck, User, CheckSquare
} from 'lucide-react';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import { CollaborativeTask, SprintStatus } from '../../types/collaboration';
import { DiscussionsModal } from '../../components/collaboration/DiscussionsModal';

export function FeaturesPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { tasks, members, updateTaskStatus, createTask } = useCollaborationStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [discModal, setDiscModal] = useState<{ open: boolean; targetType: any; targetId: string; title: string }>({
    open: false, targetType: 'task', targetId: '', title: ''
  });

  // Personal task subtask creation form state inside feature detail view
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // Form state for creating new Feature
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('high');
  const [newEstHours, setNewEstHours] = useState(12);

  const wsTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchPriority = selectedPriority === 'all' || t.priority === selectedPriority;
      return matchSearch && matchPriority;
    });
  }, [tasks, searchQuery, selectedPriority]);

  const handleCreateFeature = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    createTask({
      title: newTitle.trim(),
      description: newDesc.trim(),
      priority: newPriority,
      estimatedHours: Number(newEstHours),
      sprintStatus: 'in_progress',
    });
    setShowCreateModal(false);
    setNewTitle('');
    setNewDesc('');
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      
      {/* Top Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-800 pb-5">
        <div>
          <h1 className="text-2xl font-display font-extrabold text-surface-50 flex items-center gap-2.5">
            <Sparkles size={24} className="text-purple-400" /> Central Engineering Feature Matrix
          </h1>
          <p className="text-xs text-surface-400 mt-1">
            Features are owned by the workspace. Personal developer tasks link directly into feature implementation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
            <input type="text" placeholder="Filter features..."
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-surface-900 border border-surface-750 focus:border-brand-500 text-xs text-surface-50 rounded-xl pl-9 pr-4 py-2.5 outline-none transition-all w-60" />
          </div>

          {/* Priority filter */}
          <select value={selectedPriority} onChange={(e) => setSelectedPriority(e.target.value)}
            className="bg-surface-900 border border-surface-750 text-xs text-surface-300 rounded-xl px-3 py-2.5 outline-none">
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <button onClick={() => setShowCreateModal(true)} className="btn-primary px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2">
            <Plus size={15} /> New Feature
          </button>
        </div>
      </div>

      {/* Feature Cards Grid */}
      <div className="space-y-4">
        {wsTasks.map((feature) => {
          const assignee = members.find((m) => m.id === feature.assigneeId);
          const completedSubtasks = feature.subtasks.filter((s) => s.completed).length;
          const subtaskPct = feature.subtasks.length > 0 ? Math.round((completedSubtasks / feature.subtasks.length) * 100) : 0;
          const isExpanded = expandedTaskId === feature.id;

          return (
            <motion.div key={feature.id} layout
              className="rounded-3xl border border-surface-800 bg-surface-900 p-6 space-y-4 hover:border-surface-700 transition-all shadow-md">
              
              {/* Feature Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-md border ${
                      feature.priority === 'urgent' ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                    }`}>
                      {feature.priority}
                    </span>
                    <span className="text-[10px] font-extrabold uppercase bg-surface-800 text-surface-300 px-2 py-0.5 rounded-md">
                      {feature.sprintStatus.replace('_', ' ')}
                    </span>
                    {feature.gitContext?.prNumber && (
                      <span className="text-[10px] font-mono font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                        PR #{feature.gitContext.prNumber}
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-display font-extrabold text-surface-50">{feature.title}</h3>
                  <p className="text-xs text-surface-400 leading-relaxed">{feature.description}</p>
                </div>

                {/* Live Progress Bar Widget */}
                <div className="p-4 rounded-2xl bg-surface-850 border border-surface-800 min-w-[240px] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-surface-400">Implementation Progress</span>
                    <span className="font-mono font-bold text-brand-400">{subtaskPct}%</span>
                  </div>
                  <div className="w-full bg-surface-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-gradient-to-r from-brand-500 to-cyan-400 h-full rounded-full transition-all duration-500" style={{ width: `${subtaskPct}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-surface-500">
                    <span>Est: {feature.estimatedHours}h</span>
                    <span>Actual: {feature.actualHours}h</span>
                  </div>
                </div>
              </div>

              {/* Developer & Git Context Bar */}
              <div className="pt-3 border-t border-surface-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-brand-500 to-cyan-500 flex items-center justify-center font-bold text-white text-[10px]">
                      {assignee?.name.charAt(0) || 'D'}
                    </div>
                    <span className="font-semibold text-surface-200">Owner: {assignee?.name || 'Unassigned'}</span>
                  </div>

                  {feature.gitContext?.branch && (
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 flex items-center gap-1">
                      <GitBranch size={11} /> {feature.gitContext.branch}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => setDiscModal({ open: true, targetType: 'task', targetId: feature.id, title: feature.title })}
                    className="px-3 py-1.5 rounded-xl bg-surface-800 hover:bg-surface-750 text-surface-300 text-xs font-semibold flex items-center gap-1.5 transition-colors">
                    <MessageSquare size={13} /> Discussion Threads
                  </button>

                  <button onClick={() => setExpandedTaskId(isExpanded ? null : feature.id)}
                    className="px-3.5 py-1.5 rounded-xl bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 text-xs font-bold border border-brand-500/20 flex items-center gap-1.5 transition-colors">
                    <CheckSquare size={13} /> Private Implementation Tasks ({feature.subtasks.length})
                  </button>
                </div>
              </div>

              {/* Linked Developer Implementation Tasks Section */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="pt-4 border-t border-surface-800 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-surface-300 flex items-center gap-2">
                      <CheckSquare size={14} className="text-brand-400" /> Linked Private Subtasks (Developer Owned)
                    </h4>

                    <div className="space-y-2">
                      {feature.subtasks.map((st) => (
                        <div key={st.id} className="p-3 rounded-xl bg-surface-850 border border-surface-800 flex items-center justify-between text-xs">
                          <span className={st.completed ? 'line-through text-surface-500' : 'text-surface-200 font-medium'}>
                            {st.title}
                          </span>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${st.completed ? 'bg-emerald-500/15 text-emerald-400' : 'bg-surface-800 text-surface-400'}`}>
                            {st.completed ? 'Completed' : 'In Progress'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </motion.div>
          );
        })}
      </div>

      {/* Discussion Modal */}
      <DiscussionsModal
        isOpen={discModal.open}
        onClose={() => setDiscModal({ ...discModal, open: false })}
        targetType={discModal.targetType}
        targetId={discModal.targetId}
        title={discModal.title}
      />

    </div>
  );
}
