import { useEffect } from 'react';
import { useChatStore } from '@collab/stores/useChatStore';
import { OnlineStatusBadge } from './OnlineStatusBadge';
import { Avatar } from '@shared/components/ui/Avatar';

interface ParticipantsPanelProps {
  conversationId: string;
}

export function ParticipantsPanel({ conversationId }: ParticipantsPanelProps) {
  const participants = useChatStore((s) => s.participants[conversationId] || []);
  const loadParticipants = useChatStore((s) => s.loadParticipants);

  useEffect(() => {
    if (conversationId) {
      loadParticipants(conversationId);
    }
  }, [conversationId, loadParticipants]);

  return (
    <div className="w-64 border-l border-surface-800 bg-surface-900 flex flex-col h-full">
      <div className="p-4 border-b border-surface-800">
        <h3 className="text-sm font-semibold text-surface-200">
          Participants ({participants.length})
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {participants.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-800 transition-colors"
          >
            <div className="relative flex-shrink-0">
              <Avatar src={p.avatar} name={p.name} size="sm" />
              <span className="absolute -bottom-0.5 -right-0.5">
                <OnlineStatusBadge userId={p.id} size="sm" />
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-surface-200 truncate">{p.name}</span>
                {p.role && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-500/20 text-brand-400 font-medium flex-shrink-0">
                    {p.role}
                  </span>
                )}
              </div>
              <span className="text-xs text-surface-500 truncate block">{p.email}</span>
            </div>
          </div>
        ))}

        {participants.length === 0 && (
          <div className="text-center text-surface-500 text-sm py-8">No participants found</div>
        )}
      </div>
    </div>
  );
}
