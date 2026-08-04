import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import { useAuthStore } from '../../store/useAuthStore';
import type { FeatureType } from '../../types/collaboration';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';

interface CreateFeatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultProjectId?: string;
}

// IES-R1 (P6-T5/UX-R1): Backlog → + New Feature. Creates a sprint-less feature
// (server `sprintRef: null`) with a real owner picked from workspace members.
export function CreateFeatureModal({ isOpen, onClose, defaultProjectId }: CreateFeatureModalProps) {
  const { projects, members, activeWorkspaceId, createFeature } = useCollaborationStore();
  const me = useAuthStore.getState().user?._id ?? '';

  const [projectId, setProjectId] = useState(defaultProjectId ?? '');
  const [name, setName] = useState('');
  const [type, setType] = useState<FeatureType>('feature');
  const [description, setDescription] = useState('');
  const [estimatedHours, setEstimatedHours] = useState(0);
  const [ownerId, setOwnerId] = useState(me);

  useEffect(() => {
    if (!isOpen) return;
    setProjectId(defaultProjectId ?? projects.find((p) => p.workspaceId === activeWorkspaceId)?.id ?? '');
    setName('');
    setType('feature');
    setDescription('');
    setEstimatedHours(0);
    setOwnerId(useAuthStore.getState().user?._id ?? '');
  }, [isOpen, projects, activeWorkspaceId, defaultProjectId]);

  const wsProjects = useMemo(
    () => projects.filter((p) => p.workspaceId === activeWorkspaceId),
    [projects, activeWorkspaceId],
  );

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !projectId) return;
    createFeature({
      projectId,
      name: name.trim(),
      type,
      description: description.trim(),
      estimatedHours,
      ownerId: ownerId || undefined,
    });
    onClose();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="bg-surface-900 border border-surface-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-800 bg-surface-850/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-base font-display font-bold text-surface-50">Create Feature</h2>
              <p className="text-xs text-surface-400">A new work item for the project backlog</p>
            </div>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} className="p-1.5 text-surface-500 hover:text-surface-200 rounded-lg">
            <X size={18} />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-surface-300 mb-1.5">
                Project <span className="text-red-400">*</span>
              </label>
              <Select name="projectId" aria-label="Feature project" required
                value={projectId} onChange={(e) => setProjectId(e.target.value)}
                className="bg-surface-850 border border-surface-700 text-sm text-surface-50 rounded-xl px-3 py-2.5 outline-none w-full">
                <option value="">Select project…</option>
                {wsProjects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-300 mb-1.5">Work Item Type</label>
              <Select name="type" aria-label="Work item type"
                value={type} onChange={(e) => setType(e.target.value as FeatureType)}
                className="bg-surface-850 border border-surface-700 text-sm text-surface-50 rounded-xl px-3 py-2.5 outline-none w-full">
                <option value="feature">Feature</option>
                <option value="bug">Bug</option>
                <option value="spike">Spike</option>
                <option value="chore">Chore</option>
                <option value="research">Research</option>
                <option value="debt">Tech Debt</option>
                <option value="improvement">Improvement</option>
              </Select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-surface-300 mb-1.5">
              Feature Name <span className="text-red-400">*</span>
            </label>
            <Input name="name" className="rounded-xl text-sm w-full"
              placeholder="e.g. AI Copilot autocomplete"
              value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>

          <div>
            <label className="block text-xs font-semibold text-surface-300 mb-1.5">Description</label>
            <Textarea rows={2} className="rounded-xl text-sm w-full resize-none"
              placeholder="Scope, acceptance criteria, links…"
              value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-surface-300 mb-1.5">Owner</label>
              <Select name="ownerId" aria-label="Feature owner"
                value={ownerId} onChange={(e) => setOwnerId(e.target.value)}
                className="bg-surface-850 border border-surface-700 text-sm text-surface-50 rounded-xl px-3 py-2.5 outline-none w-full">
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-300 mb-1.5">Est. Hours</label>
              <Input name="estimatedHours" type="number" min={0}
                className="rounded-xl text-sm w-full"
                value={estimatedHours} onChange={(e) => setEstimatedHours(Number(e.target.value))} />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1 rounded-xl">Cancel</Button>
            <Button type="submit" disabled={!name.trim() || !projectId} className="flex-1 rounded-xl">
              Create Feature
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
