import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity, Check, Mail, Trash2 } from 'lucide-react';
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

const RETENTION_OPTIONS = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '1 year' },
  { value: 'all', label: 'Forever' },
];

const DIGEST_OPTIONS = [
  { value: 'none', label: 'No digest' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
];

export function ActivitySettingsPage() {
  const workspaceId = useWorkspaceId();
  const navigate = useNavigate();
  const { workspaces } = useCollaborationStore();
  const workspace = workspaces.find((w) => w.id === workspaceId);
  const [saved, setSaved] = useState(false);

  const [retention, setRetention] = useState('30');
  const [showTaskComplete, setShowTaskComplete] = useState(true);
  const [showMemberJoin, setShowMemberJoin] = useState(true);
  const [emailDigest, setEmailDigest] = useState('none');

  const flashSaved = useCallback(() => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, []);

  if (!workspace) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <Activity size={40} className="mx-auto text-surface-500" />
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
          <h1 className="font-display font-bold text-sm text-surface-50">Activity Settings</h1>
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
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Activity size={16} />
            </div>
            <div>
              <h2 className="font-display font-bold text-surface-50 text-[15px]">Feed Visibility</h2>
              <p className="text-xs text-surface-400">Control what appears in the activity feed</p>
            </div>
          </div>

          <div className="space-y-0.5">
            {[
              { label: 'Show Task Completions', desc: 'Display when tasks are marked as done', enabled: showTaskComplete, onToggle: () => { setShowTaskComplete(!showTaskComplete); flashSaved(); } },
              { label: 'Show Member Joins & Leaves', desc: 'Display when members join or leave the workspace', enabled: showMemberJoin, onToggle: () => { setShowMemberJoin(!showMemberJoin); flashSaved(); } },
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
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <Trash2 size={16} />
            </div>
            <div>
              <h2 className="font-display font-bold text-surface-50 text-[15px]">Data Retention</h2>
              <p className="text-xs text-surface-400">How long to keep activity history</p>
            </div>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-surface-200">Feed Retention Period</p>
              <p className="text-xs text-surface-500 mt-0.5">Older entries will be automatically removed</p>
            </div>
            <Select value={retention} onChange={(e) => { setRetention(e.target.value); flashSaved(); }} className="h-9 rounded-lg text-xs w-32">
              {RETENTION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </div>
        </motion.div>

        <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ delay: 0.12 }}
          className="rounded-2xl border border-surface-800/80 bg-surface-900/70 backdrop-blur-sm p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center">
              <Mail size={16} />
            </div>
            <div>
              <h2 className="font-display font-bold text-surface-50 text-[15px]">Email Notifications</h2>
              <p className="text-xs text-surface-400">Receive activity digests via email</p>
            </div>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-surface-200">Email Digest</p>
              <p className="text-xs text-surface-500 mt-0.5">How often to receive activity summaries</p>
            </div>
            <Select value={emailDigest} onChange={(e) => { setEmailDigest(e.target.value); flashSaved(); }} className="h-9 rounded-lg text-xs w-36">
              {DIGEST_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
