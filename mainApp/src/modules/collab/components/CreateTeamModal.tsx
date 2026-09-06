import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, X, Check, Crown } from 'lucide-react';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Textarea } from '@shared/components/ui/Textarea';

export function CreateTeamModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { createTeam, members } = useCollaborationStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [leaderId, setLeaderId] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const filtered = members.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase()),
  );

  const selectedMemberObjects = members.filter((m) => selectedMembers.includes(m.id));

  const toggleMember = (id: string) => {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    if (leaderId === id) setLeaderId('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || selectedMembers.length === 0) return;
    setSaving(true);
    try {
      await createTeam(name.trim(), description.trim(), '#8b5cf6', selectedMembers, leaderId || undefined);
      onClose();
      setName('');
      setDescription('');
      setSelectedMembers([]);
      setLeaderId('');
      setSearch('');
    } finally {
      setSaving(false);
    }
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
        className="bg-surface-900 border border-surface-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-800 bg-surface-850/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Users size={18} />
            </div>
            <div>
              <h2 className="text-base font-display font-bold text-surface-50">Create Team</h2>
              <p className="text-xs text-surface-400">Group members into a team</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            className="p-1.5 text-surface-500 hover:text-surface-200 rounded-lg"
          >
            <X size={18} />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-surface-300 mb-1.5">
              Team Name <span className="text-red-400">*</span>
            </label>
            <Input
              className="rounded-xl text-sm w-full"
              placeholder="e.g. Frontend, Backend, Design..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-surface-300 mb-1.5">Description</label>
            <Textarea
              rows={2}
              className="rounded-xl text-sm w-full resize-none"
              placeholder="What does this team work on?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Members */}
          <div>
            <label className="block text-xs font-semibold text-surface-300 mb-1.5">
              Members <span className="text-red-400">*</span> ({selectedMembers.length})
            </label>
            <Input
              className="rounded-xl text-sm w-full mb-2"
              placeholder="Search workspace members..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="max-h-40 overflow-y-auto space-y-1 scrollbar-thin">
              {filtered.length === 0 ? (
                <p className="text-xs text-surface-500 italic py-2">No members found.</p>
              ) : (
                filtered.map((m) => {
                  const selected = selectedMembers.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleMember(m.id)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-left ${
                        selected
                          ? 'bg-purple-500/10 border border-purple-500/30'
                          : 'hover:bg-surface-850 border border-transparent'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-full bg-surface-800 flex items-center justify-center text-xs font-bold text-surface-300">
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-surface-200 truncate">{m.name}</p>
                      </div>
                      {selected && <Check size={14} className="text-purple-400" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Team Leader */}
          {selectedMembers.length > 0 && (
            <div>
              <label
                htmlFor="collab-team-leader"
                className="text-xs font-semibold text-surface-300 mb-1.5 flex items-center gap-1.5"
              >
                <Crown size={12} className="text-yellow-400" /> Team Leader
              </label>
              <select
                id="collab-team-leader"
                value={leaderId}
                onChange={(e) => setLeaderId(e.target.value)}
                className="w-full rounded-xl text-sm bg-surface-800 border border-surface-700 text-surface-200 px-3 py-2.5 outline-none focus:border-purple-500/50 transition-colors"
              >
                <option value="">No leader assigned</option>
                {selectedMemberObjects.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1 rounded-xl">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || selectedMembers.length === 0 || saving}
              loading={saving}
              className="flex-1 rounded-xl"
            >
              Create Team
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
