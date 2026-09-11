import { useState } from 'react';
import { cn } from '@shared/utils/cn';
import { Avatar } from '@shared/components/ui/Avatar';
import type { Meeting } from '../types/meeting';

type Tab = 'chat' | 'tasks' | 'activity';

interface NextMeetingsPanelProps {
  meeting: Meeting | null;
  onCancel?: (meetingId: string) => void;
  onJoin?: (meeting: Meeting) => void;
}

export function NextMeetingsPanel({ meeting, onCancel, onJoin }: NextMeetingsPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('tasks');

  if (!meeting) {
    return (
      <div className="rounded-2xl border border-surface-200 p-6 dark:border-surface-800">
        <p className="text-center text-sm text-surface-400">No upcoming meetings</p>
      </div>
    );
  }

  const participants = meeting.participantIds || [];

  return (
    <div className="rounded-2xl border border-surface-200 bg-white p-4 dark:border-surface-800 dark:bg-surface-900">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold text-surface-800 dark:text-surface-100">Next Meeting</h3>
        <div className="flex gap-1">
          <button className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
          </button>
          <button className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4l3 3" />
            </svg>
          </button>
        </div>
      </div>

      <div className="mb-4 flex gap-1 rounded-lg bg-surface-100 p-1 dark:bg-surface-800">
        {(['chat', 'tasks', 'activity'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex-1 rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-colors',
              activeTab === tab
                ? 'bg-white text-surface-800 shadow dark:bg-surface-700 dark:text-surface-100'
                : 'text-surface-400 hover:text-surface-600 dark:hover:text-surface-300',
            )}
          >
            {tab}
            {tab === 'chat' && (
              <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] text-white">
                0
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <h4 className="mb-2 text-xs font-semibold text-surface-400">Attendees</h4>
        <div className="flex flex-wrap gap-1.5">
          {participants.map((p) => (
            <div
              key={p._id}
              className="flex items-center gap-1.5 rounded-full border border-surface-200 px-2 py-1 dark:border-surface-700"
            >
              <Avatar src={(p as any).avatar} name={(p as any).name} size="xs" />
              <span className="text-[11px] font-medium text-surface-600 dark:text-surface-400">
                {(p as any).name}
              </span>
              <button className="ml-0.5 text-surface-400 hover:text-danger-500">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-lg bg-surface-50 px-3 py-2 dark:bg-surface-800">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-surface-400">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <span className="text-xs text-surface-500">Today</span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onCancel?.(meeting._id)}
          className="flex-1 rounded-lg border border-surface-200 px-3 py-2 text-xs font-semibold text-surface-600 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-400 dark:hover:bg-surface-800"
        >
          Cancel
        </button>
        <button
          onClick={() => onJoin?.(meeting)}
          className="flex-1 rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-600"
        >
          Call
        </button>
      </div>

      <div className="mt-4 rounded-xl border border-surface-200 bg-gradient-to-r from-surface-50 to-surface-100 p-3 dark:border-surface-700 dark:from-surface-800 dark:to-surface-850">
        <p className="text-xs font-medium text-surface-500">Upgrade To Pro</p>
        <p className="mt-1 text-[11px] text-surface-400">Get advanced meeting features</p>
        <div className="mt-2 flex items-center gap-1 text-xs font-semibold text-brand-500">
          <span>Learn more</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </div>
      </div>
    </div>
  );
}
