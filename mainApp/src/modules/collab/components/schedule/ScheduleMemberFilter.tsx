import { Avatar } from '@shared/components/ui/Avatar';
import { cn } from '@shared/utils/cn';
import type { WorkspaceMember } from '@collab/types/collaboration';

interface ScheduleMemberFilterProps {
  members: WorkspaceMember[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

function getMemberUserId(member: WorkspaceMember): string {
  return member.id;
}

export function ScheduleMemberFilter({ members, selectedIds, onChange }: ScheduleMemberFilterProps) {
  const allSelected = selectedIds.length === 0 || selectedIds.length === members.length;

  const toggleAll = () => {
    onChange(allSelected ? [] : members.map(getMemberUserId));
  };

  const toggleMember = (id: string) => {
    if (selectedIds.length === 0) {
      // All are selected; deselect this one
      onChange(members.filter((m) => getMemberUserId(m) !== id).map(getMemberUserId));
    } else if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((sid) => sid !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        type="button"
        onClick={toggleAll}
        className={cn(
          'px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors',
          allSelected
            ? 'bg-brand-500/15 border-brand-500/30 text-brand-300'
            : 'bg-surface-900 border-surface-800 text-surface-400 hover:text-surface-300',
        )}
      >
        All
      </button>
      {members.map((member) => {
        const id = getMemberUserId(member);
        const isSelected = allSelected || selectedIds.includes(id);
        return (
          <button
            key={id}
            type="button"
            onClick={() => toggleMember(id)}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-colors',
              isSelected
                ? 'bg-brand-500/15 border-brand-500/30'
                : 'bg-surface-900 border-surface-800 opacity-50 hover:opacity-75',
            )}
          >
            <Avatar
              src={member.avatar}
              name={member.name}
              size="xs"
            />
            <span className={cn('text-[11px] font-medium', isSelected ? 'text-surface-100' : 'text-surface-400')}>
              {member.name.split(' ')[0]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
