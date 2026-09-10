import { useState, useMemo } from 'react';
import { Search, Check, UserPlus } from 'lucide-react';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { api } from '@shared/utils/api';
import { Dialog } from '@shared/components/ui/Dialog';
import { Button } from '@shared/components/ui/Button';
import { toast } from '@shared/services/useToastStore';

interface AddProjectMembersModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
}

export function AddProjectMembersModal({ open, onClose, projectId }: AddProjectMembersModalProps) {
  const members = useCollaborationStore((s) => s.members);
  const projects = useCollaborationStore((s) => s.projects);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  const project = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId],
  );

  const projectMemberIds = useMemo(
    () => new Set(project?.members.map((m) => m.userId) ?? []),
    [project],
  );

  const availableMembers = useMemo(
    () => members.filter((m) => !projectMemberIds.has(m.id)),
    [members, projectMemberIds],
  );

  const filtered = useMemo(
    () =>
      availableMembers.filter(
        (m) =>
          m.name.toLowerCase().includes(search.toLowerCase()) ||
          m.email.toLowerCase().includes(search.toLowerCase()),
      ),
    [availableMembers, search],
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
    if (selected.size === 0) return;
    setAdding(true);
    try {
      const userIds = Array.from(selected);
      await Promise.all(
        userIds.map((userId) => api.projects.addMember(projectId, { userId, role: 'nonadmin' })),
      );
      toast.success('Members added', `${userIds.length} member(s) added to the project`);
      setSelected(new Set());
      onClose();
    } catch {
      toast.error('Error', 'Failed to add some members');
    } finally {
      setAdding(false);
    }
  };

  const handleClose = () => {
    if (!adding) {
      setSelected(new Set());
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Add from Workspace"
      description="Select workspace members to add to this project."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={adding}>
            Cancel
          </Button>
          <Button onClick={handleAdd} loading={adding} disabled={selected.size === 0} leftIcon={<UserPlus size={14} />}>
            Add {selected.size > 0 ? `${selected.size} Member(s)` : 'Members'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
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

        <div className="max-h-80 overflow-y-auto space-y-1 scrollbar-thin">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <span className="text-xs text-surface-500 italic">
                {availableMembers.length === 0
                  ? 'All workspace members are already in this project.'
                  : 'No members found.'}
              </span>
            </div>
          ) : (
            filtered.map((member) => {
              const isSelected = selected.has(member.id);
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => toggle(member.id)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-left ${
                    isSelected
                      ? 'bg-brand-500/10 border border-brand-500/30'
                      : 'hover:bg-surface-800 border border-transparent'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-surface-700 flex items-center justify-center text-xs font-bold text-surface-300 flex-shrink-0 overflow-hidden">
                    {member.avatar ? (
                      <img src={member.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      member.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-surface-100 truncate">{member.name}</p>
                    <p className="text-[11px] text-surface-400 truncate">{member.email}</p>
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
