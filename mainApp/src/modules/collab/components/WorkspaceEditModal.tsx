import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Building2, X } from 'lucide-react';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import type { Workspace, WorkspaceType } from '@collab/types/collaboration';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Textarea } from '@shared/components/ui/Textarea';
import { Select } from '@shared/components/ui/Select';

const WORKSPACE_TYPES: WorkspaceType[] = [
  'Startup', 'Personal', 'College Project', 'Open Source', 'Internship', 'Enterprise',
];

interface WorkspaceEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: Workspace;
}

// Reuses the existing `updateWorkspace` store action — pure UX surface, no new
// API/backend/state. Mirrors the workspace form used on the Workspace Hub.
export function WorkspaceEditModal({ isOpen, onClose, workspace }: WorkspaceEditModalProps) {
  const { updateWorkspace } = useCollaborationStore();
  const [name, setName] = useState(workspace.name);
  const [type, setType] = useState<WorkspaceType>(workspace.type);
  const [description, setDescription] = useState(workspace.description);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(workspace.name);
      setType(workspace.type);
      setDescription(workspace.description);
    }
  }, [isOpen, workspace]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    const updated = await updateWorkspace(workspace.id, {
      name: name.trim(),
      type,
      description: description.trim(),
    });
    setSaving(false);
    if (updated) onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="bg-surface-900 border border-surface-700/80 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-800 bg-surface-850/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
              <Building2 size={18} />
            </div>
            <div>
              <h2 className="text-base font-display font-bold text-surface-50">Edit Workspace</h2>
              <p className="text-xs text-surface-400">Update identity, type, or purpose.</p>
            </div>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} className="p-1.5 text-surface-500 hover:text-surface-200 rounded-lg">
            <X size={18} />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-surface-300 mb-1.5">
              Workspace Name <span className="text-red-400">*</span>
            </label>
            <Input
              required
              className="rounded-xl text-sm w-full"
              placeholder="e.g. Acme AI Engineering"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-surface-300 mb-1.5">Workspace Type</label>
            <Select value={type} onChange={(e) => setType(e.target.value as WorkspaceType)} className="rounded-xl text-sm">
              {WORKSPACE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-surface-300 mb-1.5">Description</label>
            <Textarea
              rows={3}
              className="rounded-xl text-sm w-full resize-none"
              placeholder="Briefly describe the workspace purpose & engineering goals..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1 rounded-xl">Cancel</Button>
            <Button type="submit" disabled={!name.trim() || saving} loading={saving} className="flex-1 rounded-xl">
              Save Changes
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
