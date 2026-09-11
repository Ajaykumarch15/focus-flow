import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, Trash2, Settings } from 'lucide-react';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { useWorkspaceId } from '@collab/hooks/useWorkspaceId';
import { Card } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import { Badge } from '@shared/components/ui/Badge';
import { Input } from '@shared/components/ui/Input';
import { Select } from '@shared/components/ui/Select';

const WS_ICONS: Record<string, string> = {
  Startup: '⚡', Personal: '🚀', 'College Project': '🎓',
  'Open Source': '🌐', Internship: '💼', Enterprise: '🏢',
};

const WS_TYPES = ['Startup', 'Personal', 'College Project', 'Open Source', 'Internship', 'Enterprise'] as const;

export function WorkspaceSettingsPage() {
  const workspaceId = useWorkspaceId();
  const navigate = useNavigate();
  const { workspaces, updateWorkspace, deleteWorkspace } = useCollaborationStore();

  const workspace = workspaces.find((w) => w.id === workspaceId);
  const canDelete = workspace?.role === 'superadmin';

  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');

  useEffect(() => {
    if (workspace) {
      setEditName(workspace.name);
      setEditType(workspace.type);
      setEditDesc(workspace.description || '');
    }
  }, [workspace?.id]);

  const handleSave = async () => {
    if (!workspaceId || !editName.trim()) return;
    setSaving(true);
    try {
      await updateWorkspace(workspaceId, {
        name: editName.trim(),
        type: editType as any,
        description: editDesc.trim(),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!workspaceId || deleteConfirmName !== workspace?.name) return;
    const ok = await deleteWorkspace(workspaceId);
    if (ok) navigate('/collab/workspaces');
  };

  if (!workspace) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <Settings size={40} className="mx-auto text-surface-500" />
          <h1 className="text-lg font-display font-bold text-surface-100">Workspace not found</h1>
          <Button onClick={() => navigate('/collab/workspaces')} leftIcon={<ArrowLeft size={14} />}>
            Back to Workspaces
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-950 relative overflow-x-hidden overflow-y-auto">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-500/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-cyan-500/8 rounded-full blur-3xl pointer-events-none" />

      <header className="sticky top-0 z-20 bg-surface-950/80 backdrop-blur-xl border-b border-surface-800/60">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-base">
              {WS_ICONS[workspace.type] || '📁'}
            </div>
            <div>
              <h1 className="font-display font-bold text-sm leading-none text-surface-50">{workspace.name}</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <p className="text-[10px] text-surface-400">{workspace.type}</p>
                {workspace.role && (
                  <Badge tone={workspace.role === 'superadmin' ? 'brand' : workspace.role === 'admin' ? 'info' : 'neutral'} className="text-[9px]">
                    {workspace.role === 'superadmin' ? 'Superadmin' : workspace.role === 'admin' ? 'Admin' : 'Nonadmin'}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 relative z-10">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <Card className="p-6 space-y-5">
            <h3 className="font-display font-bold text-surface-50">Workspace Settings</h3>

            <div>
              <label className="text-xs font-semibold text-surface-300 mb-1.5 block">Name</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-10 rounded-xl" />
            </div>

            <div>
              <label className="text-xs font-semibold text-surface-300 mb-1.5 block">Type</label>
              <Select value={editType} onChange={(e) => setEditType(e.target.value)} className="h-10 rounded-xl">
                {WS_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </div>

            <div>
              <label className="text-xs font-semibold text-surface-300 mb-1.5 block">Description</label>
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={3}
                className="w-full rounded-xl bg-surface-900 border border-surface-800 text-sm text-surface-200 p-3 outline-none focus:border-brand-500/50 transition-colors resize-none"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button onClick={handleSave} disabled={saving || !editName.trim()} leftIcon={<Save size={14} />}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </Card>
        </motion.div>

        {canDelete && (
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.08 }}>
            <Card className="p-6 border-danger-500/20">
              <h3 className="font-display font-bold text-danger-400 mb-2">Danger Zone</h3>
              <p className="text-xs text-surface-400 mb-4">
                Deleting this workspace will permanently remove all associated teams, projects, and data. This action cannot be undone.
              </p>
              {!showDeleteConfirm ? (
                <Button variant="danger" size="sm" onClick={() => setShowDeleteConfirm(true)} leftIcon={<Trash2 size={13} />}>
                  Delete Workspace
                </Button>
              ) : (
                <div className="space-y-3">
                  <Input
                    placeholder={`Type "${workspace?.name}" to confirm`}
                    value={deleteConfirmName}
                    onChange={(e) => setDeleteConfirmName(e.target.value)}
                    className="max-w-xs"
                  />
                  <div className="flex items-center gap-3">
                    <Button variant="danger" size="sm" onClick={handleDelete} disabled={deleteConfirmName !== workspace?.name}>
                      Confirm Delete
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmName(''); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </main>
    </div>
  );
}
