import { useState } from 'react';
import { Avatar } from '@shared/components/ui/Avatar';
import type { MeetingParticipant } from '../types/meeting';
import { X, Plus, Search } from 'lucide-react';

interface MeetingParticipantsProps {
  organizer: MeetingParticipant;
  participants: MeetingParticipant[];
  canEdit?: boolean;
  onAdd?: (userId: string) => void;
  onRemove?: (userId: string) => void;
  availableUsers?: MeetingParticipant[];
}

export function MeetingParticipants({
  organizer,
  participants,
  canEdit = false,
  onAdd,
  onRemove,
  availableUsers = [],
}: MeetingParticipantsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const allParticipants = [organizer, ...participants.filter((p) => p._id !== organizer._id)];
  const filteredUsers = availableUsers.filter(
    (u) =>
      !allParticipants.some((p) => p._id === u._id) &&
      (u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-surface-400">
          Participants ({allParticipants.length})
        </label>
        {canEdit && onAdd && (
          <button
            onClick={() => setIsSearching(!isSearching)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-brand-500 hover:bg-brand-500/10"
          >
            <Plus size={14} />
            Add
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {allParticipants.map((p) => (
          <div
            key={p._id}
            className="group flex items-center gap-2 rounded-full border border-surface-200 bg-surface-50 pr-2 dark:border-surface-700 dark:bg-surface-800"
          >
            <Avatar src={(p as any).avatar} name={p.name} size="sm" />
            <span className="text-xs font-medium text-surface-700 dark:text-surface-300">
              {p.name}
              {p._id === organizer._id && (
                <span className="ml-1 text-[10px] text-surface-400">(Host)</span>
              )}
            </span>
            {canEdit && p._id !== organizer._id && onRemove && (
              <button
                onClick={() => onRemove(p._id)}
                className="ml-0.5 rounded-full p-0.5 text-surface-400 opacity-0 transition-opacity hover:bg-danger-500/10 hover:text-danger-500 group-hover:opacity-100"
              >
                <X size={12} />
              </button>
            )}
          </div>
        ))}
      </div>

      {isSearching && canEdit && (
        <div className="space-y-2 rounded-lg border border-surface-200 p-2 dark:border-surface-700">
          <div className="relative">
            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-surface-200 bg-white py-1.5 pl-7 pr-2 text-xs text-surface-800 placeholder-surface-400 focus:border-brand-500 focus:outline-none dark:border-surface-700 dark:bg-surface-800 dark:text-surface-200"
              autoFocus
            />
          </div>
          {filteredUsers.length > 0 && (
            <div className="max-h-32 space-y-1 overflow-y-auto">
              {filteredUsers.map((u) => (
                <button
                  key={u._id}
                  onClick={() => {
                    if (onAdd) onAdd(u._id);
                    setSearchQuery('');
                    setIsSearching(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-surface-100 dark:hover:bg-surface-800"
                >
                  <Avatar src={(u as any).avatar} name={u.name} size="xs" />
                  <span className="text-xs font-medium text-surface-700 dark:text-surface-300">{u.name}</span>
                  <span className="text-[10px] text-surface-400">{u.email}</span>
                </button>
              ))}
            </div>
          )}
          {searchQuery && filteredUsers.length === 0 && (
            <p className="text-center text-xs text-surface-400">No users found</p>
          )}
        </div>
      )}
    </div>
  );
}
