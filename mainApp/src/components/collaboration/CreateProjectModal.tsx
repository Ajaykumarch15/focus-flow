import { useState } from 'react';
import { motion } from 'framer-motion';
import { FolderPlus, X, Plus, Trash2, GitBranch } from 'lucide-react';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';

export function CreateProjectModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { createProject, teams } = useCollaborationStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [repositoryUrl, setRepositoryUrl] = useState('');
  // IES-P2-08: no fabricated defaults — teams/milestones start empty and are
  // only attached if the user actually picks them.
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [milestones, setMilestones] = useState<{ title: string; dueDate: string }[]>([]);

  if (!isOpen) return null;

  const defaultMilestoneDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  };

  const handleAddMilestone = () => {
    setMilestones([...milestones, { title: '', dueDate: defaultMilestoneDate() }]);
  };

  const handleRemoveMilestone = (idx: number) => {
    setMilestones(milestones.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createProject({
      name: name.trim(),
      description: description.trim(),
      repositoryUrl: repositoryUrl.trim(),
      teamIds: selectedTeams,
      milestones: milestones
        .filter((m) => m.title.trim())
        .map((m, i) => ({
          id: `ms-${Date.now()}-${i}`,
          title: m.title.trim(),
          dueDate: m.dueDate,
          status: 'planning',
          targetPoints: 50,
        })),
    });

    onClose();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="bg-surface-900 border border-surface-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-800 bg-surface-850/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
              <FolderPlus size={18} />
            </div>
            <div>
              <h2 className="text-base font-display font-bold text-surface-50">Create Engineering Project</h2>
              <p className="text-xs text-surface-400">First-class entity with milestones & repository</p>
            </div>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} className="p-1.5 text-surface-500 hover:text-surface-200 rounded-lg">
            <X size={18} />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-surface-300 mb-1.5">
              Project Name <span className="text-red-400">*</span>
            </label>
            <Input className="rounded-xl text-sm w-full" placeholder="e.g. AI Search Engine, Mobile Gateway..."
              value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>

          <div>
            <label className="block text-xs font-semibold text-surface-300 mb-1.5">Description</label>
            <Textarea rows={2} className="rounded-xl text-sm w-full resize-none"
              placeholder="What are the goals, target users, and key engineering deliverables?"
              value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-surface-300 mb-1.5 flex items-center gap-1.5">
              <GitBranch size={13} className="text-brand-400" /> Git Repository URL
            </label>
            <Input className="rounded-xl text-sm w-full font-mono" placeholder="https://github.com/org/repo"
              value={repositoryUrl} onChange={(e) => setRepositoryUrl(e.target.value)} />
          </div>

          {/* Teams */}
          <div>
            <label className="block text-xs font-semibold text-surface-300 mb-1.5">Assigned Teams</label>
            <div className="flex gap-2 flex-wrap">
              {teams.map((t) => {
                const selected = selectedTeams.includes(t.id);
                return (
                  <button key={t.id} type="button"
                    onClick={() =>
                      setSelectedTeams(selected ? selectedTeams.filter((id) => id !== t.id) : [...selectedTeams, t.id])
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      selected ? 'bg-brand-500/20 text-brand-300 border-brand-500/30' : 'bg-surface-800 text-surface-400 border-surface-700'
                    }`}>
                    {t.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Milestones */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-surface-300">Milestones</label>
              <Button type="button" variant="ghost" size="xs" onClick={handleAddMilestone}
                className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1" leftIcon={<Plus size={12} />}>
                Add Milestone
              </Button>
            </div>
            <div className="space-y-2">
              {milestones.map((m, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input className="rounded-xl text-xs flex-1" placeholder="Milestone title..."
                    value={m.title} onChange={(e) => {
                      const copy = [...milestones];
                      copy[idx].title = e.target.value;
                      setMilestones(copy);
                    }} />
                  <Input type="date" className="rounded-xl text-xs w-36"
                    value={m.dueDate} onChange={(e) => {
                      const copy = [...milestones];
                      copy[idx].dueDate = e.target.value;
                      setMilestones(copy);
                    }} />
                  {milestones.length > 1 && (
                    <Button type="button" variant="danger" size="icon-sm" onClick={() => handleRemoveMilestone(idx)}
                      className="p-2 text-surface-500 hover:text-red-400">
                      <Trash2 size={13} />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1 rounded-xl">Cancel</Button>
            <Button type="submit" disabled={!name.trim()} className="flex-1 rounded-xl">
              Create Project
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
