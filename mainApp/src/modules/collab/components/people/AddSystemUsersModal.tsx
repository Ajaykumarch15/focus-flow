import { useState, useEffect } from 'react';
import { Search, Check, UserPlus } from 'lucide-react';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { api } from '@shared/utils/api';
import { Dialog } from '@shared/components/ui/Dialog';
import { Button } from '@shared/components/ui/Button';
import { toast } from '@shared/services/useToastStore';

interface AddSystemUsersModalProps {
  open: boolean;
  onClose: () => void;
}

interface SystemUser {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
}

export function AddSystemUsersModal({ open, onClose }: AddSystemUsersModalProps) {
  const { activeWorkspaceId, loadMembers } = useCollaborationStore();
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open || !activeWorkspaceId) return;
    setLoading(true);
    setSelected(new Set());
    setSearch('');
    api.workspaces.availableUsers(activeWorkspaceId)
      .then((data) => setUsers(data))
      .catch(() => toast.error('Error', 'Failed to load system users'))
      .finally(() => setLoading(false));
  }, [open, activeWorkspaceId]);

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = async () => {
    if (!activeWorkspaceId || selected.size === 0) return;
    setAdding(true);
    try {
      const userIds = Array.from(selected);
      await Promise.all(
        userIds.map((userId) => api.workspaces.invite(activeWorkspaceId, { userId })),
      );
      toast.success('Users added', `${userIds.length} user(s) added to the workspace`);
      loadMembers(activeWorkspaceId);
      onClose();
    } catch {
      toast.error('Error', 'Failed to add some users');
    } finally {
      setAdding(false);
    }
  };

  const handleClose = () => {
    if (!adding) onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Add from System Users"
      description="Select existing users to add to this workspace."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={adding}>
            Cancel
          </Button>
          <Button onClick={handleAdd} loading={adding} disabled={selected.size === 0} leftIcon={<UserPlus size={14} />}>
            Add {selected.size > 0 ? `${selected.size} User(s)` : 'Users'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surface-800 border border-surface-700 focus:border-brand-500/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-surface-100 outline-none transition-colors placeholder:text-surface-500"
            autoFocus
          />
        </div>

        {/* User list */}
        <div className="max-h-80 overflow-y-auto space-y-1 scrollbar-thin">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <span className="text-xs text-surface-400">Loading users...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <span className="text-xs text-surface-500 italic">
                {users.length === 0 ? 'All system users are already in this workspace.' : 'No users found.'}
              </span>
            </div>
          ) : (
            filtered.map((user) => {
              const isSelected = selected.has(user._id);
              return (
                <button
                  key={user._id}
                  type="button"
                  onClick={() => toggle(user._id)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-left ${
                    isSelected
                      ? 'bg-brand-500/10 border border-brand-500/30'
                      : 'hover:bg-surface-800 border border-transparent'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-surface-700 flex items-center justify-center text-xs font-bold text-surface-300 flex-shrink-0">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-surface-100 truncate">{user.name}</p>
                    <p className="text-[11px] text-surface-400 truncate">{user.email}</p>
                  </div>
                  {isSelected && <Check size={14} className="text-brand-400 flex-shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      </div>
    </Dialog>
  );
}
