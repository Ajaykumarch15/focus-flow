import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Search, GitBranch,
  MessageSquare, CheckSquare, FolderKanban
} from 'lucide-react';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import { CollaborativeTask, Feature } from '../../types/collaboration';
import { DiscussionsModal } from '../../components/collaboration/DiscussionsModal';
import { WorkItemTypeBadge } from '../../components/collaboration/WorkItemTypeBadge';
import { ModulePicker } from '../../components/roadmap/ModulePicker';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Badge } from '../../components/ui/Badge';

// IES-R1 (P6-T2): pure computations over live Feature/Task data (testable).

export interface FeatureProgress {
  done: number;
  total: number;
  pct: number | null;
}

// An empty linked-task set is "no data", not a fabricated 0% or 100%.
export function computeFeatureProgress(tasks: Pick<CollaborativeTask, 'sprintStatus'>[]): FeatureProgress {
  const done = tasks.filter((t) => t.sprintStatus === 'done').length;
  return {
    done,
    total: tasks.length,
    pct: tasks.length === 0 ? null : Math.round((done / tasks.length) * 100),
  };
}

export function groupTasksByFeature(tasks: CollaborativeTask[]): Map<string, CollaborativeTask[]> {
  const map = new Map<string, CollaborativeTask[]>();
  for (const t of tasks) {
    if (!t.featureId) continue;
    const list = map.get(t.featureId) ?? [];
    list.push(t);
    map.set(t.featureId, list);
  }
  return map;
}

export function FeaturesPage() {
  const { features, tasks, members, modules, activeWorkspaceId } = useCollaborationStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [discModal, setDiscModal] = useState<{ open: boolean; targetType: any; targetId: string; title: string }>({
    open: false, targetType: 'task', targetId: '', title: ''
  });

  // Feature detail view state
  const [expandedFeatureId, setExpandedFeatureId] = useState<string | null>(null);

  const wsFeatures = useMemo(
    () => features.filter((f) => f.workspaceId === activeWorkspaceId),
    [features, activeWorkspaceId],
  );

  const wsModules = useMemo(
    () => [...modules].sort((a, b) => a.name.localeCompare(b.name)),
    [modules],
  );

  const moduleName = (moduleId: string | undefined) =>
    wsModules.find((m) => m.id === moduleId)?.name ?? 'Module';

  const filteredFeatures = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return wsFeatures.filter((f) => {
      const matchSearch =
        f.name.toLowerCase().includes(q) ||
        f.description.toLowerCase().includes(q);
      const matchType = selectedType === 'all' || f.type === selectedType;
      const matchModule =
        selectedModule === 'all' ||
        (selectedModule === '__unassigned__' ? !f.moduleId : f.moduleId === selectedModule);
      return matchSearch && matchType && matchModule;
    });
  }, [wsFeatures, searchQuery, selectedType, selectedModule]);

  const moduleGroups = useMemo(() => {
    const byModule = new Map<string, Feature[]>();
    const unassigned: Feature[] = [];
    for (const f of filteredFeatures) {
      if (!f.moduleId) { unassigned.push(f); continue; }
      const list = byModule.get(f.moduleId) ?? [];
      list.push(f);
      byModule.set(f.moduleId, list);
    }
    const groups = [...byModule.entries()]
      .sort((a, b) => moduleName(a[0]).localeCompare(moduleName(b[0])));
    return { groups, unassigned };
  }, [filteredFeatures, wsModules]);

  const tasksByFeature = useMemo(() => groupTasksByFeature(tasks), [tasks]);

  const renderFeatureCard = (feature: Feature) => {
    const assignee = members.find((m) => m.id === feature.ownerId);
    const linkedTasks = tasksByFeature.get(feature.id) ?? [];
    const progress = computeFeatureProgress(linkedTasks);
    const actualHours = linkedTasks.reduce((sum, t) => sum + (t.actualHours || 0), 0);
    const isExpanded = expandedFeatureId === feature.id;

    return (
      <motion.div key={feature.id} layout
        className="rounded-3xl border border-surface-800 bg-surface-900 p-6 space-y-4 hover:border-surface-700 transition-all shadow-md">
        
        {/* Feature Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <WorkItemTypeBadge type={feature.type} />
              <Badge tone="neutral" className="text-[10px] font-extrabold uppercase">
                {feature.status.replace('_', ' ')}
              </Badge>
              {feature.moduleId && (
                <Badge tone="brand" className="text-[10px] font-extrabold">
                  <FolderKanban size={10} className="mr-1 inline" /> {moduleName(feature.moduleId)}
                </Badge>
              )}
              {feature.labels.slice(0, 3).map((label) => (
                <Badge key={label} tone="info" className="text-[10px] font-bold">
                  {label}
                </Badge>
              ))}
            </div>
            <h3 className="text-lg font-display font-extrabold text-surface-50">{feature.name}</h3>
            <p className="text-xs text-surface-400 leading-relaxed">{feature.description}</p>
          </div>

          {/* Live Progress Bar Widget */}
          <div className="p-4 rounded-2xl bg-surface-850 border border-surface-800 min-w-[240px] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-surface-400">Implementation Progress</span>
              <span className="font-mono font-bold text-brand-400">{progress.pct === null ? '—' : `${progress.pct}%`}</span>
            </div>
            <div className="w-full bg-surface-800 h-2 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-brand-500 to-cyan-400 h-full rounded-full transition-all duration-500" style={{ width: `${progress.pct ?? 0}%` }} />
            </div>
            <div className="flex items-center justify-between text-[11px] text-surface-500">
              <span>Est: {feature.estimatedHours}h</span>
              <span>Actual: {actualHours}h</span>
            </div>
          </div>
        </div>

        {/* Developer & Action Bar */}
        <div className="pt-3 border-t border-surface-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-brand-500 to-cyan-500 flex items-center justify-center font-bold text-white text-[10px]">
                {assignee?.name.charAt(0) || 'D'}
              </div>
              <span className="font-semibold text-surface-200">Owner: {assignee?.name || 'Unassigned'}</span>
            </div>
            {/* Module ownership picker (EEP2-P3.4.4) — never touches sprintId */}
            <ModulePicker feature={feature}
              className="bg-surface-800 text-surface-300 text-[11px] rounded-lg border border-surface-700 px-2 py-1.5 outline-none" />
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setDiscModal({ open: true, targetType: 'task', targetId: feature.id, title: feature.name })}
              className="px-3 py-1.5 rounded-xl bg-surface-800 hover:bg-surface-750 text-surface-300 text-xs font-semibold flex items-center gap-1.5 transition-colors">
              <MessageSquare size={13} /> Discussion Threads
            </button>

            <button onClick={() => setExpandedFeatureId(isExpanded ? null : feature.id)}
              className="px-3.5 py-1.5 rounded-xl bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 text-xs font-bold border border-brand-500/20 flex items-center gap-1.5 transition-colors">
              <CheckSquare size={13} /> Private Implementation Tasks ({linkedTasks.length})
            </button>
          </div>
        </div>

        {/* Linked Developer Implementation Tasks Section */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="pt-4 border-t border-surface-800 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-surface-300 flex items-center gap-2">
                <CheckSquare size={14} className="text-brand-400" /> Linked Private Implementation Tasks (Developer Owned)
              </h4>

              <div className="space-y-2">
                {linkedTasks.map((task) => (
                  <div key={task.id} className="p-3 rounded-xl bg-surface-850 border border-surface-800 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-surface-200 font-medium truncate">{task.title}</span>
                      {task.gitContext?.branch && (
                        <Badge tone="success" icon={<GitBranch size={11} />} className="text-[10px] font-mono hidden sm:inline-flex">
                          {task.gitContext.branch}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge tone="neutral" className="text-[10px] font-bold uppercase">
                        {task.sprintStatus.replace('_', ' ')}
                      </Badge>
                      <Badge tone={task.priority === 'urgent' ? 'danger' : 'brand'} className="text-[10px] font-bold uppercase">
                        {task.priority}
                      </Badge>
                    </div>
                  </div>
                ))}
                {linkedTasks.length === 0 && (
                  <p className="text-[11px] text-surface-500 italic py-3 text-center">
                    No implementation tasks linked to this feature yet.
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>
    );
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
            Features are owned by the workspace. Developer tasks link directly into feature implementation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
            <Input type="text" placeholder="Filter features..." aria-label="Filter features"
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-surface-900 border border-surface-750 focus:border-brand-500 text-xs text-surface-50 rounded-xl pl-9 pr-4 py-2.5 outline-none transition-all w-60" />
          </div>

          {/* Work-item type filter */}
          <div className="w-44">
            <Select aria-label="Filter by type" value={selectedType} onChange={(e) => setSelectedType(e.target.value)}
              className="bg-surface-900 border border-surface-750 text-xs text-surface-300 rounded-xl px-3 py-2.5 outline-none">
              <option value="all">All Types</option>
              <option value="feature">Feature</option>
              <option value="bug">Bug</option>
              <option value="spike">Spike</option>
              <option value="chore">Chore</option>
              <option value="research">Research</option>
              <option value="debt">Tech Debt</option>
              <option value="improvement">Improvement</option>
            </Select>
          </div>

          {/* Module grouping filter (EEP2-P3.4.4 / DDS §4.8) */}
          <div className="w-52">
            <Select aria-label="Filter by module" value={selectedModule} onChange={(e) => setSelectedModule(e.target.value)}
              className="bg-surface-900 border border-surface-750 text-xs text-surface-300 rounded-xl px-3 py-2.5 outline-none">
              <option value="all">All Modules</option>
              {wsModules.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
              <option value="__unassigned__">Project-level (no module)</option>
            </Select>
          </div>
        </div>
      </div>

      {/* Feature Cards Grid — grouped by module (EEP2-P3.4.4 / DDS §4.8) */}
      <div className="space-y-6">
        {moduleGroups.groups.map(([moduleId, feats]) => (
          <section key={moduleId} className="space-y-3">
            <h2 className="flex items-center gap-2 text-xs font-display font-extrabold uppercase tracking-wider text-surface-300">
              <FolderKanban size={14} className="text-cyan-400" />
              {moduleName(moduleId)}
              <span className="text-surface-500 font-mono normal-case">{feats.length}</span>
            </h2>
            <div className="space-y-4">
              {feats.map((feature) => renderFeatureCard(feature))}
            </div>
          </section>
        ))}

        {moduleGroups.unassigned.length > 0 && (
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-xs font-display font-extrabold uppercase tracking-wider text-surface-300">
              <FolderKanban size={14} className="text-amber-400" />
              Project-level
              <span className="text-surface-500 font-mono normal-case">{moduleGroups.unassigned.length}</span>
            </h2>
            <div className="space-y-4">
              {moduleGroups.unassigned.map((feature) => renderFeatureCard(feature))}
            </div>
          </section>
        )}
      </div>

      {filteredFeatures.length === 0 && (
        <div className="rounded-2xl border border-dashed border-surface-700 bg-surface-900/60 p-12 text-center text-xs text-surface-400 italic">
          {wsFeatures.length === 0
            ? 'No features yet in this workspace.'
            : 'No features match the current filters.'}
        </div>
      )}

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
