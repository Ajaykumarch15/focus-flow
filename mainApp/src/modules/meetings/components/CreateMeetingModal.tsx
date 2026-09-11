import { useState, useEffect, useMemo } from 'react';
import { Dialog } from '@shared/components/ui/Dialog';
import { Button } from '@shared/components/ui/Button';
import { Select } from '@shared/components/ui/Select';
import { Avatar } from '@shared/components/ui/Avatar';
import { toast } from '@shared/services/useToastStore';
import { useMeetingStore } from '../services/useMeetingStore';
import { MemberAvailabilityCheck } from './MemberAvailabilityCheck';
import type { MeetingPlatform, MeetingCategory, MeetingCreatePayload } from '../types/meeting';
import { MEETING_PLATFORM_LABELS, MEETING_CATEGORY_LABELS } from '../types/meeting';
import { Search, X, Check } from 'lucide-react';

interface CreateMeetingModalProps {
  open: boolean;
  onClose: () => void;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function CreateMeetingModal({ open, onClose }: CreateMeetingModalProps) {
  const { createMeeting, loading, availableUsers, fetchAvailableUsers, meetings } = useMeetingStore();

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayStr());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [allDay, setAllDay] = useState(false);
  const [platform, setPlatform] = useState<MeetingPlatform>('google_meet');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState<MeetingCategory>('essentials');
  const [description, setDescription] = useState('');
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [participantSearch, setParticipantSearch] = useState('');
  const [showParticipantPicker, setShowParticipantPicker] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle('');
      setDate(todayStr());
      setStartTime('09:00');
      setEndTime('10:00');
      setAllDay(false);
      setPlatform('google_meet');
      setLocation('');
      setCategory('essentials');
      setDescription('');
      setParticipantIds([]);
      setParticipantSearch('');
      setShowParticipantPicker(false);
      fetchAvailableUsers();
    }
  }, [open, fetchAvailableUsers]);

  const filteredUsers = useMemo(() => {
    if (!participantSearch.trim()) return availableUsers;
    const q = participantSearch.toLowerCase();
    return availableUsers.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [availableUsers, participantSearch]);

  const toggleParticipant = (userId: string) => {
    setParticipantIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const removeParticipant = (userId: string) => {
    setParticipantIds((prev) => prev.filter((id) => id !== userId));
  };

  const selectedUsers = useMemo(
    () => availableUsers.filter((u) => participantIds.includes(u._id)),
    [availableUsers, participantIds],
  );

  const handleSubmit = async () => {
    if (!title.trim()) return;

    const payload: MeetingCreatePayload = {
      title: title.trim(),
      date,
      startTime,
      endTime,
      allDay,
      platform,
      location: location.trim() || undefined,
      category,
      description: description.trim() || undefined,
      participantIds: participantIds.length > 0 ? participantIds : undefined,
    };

    const meeting = await createMeeting(payload);
    if (meeting) {
      toast.success('Meeting created', `"${title.trim()}" has been scheduled.`);
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New Meeting"
      description="Schedule a new meeting."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={loading} disabled={!title.trim()}>
            Create Meeting
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="meeting-title" className="text-xs font-semibold text-surface-400">Title</label>
          <input
            id="meeting-title"
            type="text"
            placeholder="Board Meeting..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input text-sm"
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="meeting-category" className="text-xs font-semibold text-surface-400">Category</label>
            <Select
              id="meeting-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as MeetingCategory)}
            >
              {Object.entries(MEETING_CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="meeting-platform" className="text-xs font-semibold text-surface-400">Platform</label>
            <Select
              id="meeting-platform"
              value={platform}
              onChange={(e) => setPlatform(e.target.value as MeetingPlatform)}
            >
              {Object.entries(MEETING_PLATFORM_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="meeting-date" className="text-xs font-semibold text-surface-400">Date & Time</label>
            <label className="flex items-center gap-2 text-xs text-surface-400">
              <span>All day</span>
              <button
                type="button"
                onClick={() => setAllDay(!allDay)}
                className={`relative h-5 w-9 rounded-full transition-colors ${allDay ? 'bg-brand-500' : 'bg-surface-300 dark:bg-surface-600'}`}
              >
                <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${allDay ? 'left-[18px]' : 'left-0.5'}`} />
              </button>
            </label>
          </div>
          <input
            id="meeting-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input text-sm"
          />
        </div>

        {!allDay && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="meeting-start" className="text-xs font-semibold text-surface-400">Start time</label>
              <input
                id="meeting-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="input text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="meeting-end" className="text-xs font-semibold text-surface-400">End time</label>
              <input
                id="meeting-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="input text-sm"
              />
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="meeting-location" className="text-xs font-semibold text-surface-400">Location</label>
          <input
            id="meeting-location"
            type="text"
            placeholder="Meeting link or location..."
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="input text-sm"
          />
        </div>

        {/* Participants Section */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-surface-400">
            Participants {participantIds.length > 0 && `(${participantIds.length})`}
          </label>

          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedUsers.map((u) => (
                <div
                  key={u._id}
                  className="flex items-center gap-1.5 rounded-full border border-surface-200 bg-surface-50 pr-1.5 dark:border-surface-700 dark:bg-surface-800"
                >
                  <Avatar src={u.avatar} name={u.name} size="xs" />
                  <span className="text-[11px] font-medium text-surface-600 dark:text-surface-400">
                    {u.name}
                  </span>
                  <button
                    onClick={() => removeParticipant(u._id)}
                    className="ml-0.5 rounded-full p-0.5 text-surface-400 hover:bg-danger-500/10 hover:text-danger-500"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowParticipantPicker(!showParticipantPicker)}
            className="flex w-full items-center gap-2 rounded-lg border border-dashed border-surface-300 px-3 py-2 text-xs text-surface-400 hover:border-brand-500/50 hover:text-brand-500 dark:border-surface-600"
          >
            <Search size={14} />
            {showParticipantPicker ? 'Close picker' : 'Add participants...'}
          </button>

          {showParticipantPicker && (
            <div className="space-y-2 rounded-lg border border-surface-200 p-2 dark:border-surface-700">
              <div className="relative">
                <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-surface-400" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={participantSearch}
                  onChange={(e) => setParticipantSearch(e.target.value)}
                  className="w-full rounded-lg border border-surface-200 bg-white py-1.5 pl-7 pr-2 text-xs text-surface-800 placeholder-surface-400 focus:border-brand-500 focus:outline-none dark:border-surface-700 dark:bg-surface-800 dark:text-surface-200"
                  autoFocus
                />
              </div>
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {filteredUsers.length === 0 && (
                  <p className="py-2 text-center text-xs text-surface-400">No users found</p>
                )}
                {filteredUsers.map((u) => {
                  const isSelected = participantIds.includes(u._id);
                  return (
                    <button
                      key={u._id}
                      type="button"
                      onClick={() => toggleParticipant(u._id)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors ${
                        isSelected
                          ? 'bg-brand-500/10 border border-brand-500/30'
                          : 'hover:bg-surface-100 dark:hover:bg-surface-800'
                      }`}
                    >
                      <Avatar src={u.avatar} name={u.name} size="xs" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-surface-700 dark:text-surface-300">
                          {u.name}
                        </p>
                        <p className="truncate text-[10px] text-surface-400">{u.email}</p>
                      </div>
                      {isSelected && <Check size={14} className="text-brand-500" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Availability Check */}
        {participantIds.length > 0 && !allDay && (
          <MemberAvailabilityCheck
            participantIds={participantIds}
            date={date}
            startTime={startTime}
            endTime={endTime}
            meetings={meetings}
          />
        )}

        <div className="space-y-1.5">
          <label htmlFor="meeting-desc" className="text-xs font-semibold text-surface-400">Description</label>
          <textarea
            id="meeting-desc"
            placeholder="Add notes..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input text-sm min-h-[80px] resize-y"
          />
        </div>
      </div>
    </Dialog>
  );
}
