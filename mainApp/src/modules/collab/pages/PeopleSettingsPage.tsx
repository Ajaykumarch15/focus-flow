import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Check, Shield } from 'lucide-react';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { Button } from '@shared/components/ui/Button';
import { Badge } from '@shared/components/ui/Badge';
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

export function PeopleSettingsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const { workspaces, updateWorkspaceSettings } = useCollaborationStore();
  const workspace = workspaces.find((w) => w.id === workspaceId);
  const [saved, setSaved] = useState(false);

  const [allowInvites, setAllowInvites] = useState(false);
  const [defaultRole, setDefaultRole] = useState('nonadmin');
  const [requireApproval, setRequireApproval] = useState(false);
  const [showEmails, setShowEmails] = useState(false);

  useEffect(() => {
    if (workspace?.settings) {
      setAllowInvites(workspace.settings.allowMemberInvites ?? false);
      setRequireApproval(false);
      setShowEmails(false);
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

  if (!workspace) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <Users size={40} className="mx-auto text-surface-500" />
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
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(`/collab/${workspaceId}/people`)}
              className="flex items-center gap-1.5 text-xs font-bold text-surface-400 hover:text-surface-100 transition-colors bg-surface-900 hover:bg-surface-800 px-3 py-2 rounded-xl border border-surface-800">
              <ArrowLeft size={14} /> Back
            </button>
            <div>
              <div className="flex items-center gap-1.5 text-[10px] text-surface-400 font-medium">
                <span>People</span>
              </div>
              <h1 className="font-display font-bold text-sm leading-none text-surface-50">People Settings</h1>
            </div>
          </div>
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
              <Users size={16} />
            </div>
            <div>
              <h2 className="font-display font-bold text-surface-50 text-[15px]">Member Management</h2>
              <p className="text-xs text-surface-400">Control how members join and interact</p>
            </div>
          </div>

          <div className="space-y-0.5">
            {[
              { label: 'Allow Member Self-Invites', desc: 'Let members invite others without admin approval', enabled: allowInvites, onToggle: () => { setAllowInvites(!allowInvites); handleToggle('allowMemberInvites', !allowInvites); } },
              { label: 'Require Admin Approval', desc: 'New members need admin approval before joining', enabled: requireApproval, onToggle: () => { setRequireApproval(!requireApproval); } },
              { label: 'Show Member Emails', desc: 'Display email addresses to all workspace members', enabled: showEmails, onToggle: () => { setShowEmails(!showEmails); } },
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

          <div className="mt-5 pt-4 border-t border-surface-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-surface-200">Default Member Role</p>
                <p className="text-xs text-surface-500 mt-0.5">Role assigned to newly invited members</p>
              </div>
              <Select value={defaultRole} onChange={(e) => setDefaultRole(e.target.value)} className="h-9 rounded-lg text-xs w-36">
                <option value="nonadmin">Nonadmin</option>
                <option value="admin">Admin</option>
              </Select>
            </div>
          </div>
        </motion.div>

        <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ delay: 0.06 }}
          className="rounded-2xl border border-surface-800/80 bg-surface-900/70 backdrop-blur-sm p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <Shield size={16} />
            </div>
            <div>
              <h2 className="font-display font-bold text-surface-50 text-[15px]">Permissions</h2>
              <p className="text-xs text-surface-400">Manage member access levels</p>
            </div>
          </div>
          <div className="space-y-3">
            {[
              { role: 'superadmin', desc: 'Full platform control, can delete workspace', count: 1 },
              { role: 'admin', desc: 'Can manage members, settings, and project managers', count: 0 },
              { role: 'nonadmin', desc: 'Can view and edit assigned tasks (can be designated as PM)', count: 0 },
            ].map(({ role, desc, count }) => (
              <div key={role} className="flex items-center justify-between p-3 rounded-xl border border-surface-800 bg-surface-850/50">
                <div>
                  <p className="text-sm font-medium text-surface-200">{role === 'superadmin' ? 'Superadmin' : role === 'admin' ? 'Admin' : 'Nonadmin'}</p>
                  <p className="text-xs text-surface-500">{desc}</p>
                </div>
                <Badge tone={role === 'superadmin' ? 'brand' : role === 'admin' ? 'info' : 'neutral'} className="text-[10px]">{count}</Badge>
              </div>
            ))}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
