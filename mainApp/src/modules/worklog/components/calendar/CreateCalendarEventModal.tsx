import { useState, useEffect } from 'react';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { useCalendarStore } from '@worklog/services/useCalendarStore';
import { Dialog } from '@shared/components/ui/Dialog';
import { Button } from '@shared/components/ui/Button';
import { toast } from '@shared/services/useToastStore';
import type { CalendarEvent, CalendarEventType } from '@worklog/types/calendar';

interface CreateCalendarEventModalProps {
  open: boolean;
  onClose: () => void;
  defaults?: Partial<CalendarEvent> | null;
}

const TYPE_OPTIONS: Array<{ value: CalendarEventType; label: string }> = [
  { value: 'task', label: 'Task' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'event', label: 'Event' },
  { value: 'reminder', label: 'Reminder' },
];

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function CreateCalendarEventModal({ open, onClose, defaults }: CreateCalendarEventModalProps) {
  const { addEvent } = useCalendarStore();
  const { projects } = useCollaborationStore();

  const [type, setType] = useState<CalendarEventType>(defaults?.type || 'task');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(defaults?.date || todayStr());
  const [startTime, setStartTime] = useState(defaults?.startTime || '09:00');
  const [endTime, setEndTime] = useState(defaults?.endTime || '10:00');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setType(defaults?.type || 'task');
      setTitle('');
      setDate(defaults?.date || todayStr());
      setStartTime(defaults?.startTime || '09:00');
      setEndTime(defaults?.endTime || '10:00');
      setLocation('');
      setDescription('');
      setProjectName('');
    }
  }, [open, defaults]);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 300));
      addEvent({
        type,
        title: title.trim(),
        description: description.trim() || undefined,
        date,
        startTime,
        endTime,
        location: location.trim() || undefined,
        projectName: projectName.trim() || undefined,
      });
      toast.success('Event created', `"${title.trim()}" has been added to your calendar.`);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const showLocation = type === 'meeting' || type === 'event';
  const showProject = type === 'task' || type === 'meeting';
  const showEndTime = type !== 'reminder';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`New ${type.charAt(0).toUpperCase() + type.slice(1)}`}
      description={`Add a new ${type} to your calendar.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={loading} disabled={!title.trim()}>
            Create
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Type selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-surface-300">Type</label>
          <div className="flex gap-1.5">
            {TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setType(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  type === opt.value
                    ? 'bg-brand-500/15 text-brand-400 border border-brand-500/30'
                    : 'bg-surface-850 text-surface-400 border border-surface-800 hover:text-surface-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <label htmlFor="cal-title" className="text-xs font-semibold text-surface-300">Title</label>
          <input
            id="cal-title"
            type="text"
            placeholder={`New ${type}...`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input text-sm"
            autoFocus
          />
        </div>

        {/* Date */}
        <div className="space-y-1.5">
          <label htmlFor="cal-date" className="text-xs font-semibold text-surface-300">Date</label>
          <input
            id="cal-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input text-sm"
          />
        </div>

        {/* Times */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="cal-start" className="text-xs font-semibold text-surface-300">Start time</label>
            <input
              id="cal-start"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="input text-sm"
            />
          </div>
          {showEndTime && (
            <div className="space-y-1.5">
              <label htmlFor="cal-end" className="text-xs font-semibold text-surface-300">End time</label>
              <input
                id="cal-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="input text-sm"
              />
            </div>
          )}
        </div>

        {/* Location */}
        {showLocation && (
          <div className="space-y-1.5">
            <label htmlFor="cal-location" className="text-xs font-semibold text-surface-300">Location</label>
            <input
              id="cal-location"
              type="text"
              placeholder="Meeting link or location..."
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="input text-sm"
            />
          </div>
        )}

        {/* Project */}
        {showProject && (
          <div className="space-y-1.5">
            <label htmlFor="cal-project" className="text-xs font-semibold text-surface-300">Project</label>
            <input
              id="cal-project"
              type="text"
              placeholder="Project name..."
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="input text-sm"
              list="cal-project-list"
            />
            <datalist id="cal-project-list">
              {projects.map((p) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
          </div>
        )}

        {/* Description */}
        {type !== 'reminder' && (
          <div className="space-y-1.5">
            <label htmlFor="cal-desc" className="text-xs font-semibold text-surface-300">Description</label>
            <textarea
              id="cal-desc"
              placeholder="Add notes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input text-sm min-h-[80px] resize-y"
            />
          </div>
        )}
      </div>
    </Dialog>
  );
}
