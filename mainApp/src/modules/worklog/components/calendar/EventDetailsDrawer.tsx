import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Clock, MapPin, Users, FolderOpen, Trash2, ExternalLink,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCalendarStore } from '@worklog/services/useCalendarStore';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { Badge, type BadgeTone } from '@shared/components/ui/Badge';
import type { CalendarEventType } from '@worklog/types/calendar';

const TYPE_CONFIG: Record<CalendarEventType, { label: string; tone: BadgeTone }> = {
  task: { label: 'Task', tone: 'brand' },
  meeting: { label: 'Meeting', tone: 'info' },
  event: { label: 'Event', tone: 'warning' },
  reminder: { label: 'Reminder', tone: 'success' },
};

function formatTime12(timeStr: string): string {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
}

function formatDateLabel(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function EventDetailsDrawer() {
  const navigate = useNavigate();
  const { selectedEvent, isDetailsOpen, closeDetails, deleteEvent } = useCalendarStore();
  const { members, projects } = useCollaborationStore();

  if (!selectedEvent) return null;

  const typeConfig = TYPE_CONFIG[selectedEvent.type];

  const assignedMembers = (selectedEvent.assigneeIds || [])
    .map((id) => members.find((m) => m.id === id))
    .filter(Boolean);

  const project = selectedEvent.projectId
    ? projects.find((p) => p.id === selectedEvent.projectId)
    : null;

  const handleDelete = () => {
    if (selectedEvent.type !== 'task') {
      deleteEvent(selectedEvent.id);
    }
    closeDetails();
  };

  const handleOpenTask = () => {
    if (selectedEvent.taskId) {
      navigate(`/worklog/tasks/${selectedEvent.taskId}`);
      closeDetails();
    }
  };

  return (
    <AnimatePresence>
      {isDetailsOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeDetails}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-md bg-surface-900 border-l border-surface-800 shadow-xl overflow-y-auto"
          >
            {/* Close button */}
            <button
              onClick={closeDetails}
              aria-label="Close details"
              className="absolute top-4 right-4 z-10 rounded-lg p-1.5 text-surface-400 transition-colors hover:bg-surface-800 hover:text-surface-50"
            >
              <X size={16} />
            </button>

            {/* Header */}
            <div className="p-6 pb-0 space-y-3">
              <Badge tone={typeConfig.tone} className="text-[10px] font-extrabold uppercase tracking-wider">
                {typeConfig.label}
              </Badge>
              <h2 className="text-lg font-display font-extrabold text-surface-50 pr-8">
                {selectedEvent.title}
              </h2>
            </div>

            {/* Details */}
            <div className="p-6 space-y-4">
              {/* Time */}
              <div className="flex items-center gap-3 text-sm text-surface-300">
                <Clock size={14} className="text-surface-500 shrink-0" />
                <div>
                  <p className="font-semibold">{formatTime12(selectedEvent.startTime)} – {formatTime12(selectedEvent.endTime)}</p>
                  <p className="text-xs text-surface-400 mt-0.5">{formatDateLabel(selectedEvent.date)}</p>
                </div>
              </div>

              {/* Location */}
              {selectedEvent.location && (
                <div className="flex items-center gap-3 text-sm text-surface-300">
                  <MapPin size={14} className="text-surface-500 shrink-0" />
                  <span>{selectedEvent.location}</span>
                </div>
              )}

              {/* Project */}
              {project && (
                <div className="flex items-center gap-3 text-sm text-surface-300">
                  <FolderOpen size={14} className="text-surface-500 shrink-0" />
                  <span className="font-semibold">{project.name}</span>
                </div>
              )}

              {/* Participants */}
              {assignedMembers.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-surface-400">
                    <Users size={13} />
                    Participants
                  </div>
                  <div className="space-y-1.5">
                    {assignedMembers.map((m) => m && (
                      <div key={m.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-surface-850 border border-surface-800">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-500/15 to-cyan-500/10 flex items-center justify-center text-[9px] font-bold text-brand-600 dark:text-brand-300">
                          {m.name.charAt(0)}
                        </div>
                        <span className="text-xs font-semibold text-surface-200">{m.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              {selectedEvent.description && (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-surface-400">Description</span>
                  <p className="text-sm text-surface-300 leading-relaxed">{selectedEvent.description}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 flex items-center gap-2">
              {selectedEvent.taskId && (
                <button
                  type="button"
                  onClick={handleOpenTask}
                  className="flex-1 flex items-center justify-center gap-2 h-9 rounded-xl bg-brand-500/10 text-brand-400 text-xs font-semibold hover:bg-brand-500/20 transition-colors"
                >
                  <ExternalLink size={13} />
                  Open Task
                </button>
              )}
              {selectedEvent.type !== 'task' && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex items-center justify-center gap-2 h-9 px-4 rounded-xl bg-danger-500/10 text-danger-400 text-xs font-semibold hover:bg-danger-500/20 transition-colors"
                >
                  <Trash2 size={13} />
                  Delete
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
