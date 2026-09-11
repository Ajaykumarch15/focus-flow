import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FolderOpen, Check, GitBranch, Zap, Eye } from 'lucide-react';
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

const VISIBILITY_OPTIONS = ['Private', 'Team', 'Project', 'Workspace'] as const;

export function ProjectsSettingsPage() {
  const workspaceId = useWorkspaceId();
  const navigate = useNavigate();
  const { workspaces, updateWorkspaceSettings } = useCollaborationStore();
  const workspace = workspaces.find((w) => w.id === workspaceId);
  const [saved, setSaved] = useState(false);

  const [requireReview, setRequireReview] = useState(false);
  const [autoSync, setAutoSync] = useState(false);
  const [defaultVisibility, setDefaultVisibility] = useState<string>('Team');

  useEffect(() => {
    if (workspace?.settings) {
      setRequireReview(workspace.settings.requireReviewForDone ?? false);
      setAutoSync(workspace.settings.autoSyncTimerWorkLogs ?? false);
      setDefaultVisibility(workspace.settings.defaultVisibility ?? 'Team');
    }
  }, [workspace?.id]);

  const flashSaved = useCallback(() => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, []);

  const handleToggle = async (key: string, value: boolean) => {
    if (!workspaceId) return;
    await updateWorkspaceSettings(workspaceId, { [key]: value } as any);
    flashSaved();
  };

  const handleSelect = async (key: string, value: string) => {
    if (!workspaceId) return;
    await updateWorkspaceSettings(workspaceId, { [key]: value } as any);
    flashSaved();
  };

  if (!workspace) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <FolderOpen size={40} className="mx-auto text-surface-500" />
          <h1 className="text-lg font-display font-bold text-surface-100">Workspace not found</h1>
          <Button onClick={() => navigate('/collab/workspaces')} leftIcon={<ArrowLeft size={14} />}>Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-950 relative overflow-x-hidden overflow-y-auto">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-500/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-cyan-500/8 rounded-full blur-3xl pointer-events-none" />

      <header className="sticky top-0 z-20 bg-surface-950/80 backdrop-blur-xl border-b border-surface-800/60">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <h1 className="font-display font-bold text-sm text-surface-50">Projects Settings</h1>
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
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <GitBranch size={16} />
            </div>
            <div>
              <h2 className="font-display font-bold text-surface-50 text-[15px]">Workflow</h2>
              <p className="text-xs text-surface-400">Configure task and review workflows</p>
            </div>
          </div>

          <div className="space-y-0.5">
            {[
              { label: 'Require Review Before Done', desc: 'Tasks must be reviewed before moving to Done', enabled: requireReview, onToggle: () => { setRequireReview(!requireReview); handleToggle('requireReviewForDone', !requireReview); } },
              { label: 'Auto-Sync Timer to Work Logs', desc: 'Automatically create work log entries from active timers', enabled: autoSync, onToggle: () => { setAutoSync(!autoSync); handleToggle('autoSyncTimerWorkLogs', !autoSync); } },
            ].map(({ label, desc, enabled, onToggle }) => (
              <div key={label} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-surface-200">{label}</p>
                  <p className="text-xs text-surface-500 mt-0.5">{desc}</p>
                </div>
                <Toggle enabled={enabled} onToggle={onToggle} />
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ delay: 0.06 }}
          className="rounded-2xl border border-surface-800/80 bg-surface-900/70 backdrop-blur-sm p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <Eye size={16} />
            </div>
            <div>
              <h2 className="font-display font-bold text-surface-50 text-[15px]">Defaults</h2>
              <p className="text-xs text-surface-400">Default settings for new projects</p>
            </div>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-surface-200">Default Task Visibility</p>
              <p className="text-xs text-surface-500 mt-0.5">Who can see tasks in new projects</p>
            </div>
            <Select value={defaultVisibility} onChange={(e) => { setDefaultVisibility(e.target.value); handleSelect('defaultVisibility', e.target.value); }} className="h-9 rounded-lg text-xs w-36">
              {VISIBILITY_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
            </Select>
          </div>
        </motion.div>

        <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ delay: 0.12 }}
          className="rounded-2xl border border-surface-800/80 bg-surface-900/70 backdrop-blur-sm p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Zap size={16} />
            </div>
            <div>
              <h2 className="font-display font-bold text-surface-50 text-[15px]">Automation</h2>
              <p className="text-xs text-surface-400">Automated actions and triggers</p>
            </div>
          </div>

          <div className="space-y-3">
            {[
              { label: 'Auto-assign on task creation', desc: 'Automatically assign tasks to the creator' },
              { label: 'Move to review on PR open', desc: 'Auto-move linked tasks when a PR is opened' },
              { label: 'Close task on merge', desc: 'Auto-close tasks when their PR is merged' },
            ].map(({ label, desc }) => (
              <div key={label} className="flex items-center justify-between p-3 rounded-xl border border-surface-800 bg-surface-850/50 opacity-60">
                <div>
                  <p className="text-sm font-medium text-surface-200">{label}</p>
                  <p className="text-xs text-surface-500">{desc}</p>
                </div>
                <span className="text-[10px] text-surface-500 uppercase tracking-wider">Soon</span>
              </div>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
