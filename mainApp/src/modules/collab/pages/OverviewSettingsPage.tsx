import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LayoutGrid, Check, LayoutList, Pin } from 'lucide-react';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { useWorkspaceId } from '@collab/hooks/useWorkspaceId';
import { Button } from '@shared/components/ui/Button';
import { Select } from '@shared/components/ui/Select';

const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${enabled ? 'bg-brand-500 shadow-inner shadow-brand-600/30' : 'bg-surface-700'}`}>
      <motion.div className="w-[18px] h-[18px] bg-white rounded-full absolute top-[3px] shadow-sm"
        animate={{ left: enabled ? '22px' : '3px' }}
        transition={{ type: 'spring', stiffness: 500, damping: 35 }} />
    </button>
  );
}

const LANDING_OPTIONS = [
  { value: 'dashboard', label: 'Overview' },
  { value: 'team', label: 'Projects' },
  { value: 'people', label: 'People' },
];

const LAYOUT_OPTIONS = [
  { value: 'grid', label: 'Grid', icon: LayoutGrid },
  { value: 'list', label: 'List', icon: LayoutList },
];

export function OverviewSettingsPage() {
  const workspaceId = useWorkspaceId();
  const navigate = useNavigate();
  const { workspaces, projects } = useCollaborationStore();
  const workspace = workspaces.find((w) => w.id === workspaceId);
  const [saved, setSaved] = useState(false);

  const [defaultTab, setDefaultTab] = useState('dashboard');
  const [showStats, setShowStats] = useState(true);
  const [layout, setLayout] = useState('grid');
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());

  const flashSaved = useCallback(() => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, []);

  const togglePin = (id: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    flashSaved();
  };

  if (!workspace) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <LayoutGrid size={40} className="mx-auto text-surface-500" />
          <h1 className="text-lg font-display font-bold text-surface-100">Workspace not found</h1>
          <Button onClick={() => navigate('/collab/workspaces')} leftIcon={<ArrowLeft size={14} />}>Back</Button>
        </div>
      </div>
    );
  }

  const wsProjects = projects.filter((p) => p.workspaceId === workspaceId);

  return (
    <div className="min-h-screen bg-surface-950 relative overflow-x-hidden overflow-y-auto">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-500/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-cyan-500/8 rounded-full blur-3xl pointer-events-none" />

      <header className="sticky top-0 z-20 bg-surface-950/80 backdrop-blur-xl border-b border-surface-800/60">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <h1 className="font-display font-bold text-sm text-surface-50">Overview Settings</h1>
          <AnimatePresence>
            {saved && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-1.5 text-emerald-500 text-sm font-medium">
                <Check size={14} /> Saved
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 relative z-10">
        <motion.div variants={fadeUp} initial="hidden" animate="show"
          className="rounded-2xl border border-surface-800/80 bg-surface-900/70 backdrop-blur-sm p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-500 flex items-center justify-center">
              <LayoutGrid size={16} />
            </div>
            <div>
              <h2 className="font-display font-bold text-surface-50 text-[15px]">Dashboard</h2>
              <p className="text-xs text-surface-400">Customize the overview dashboard</p>
            </div>
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-surface-200">Show Stats Cards</p>
                <p className="text-xs text-surface-500 mt-0.5">Display project/task/member count cards at the top</p>
              </div>
              <Toggle enabled={showStats} onToggle={() => { setShowStats(!showStats); flashSaved(); }} />
            </div>

            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-surface-200">Default Landing Tab</p>
                <p className="text-xs text-surface-500 mt-0.5">Which section opens by default</p>
              </div>
              <Select value={defaultTab} onChange={(e) => { setDefaultTab(e.target.value); flashSaved(); }} className="h-9 rounded-lg text-xs w-36">
                {LANDING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </div>

            <div className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-surface-200">Dashboard Layout</p>
                <p className="text-xs text-surface-500 mt-0.5">How content is arranged</p>
              </div>
              <div className="flex gap-2">
                {LAYOUT_OPTIONS.map(({ value, label, icon: Icon }) => (
                  <button key={value} onClick={() => { setLayout(value); flashSaved(); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${layout === value
                      ? 'bg-brand-500 text-white border-brand-500' : 'bg-surface-850 text-surface-300 border-surface-800 hover:border-surface-700'}`}>
                    <Icon size={12} /> {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ delay: 0.06 }}
          className="rounded-2xl border border-surface-800/80 bg-surface-900/70 backdrop-blur-sm p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Pin size={16} />
            </div>
            <div>
              <h2 className="font-display font-bold text-surface-50 text-[15px]">Pinned Projects</h2>
              <p className="text-xs text-surface-400">Quick-access projects on the dashboard</p>
            </div>
          </div>

          {wsProjects.length === 0 ? (
            <p className="text-xs text-surface-500 py-4 text-center">No projects yet</p>
          ) : (
            <div className="space-y-2">
              {wsProjects.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-xl border border-surface-800 bg-surface-850/50">
                  <div>
                    <p className="text-sm font-medium text-surface-200">{p.name}</p>
                    <p className="text-xs text-surface-500">{p.status?.replace('_', ' ')}</p>
                  </div>
                  <button onClick={() => togglePin(p.id)}
                    className={`p-1.5 rounded-lg transition-colors ${pinnedIds.has(p.id) ? 'text-amber-400 bg-amber-500/10' : 'text-surface-500 hover:text-surface-300'}`}>
                    <Pin size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
