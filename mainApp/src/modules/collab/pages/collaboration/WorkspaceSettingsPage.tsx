import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Settings, ShieldCheck, Lock, Save } from 'lucide-react';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { Button } from '@shared/components/ui/Button';
import { Card } from '@shared/components/ui/Card';

export function WorkspaceSettingsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { workspaces, activeWorkspaceId, updateWorkspaceSettings } = useCollaborationStore();

  const activeWs = workspaces.find((w) => w.id === (workspaceId || activeWorkspaceId)) || workspaces[0];

  const [allowInvites, setAllowInvites] = useState(activeWs.settings.allowMemberInvites);
  const [requireReview, setRequireReview] = useState(activeWs.settings.requireReviewForDone);
  const [autoSyncWorkLogs, setAutoSyncWorkLogs] = useState(activeWs.settings.autoSyncTimerWorkLogs);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateWorkspaceSettings(activeWs.id, {
      allowMemberInvites: allowInvites,
      requireReviewForDone: requireReview,
      autoSyncTimerWorkLogs: autoSyncWorkLogs,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="p-6 lg:p-8 max-w-[1200px] mx-auto space-y-6">
      
      <div>
        <h1 className="text-2xl font-display font-extrabold text-surface-50 flex items-center gap-2.5">
          <Settings size={24} className="text-surface-400" /> Workspace Settings & Security
        </h1>
        <p className="text-xs text-surface-400 mt-1">
          Manage workspace access control, security policies, role permissions, and member defaults for {activeWs.name}.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* Security & Access Policies */}
        <Card className="p-6 space-y-4">
          <h2 className="text-base font-display font-extrabold text-surface-50 flex items-center gap-2">
            <Lock size={18} className="text-brand-400" /> Security & Governance Policies
          </h2>

          <div className="space-y-4 divide-y divide-surface-800">
            
            <label className="pt-3 flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-xs font-bold text-surface-100">Allow Member Invitations</p>
                <p className="text-[11px] text-surface-400">Permit developers and team leaders to invite external team members.</p>
              </div>
              <input type="checkbox" checked={allowInvites} onChange={(e) => setAllowInvites(e.target.checked)}
                className="w-4 h-4 accent-brand-500 rounded cursor-pointer" />
            </label>

            <label className="pt-3 flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-xs font-bold text-surface-100">Mandatory QA Review for 'Done' Features</p>
                <p className="text-[11px] text-surface-400">Require features to pass QA verification before being marked as Done.</p>
              </div>
              <input type="checkbox" checked={requireReview} onChange={(e) => setRequireReview(e.target.checked)}
                className="w-4 h-4 accent-brand-500 rounded cursor-pointer" />
            </label>

            <label className="pt-3 flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-xs font-bold text-surface-100">Auto-Sync Timer Work Logs to Workspace</p>
                <p className="text-[11px] text-surface-400">Automatically publish active focus session work logs to workspace activity feeds.</p>
              </div>
              <input type="checkbox" checked={autoSyncWorkLogs} onChange={(e) => setAutoSyncWorkLogs(e.target.checked)}
                className="w-4 h-4 accent-brand-500 rounded cursor-pointer" />
            </label>

          </div>
        </Card>

        {/* Role Permission Hierarchy Table */}
        <Card className="p-6 space-y-4">
          <h2 className="text-base font-display font-extrabold text-surface-50 flex items-center gap-2">
            <ShieldCheck size={18} className="text-purple-400" /> Configurable Role Permissions Matrix
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-surface-300">
              <thead className="bg-surface-850 text-surface-400 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3">Capability</th>
                  <th className="p-3">Owner</th>
                  <th className="p-3">Admin</th>
                  <th className="p-3">Team Leader</th>
                  <th className="p-3">Developer</th>
                  <th className="p-3">QA Engineer</th>
                  <th className="p-3">Viewer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-800">
                {[
                  'Manage Workspace Settings',
                  'Invite & Remove Members',
                  'Create & Delete Projects',
                  'Manage Teams & Roles',
                  'Create Sprints & Assign Features',
                  'Update Feature Status',
                  'Create Personal Tasks',
                  'Approve QA Releases',
                ].map((cap, idx) => (
                  <tr key={cap} className="hover:bg-surface-850/40">
                    <td className="p-3 font-semibold text-surface-200">{cap}</td>
                    <td className="p-3 text-emerald-400">✓</td>
                    <td className="p-3 text-emerald-400">✓</td>
                    <td className="p-3 text-emerald-400">{idx > 1 ? '✓' : '—'}</td>
                    <td className="p-3 text-emerald-400">{idx >= 5 && idx <= 6 ? '✓' : '—'}</td>
                    <td className="p-3 text-emerald-400">{idx >= 5 ? '✓' : '—'}</td>
                    <td className="p-3 text-surface-500">—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="flex items-center justify-end gap-3">
          {saved && <span role="status" aria-live="polite" className="text-xs text-emerald-400 font-semibold">Settings saved successfully!</span>}
          <Button type="submit" size="sm" className="px-6 shadow-lg shadow-brand-500/20" leftIcon={<Save size={14} />}>
            Save Workspace Configuration
          </Button>
        </div>

      </form>
    </div>
  );
}
