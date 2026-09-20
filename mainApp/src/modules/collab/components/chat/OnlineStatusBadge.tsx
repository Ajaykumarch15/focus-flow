import { useChatStore } from '@collab/stores/useChatStore';

export function OnlineStatusBadge({ userId, size = 'sm' }: { userId: string; size?: 'sm' | 'md' }) {
  const onlineUsers = useChatStore((s) => s.onlineUsers);
  const isOnline = !!onlineUsers[userId];
  const sizeClass = size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3';

  return (
    <span
      className={`${sizeClass} rounded-full border-2 border-surface-900 flex-shrink-0 ${
        isOnline ? 'bg-success-400' : 'bg-surface-600'
      }`}
      title={isOnline ? 'Online' : 'Offline'}
    />
  );
}
