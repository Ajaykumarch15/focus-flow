import { Check, CheckCheck } from 'lucide-react';

interface ReadEntry {
  user: string;
  readAt: string;
}

interface MessageStatusProps {
  readBy: ReadEntry[];
  senderId: string;
}

export function MessageStatus({ readBy, senderId }: MessageStatusProps) {
  const othersRead = readBy.filter((r) => r.user !== senderId);

  if (othersRead.length > 1) {
    return <CheckCheck size={12} className="text-brand-400 flex-shrink-0" />;
  }

  if (othersRead.length === 1) {
    return <CheckCheck size={12} className="text-surface-400 flex-shrink-0" />;
  }

  return <Check size={12} className="text-surface-400 flex-shrink-0" />;
}
