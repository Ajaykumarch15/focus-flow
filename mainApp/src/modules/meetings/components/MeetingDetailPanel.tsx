import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@shared/utils/cn';
import { Badge, type BadgeTone } from '@shared/components/ui/Badge';
import { Select } from '@shared/components/ui/Select';
import { MeetingParticipants } from './MeetingParticipants';
import { MeetingPlatformSelect } from './MeetingPlatformSelect';
import { MeetingLinkField } from './MeetingLinkField';
import { MeetingDatePicker } from './MeetingDatePicker';
import { MeetingNotesTab } from './MeetingNotesTab';
import { MeetingMediaTab } from './MeetingMediaTab';
import { MemberAvailabilityCheck } from './MemberAvailabilityCheck';
import { useMeetingStore } from '../services/useMeetingStore';
import type { Meeting, MeetingStatus } from '../types/meeting';
import { MEETING_STATUS_LABELS, MEETING_CATEGORY_LABELS } from '../types/meeting';

type DetailTab = 'info' | 'notes' | 'media';

const STATUS_TONE: Record<MeetingStatus, BadgeTone> = {
  scheduled: 'info',
  confirmed: 'success',
  in_progress: 'brand',
  completed: 'neutral',
  cancelled: 'danger',
};

interface MeetingDetailPanelProps {
  meeting: Meeting;
  canEdit?: boolean;
  onClose?: () => void;
}

export function MeetingDetailPanel({ meeting, canEdit = true }: MeetingDetailPanelProps) {
  const navigate = useNavigate();
  const { updateMeeting, updateStatus, addParticipant, removeParticipant, availableUsers, fetchAvailableUsers, meetings } = useMeetingStore();
  const [activeTab, setActiveTab] = useState<DetailTab>('info');

  useEffect(() => {
    fetchAvailableUsers();
  }, [fetchAvailableUsers]);

  const handleFieldUpdate = async (field: string, value: any) => {
    await updateMeeting(meeting._id, { [field]: value } as any);
  };

  const handleStatusChange = async (status: MeetingStatus) => {
    await updateStatus(meeting._id, status);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-surface-200 px-4 py-3 dark:border-surface-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          <div>
            <input
              type="text"
              value={meeting.title}
              onChange={(e) => handleFieldUpdate('title', e.target.value)}
              disabled={!canEdit}
              className="bg-transparent text-lg font-bold text-surface-800 focus:outline-none dark:text-surface-100"
            />
            <Select
              value={meeting.category}
              onChange={(e) => handleFieldUpdate('category', e.target.value)}
              className="mt-1 w-auto text-xs"
            >
              {Object.entries(MEETING_CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </Select>
          </div>
        </div>
        <Badge tone={STATUS_TONE[meeting.status]}>
          {MEETING_STATUS_LABELS[meeting.status]}
        </Badge>
      </div>

      <div className="flex gap-1 border-b border-surface-200 px-4 dark:border-surface-800">
        {(['info', 'notes', 'media'] as DetailTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold capitalize transition-colors',
              activeTab === tab
                ? 'border-brand-500 text-brand-500'
                : 'border-transparent text-surface-400 hover:text-surface-600 dark:hover:text-surface-300',
            )}
          >
            {tab === 'info' && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            )}
            {tab === 'notes' && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            )}
            {tab === 'media' && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            )}
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'info' && (
          <div className="space-y-5">
            <MeetingDatePicker
              date={meeting.date}
              startTime={meeting.startTime}
              endTime={meeting.endTime}
              allDay={meeting.allDay}
              onDateChange={(v) => handleFieldUpdate('date', v)}
              onStartTimeChange={(v) => handleFieldUpdate('startTime', v)}
              onEndTimeChange={(v) => handleFieldUpdate('endTime', v)}
              onAllDayChange={(v) => handleFieldUpdate('allDay', v)}
              canEdit={canEdit}
            />

            <MeetingParticipants
              organizer={meeting.organizerId}
              participants={meeting.participantIds}
              canEdit={canEdit}
              onAdd={(userId) => addParticipant(meeting._id, userId)}
              onRemove={(userId) => removeParticipant(meeting._id, userId)}
              availableUsers={availableUsers}
            />

            {/* Availability Check */}
            {!meeting.allDay && meeting.participantIds.length > 0 && (
              <MemberAvailabilityCheck
                participantIds={meeting.participantIds.map((p) => (typeof p === 'string' ? p : p._id))}
                date={meeting.date}
                startTime={meeting.startTime}
                endTime={meeting.endTime}
                meetings={meetings}
                excludeMeetingId={meeting._id}
              />
            )}

            <MeetingPlatformSelect
              value={meeting.platform}
              onChange={(v) => handleFieldUpdate('platform', v)}
            />

            <MeetingLinkField
              link={meeting.meetingLink}
              platform={meeting.platform}
            />

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-surface-400">Location</label>
              <input
                type="text"
                value={meeting.location}
                onChange={(e) => handleFieldUpdate('location', e.target.value)}
                disabled={!canEdit}
                placeholder="Add location..."
                className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-800 placeholder-surface-400 focus:border-brand-500 focus:outline-none disabled:opacity-50 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-200"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-surface-400">Status</label>
              <Select
                value={meeting.status}
                onChange={(e) => handleStatusChange(e.target.value as MeetingStatus)}
              >
                {Object.entries(MEETING_STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </Select>
            </div>
          </div>
        )}

        {activeTab === 'notes' && (
          <MeetingNotesTab
            notes={meeting.notes}
            canEdit={canEdit}
            onSave={(notes) => handleFieldUpdate('notes', notes)}
          />
        )}

        {activeTab === 'media' && (
          <MeetingMediaTab
            meetingId={meeting._id}
            canEdit={canEdit}
          />
        )}
      </div>
    </div>
  );
}
