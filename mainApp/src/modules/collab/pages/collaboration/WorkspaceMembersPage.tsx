import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCheck, Shield } from 'lucide-react';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import type { MemberStatus } from '@collab/types/collaboration';
import { Badge, type BadgeTone } from '@shared/components/ui/Badge';
import { Button } from '@shared/components/ui/Button';
import { PageHeader } from '@shared/components/ui/PageHeader';

// ECIS B.8 (IA 8.1, L3): the roster directory. Deep-link only from the
// Administration sidebar — never on the daily Planning nav. Splitting it out
// gives MemberProfilePage a stable "Back to Member Roster" target and turns the
// old sidebar-only surface into a navigable page (S4-T3).
const STATUS_TONE: Record<MemberStatus, BadgeTone> = {
  in_focus: 'warning',
  available: 'success',
  in_meeting: 'brand',
  away: 'warning',
  offline: 'neutral',
};

export function WorkspaceMembersPage() {
  const { members, activeWorkspaceId } = useCollaborationStore();
  const navigate = useNavigate();

  const onlineCount = useMemo(() => members.filter((m) => m.status !== 'offline').length, [members]);

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <PageHeader
        title="Member Roster"
        description={`${onlineCount}/${members.length} members online across this workspace.`}
        icon={<UserCheck size={18} className="text-sky-400" />}
      />

      {members.length === 0 && (
        <div className="rounded-2xl border border-dashed border-surface-700 bg-surface-900/60 p-12 text-center">
          <UserCheck size={28} className="mx-auto text-sky-400/60 mb-3" />
          <p className="text-xs font-bold text-surface-300 mb-1">No members yet</p>
          <p className="text-xs text-surface-500 italic">Invite teammates to get the workspace moving.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {members.map((m) => (
          <div key={m.id} className="rounded-2xl border border-surface-800 bg-surface-900 p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-cyan-500 flex items-center justify-center text-sm font-bold text-white shrink-0">
                {m.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-surface-50 truncate">{m.name}</p>
                <p className="text-[11px] text-surface-500 truncate">{m.email}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={STATUS_TONE[m.status]} className="text-[10px] font-extrabold uppercase tracking-wider">
                {m.status.replace('_', ' ')}
              </Badge>
              <Badge tone="brand" className="text-[10px] font-bold uppercase tracking-wider border border-brand-500/20">
                {m.role}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {m.teams.length === 0 && (
                <span className="text-[10px] text-surface-500 italic">No teams yet</span>
              )}
              {m.teams.map((t) => (
                <span key={t} className="text-[10px] font-bold text-surface-300 bg-surface-850 border border-surface-700 rounded-lg px-2 py-0.5">
                  {t}
                </span>
              ))}
            </div>

            <div className="pt-1 flex items-center justify-between">
              <span className="text-[10px] text-surface-500 font-mono">Joined {new Date(m.joinedAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              <Button
                variant="ghost" size="xs"
                onClick={() => navigate(`/w/${activeWorkspaceId}/members/${m.id}`)}
                className="text-brand-400 hover:text-brand-300 hover:bg-brand-500/10"
                leftIcon={<Shield size={12} />}
              >
                View Profile
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
