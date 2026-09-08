import { useState } from 'react';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { useAuthStore } from '@shared/services/useAuthStore';
import { api } from '@shared/utils/api';
import { Dialog } from '@shared/components/ui/Dialog';
import { Button } from '@shared/components/ui/Button';
import { toast } from '@shared/services/useToastStore';

interface InvitePeopleModalProps {
  open: boolean;
  onClose: () => void;
}

export function InvitePeopleModal({ open, onClose }: InvitePeopleModalProps) {
  const { teams, activeWorkspaceId } = useCollaborationStore();
  const { user } = useAuthStore();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('nonadmin');
  const [teamId, setTeamId] = useState('');
  const [loading, setLoading] = useState(false);

  const isSuperAdmin = (user?.roleId?.level ?? 0) === 100;
  const availableRoles = isSuperAdmin ? ['nonadmin', 'admin', 'superadmin'] : ['nonadmin', 'admin'];

  const handleSubmit = async () => {
    if (!email.trim() || !activeWorkspaceId) return;
    setLoading(true);
    try {
      await api.workspaces.invite(activeWorkspaceId, { email: email.trim(), role });
      toast.success('Invite sent', `An invitation has been sent to ${email}`);
      setEmail('');
      setRole('nonadmin');
      setTeamId('');
      onClose();
    } catch (err: any) {
      const message = err?.message || 'Failed to send invite';
      toast.error('Invite failed', message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setEmail('');
      setRole('nonadmin');
      setTeamId('');
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Invite People"
      description="Send an invitation to join this workspace."
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={loading} disabled={!email.trim()}>
            Send Invite
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Email */}
        <div className="space-y-1.5">
          <label htmlFor="invite-email" className="text-xs font-semibold text-surface-300">
            Email address
          </label>
          <input
            id="invite-email"
            type="email"
            placeholder="colleague@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input text-sm"
            autoFocus
          />
        </div>

        {/* Role */}
        <div className="space-y-1.5">
          <label htmlFor="invite-role" className="text-xs font-semibold text-surface-300">
            Role
          </label>
          <select
            id="invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="input appearance-none text-sm cursor-pointer"
          >
            {availableRoles.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* Team */}
        <div className="space-y-1.5">
          <label htmlFor="invite-team" className="text-xs font-semibold text-surface-300">
            Team <span className="text-surface-500 font-normal">(optional)</span>
          </label>
          <select
            id="invite-team"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="input appearance-none text-sm cursor-pointer"
          >
            <option value="">No team</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Dialog>
  );
}
