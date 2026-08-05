import { ShieldCheck } from 'lucide-react';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import { MemberRole } from '../../types/collaboration';
import { PageHeader } from '../../components/ui/PageHeader';

// ECIS B.8 (IA 8.1, L3): the roster and role-based access surface. Deep-link
// only from the Administration sidebar — never on the daily Planning nav. It
// was split out of the TeamWorkspace mega-tab into its own focused page (S4-T3).
export function WorkspaceTeamsPage() {
  const { members, updateMemberRole } = useCollaborationStore();

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <PageHeader
        title="Teams & Access"
        description="Manage the roster and role-based permissions across this workspace."
        icon={<ShieldCheck size={18} className="text-orange-400" />}
      />

      <div className="rounded-2xl border border-surface-800 bg-surface-900 p-6 space-y-4">
        <h2 className="text-base font-display font-extrabold text-surface-50 flex items-center gap-2">
          <ShieldCheck size={18} className="text-orange-400" /> Team Roster & Role-Based Access
        </h2>
        <div className="divide-y divide-surface-800">
          {members.map((m) => (
            <div key={m.id} className="py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-cyan-500 flex items-center justify-center text-xs font-bold text-white">
                  {m.name.charAt(0)}
                </div>
                <div>
                  <p className="text-xs font-bold text-surface-100">{m.name}</p>
                  <p className="text-[11px] text-surface-500">{m.email}</p>
                </div>
              </div>
              <select aria-label="Member role" className="bg-surface-850 text-surface-200 text-xs rounded-lg border border-surface-700 px-2 py-1"
                value={m.role} onChange={(e) => updateMemberRole(m.id, e.target.value as MemberRole)}>
                <option value="Owner">Owner</option>
                <option value="Admin">Admin</option>
                <option value="Manager">Manager</option>
                <option value="Developer">Developer</option>
                <option value="Viewer">Viewer</option>
              </select>
            </div>
          ))}
        </div>
        {members.length === 0 && (
          <p className="text-xs text-surface-500 italic py-4 text-center">No members in this workspace yet.</p>
        )}
      </div>
    </div>
  );
}
