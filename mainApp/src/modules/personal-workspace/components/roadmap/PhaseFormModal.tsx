import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { useRoadmapStore } from '@personal/services/useRoadmapStore';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Textarea } from '@shared/components/ui/Textarea';
import { Select } from '@shared/components/ui/Select';
import type { RoadmapPhaseDoc, RoadmapPhaseStatus } from '@personal/types/roadmap';
import { nextPhaseStatuses } from '@personal/services/roadmapLifecycle';

const PHASE_STATUS_LABELS: Record<RoadmapPhaseStatus, string> = {
  upcoming: 'Upcoming',
  active: 'Active',
  completed: 'Completed',
  paused: 'Paused',
};

interface PhaseFormModalProps {
  roadmapId: string;
  /** Present → edit mode; absent → create mode. */
  phase?: RoadmapPhaseDoc | null;
  onClose: () => void;
}

const toDateInput = (value?: string | null) => (value ? String(value).slice(0, 10) : '');

export function PhaseFormModal({ roadmapId, phase, onClose }: PhaseFormModalProps) {
  const { createPhase, updatePhase } = useRoadmapStore();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: phase?.title ?? '',
    description: phase?.description ?? '',
    status: (phase?.status ?? 'upcoming') as RoadmapPhaseStatus,
    startDate: toDateInput(phase?.startDate),
    targetDate: toDateInput(phase?.targetDate),
  });

  const dateInvalid =
    !!form.startDate &&
    !!form.targetDate &&
    new Date(form.targetDate) <= new Date(form.startDate);

  const canSave = form.title.trim().length > 0 && !dateInvalid;

  const handleSubmit = async () => {
    if (!canSave) return;
    setSubmitting(true);
    try {
      if (phase) {
        await updatePhase(phase._id, {
          title: form.title.trim(),
          description: form.description,
          status: form.status,
          // Empty input clears the field; the PATCH schema accepts null.
          startDate: form.startDate || null,
          targetDate: form.targetDate || null,
        });
      } else {
        await createPhase(roadmapId, {
          title: form.title.trim(),
          description: form.description,
          status: form.status,
          // Create treats empty dates as "not set" rather than clearing.
          ...(form.startDate ? { startDate: form.startDate } : {}),
          ...(form.targetDate ? { targetDate: form.targetDate } : {}),
        });
      }
      onClose();
    } catch {
      // Failure toast is surfaced by the store; keep the dialog open.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        className="bg-surface-900 border border-surface-800 rounded-[22px] p-5 sm:p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto scrollbar-thin"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={phase ? 'Edit Phase' : 'Add Phase'}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg sm:text-xl font-display font-extrabold text-surface-50">
            {phase ? 'Edit Phase' : 'Add Phase'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-surface-400 hover:text-surface-50 hover:bg-surface-800 transition-all"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="ph-title" className="block text-sm font-semibold text-surface-200 mb-1.5">Title *</label>
            <Input
              id="ph-title"
              className="h-12 rounded-[14px]"
              placeholder="e.g. Foundations"
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="ph-desc" className="block text-sm font-semibold text-surface-200 mb-1.5">Description</label>
            <Textarea
              id="ph-desc"
              className="resize-none h-20 rounded-[14px] py-3"
              placeholder="What does this phase cover?"
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="ph-status" className="block text-sm font-semibold text-surface-200 mb-1.5">Status</label>
            <Select
              id="ph-status"
              className="h-12 rounded-[14px]"
              value={form.status}
              onChange={e => setForm(p => ({ ...p, status: e.target.value as RoadmapPhaseStatus }))}
            >
              {(phase
                ? nextPhaseStatuses(phase.status)
                : (Object.keys(PHASE_STATUS_LABELS) as RoadmapPhaseStatus[])
              ).map(val => (
                <option key={val} value={val}>{PHASE_STATUS_LABELS[val]}</option>
              ))}
            </Select>
          </div>
          {phase && form.status === 'completed' && phase.status !== 'completed' && (
            <p className="text-xs text-yellow-400">
              Completing this phase will also complete its remaining milestones.
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="ph-start" className="block text-sm font-semibold text-surface-200 mb-1.5">Start Date</label>
              <Input
                id="ph-start"
                type="date"
                className="h-12 rounded-[14px]"
                value={form.startDate}
                onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="ph-target" className="block text-sm font-semibold text-surface-200 mb-1.5">Target Date</label>
              <Input
                id="ph-target"
                type="date"
                className="h-12 rounded-[14px]"
                value={form.targetDate}
                onChange={e => setForm(p => ({ ...p, targetDate: e.target.value }))}
              />
            </div>
          </div>
          {dateInvalid && (
            <p className="text-xs text-red-400 mt-4">Target date must be after start date</p>
          )}

        <div className="flex gap-3 pt-6">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            loading={submitting}
            disabled={!canSave}
            className="flex-1"
            leftIcon={<Check size={16} />}
          >
            {phase ? 'Save Changes' : 'Add Phase'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
