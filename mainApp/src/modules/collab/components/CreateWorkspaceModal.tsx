import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Building2, X, Check, Search } from 'lucide-react';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import type { WorkspaceType } from '@collab/types/collaboration';
import { api } from '@shared/utils/api';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Textarea } from '@shared/components/ui/Textarea';
import { Select } from '@shared/components/ui/Select';
import { Avatar } from '@shared/components/ui/Avatar';

const WORKSPACE_TYPES: WorkspaceType[] = [
  'Startup', 'Personal', 'College Project', 'Open Source', 'Internship', 'Enterprise',
];

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UserOption {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
}

export function CreateWorkspaceModal({ isOpen, onClose }: CreateWorkspaceModalProps) {
  const { createWorkspace } = useCollaborationStore();
  const [name, setName] = useState('');
  const [type, setType] = useState<WorkspaceType>('Startup');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const [users, setUsers] = useState<UserOption[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;
    setUsersLoading(true);
    api.users.list()
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setUsers([]))
      .finally(() => setUsersLoading(false));
  }, [isOpen]);

  const filteredUsers = useMemo(() => {
    if (!memberSearch.trim()) return users;
    const q = memberSearch.toLowerCase();
    return users.filter((u) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
  }, [users, memberSearch]);

  const toggleMember = (userId: string) => {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    const members = Array.from(selectedMembers).map((userId) => ({
      userId,
      role: 'nonadmin' as const,
      isProjectManager: false,
    }));
    const created = await createWorkspace(name.trim(), type, description.trim(), members.length > 0 ? members : undefined);
    setSaving(false);
    if (created) {
      setName('');
      setType('Startup');
      setDescription('');
      setSelectedMembers(new Set());
      setMemberSearch('');
      onClose();
    }
  };

  if (!isOpen) return null;

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
        className="bg-surface-900 border border-surface-700/80 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-800 bg-surface-850/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
              <Building2 size={18} />
            </div>
            <div>
              <h2 className="text-base font-display font-bold text-surface-50">Create Workspace</h2>
              <p className="text-xs text-surface-400">Set up a new engineering workspace.</p>
            </div>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} className="p-1.5 text-surface-500 hover:text-surface-200 rounded-lg">
            <X size={18} />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
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

          <div>
            <label className="block text-xs font-semibold text-surface-300 mb-1.5">
              Add Members {selectedMembers.size > 0 && <span className="text-brand-400">({selectedMembers.size} selected)</span>}
            </label>
            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
              <Input
                className="rounded-xl text-sm w-full pl-8"
                placeholder="Search by name or email..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
              />
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1 rounded-xl border border-surface-800 bg-surface-900/50 p-2">
              {usersLoading ? (
                <p className="text-xs text-surface-500 text-center py-3">Loading users...</p>
              ) : filteredUsers.length === 0 ? (
                <p className="text-xs text-surface-500 text-center py-3">No users found</p>
              ) : (
                filteredUsers.map((u) => {
                  const isSelected = selectedMembers.has(u._id);
                  return (
                    <button
                      key={u._id}
                      type="button"
                      onClick={() => toggleMember(u._id)}
                      className={`w-full flex items-center gap-2.5 p-2 rounded-lg transition-all text-left ${
                        isSelected
                          ? 'bg-brand-500/10 border border-brand-500/30'
                          : 'hover:bg-surface-850 border border-transparent'
                      }`}
                    >
                      <Avatar name={u.name || u.email} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-surface-200 truncate">{u.name || u.email}</p>
                        <p className="text-[10px] text-surface-500 truncate">{u.email}</p>
                      </div>
                      {isSelected && <Check size={12} className="text-brand-400 shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-2 shrink-0">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1 rounded-xl">Cancel</Button>
            <Button type="submit" disabled={!name.trim() || saving} loading={saving} className="flex-1 rounded-xl">
              Create Workspace
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
