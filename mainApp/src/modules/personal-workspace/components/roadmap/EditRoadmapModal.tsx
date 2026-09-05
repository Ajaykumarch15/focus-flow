import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Check } from 'lucide-react';
import { useRoadmapStore } from '@personal/services/useRoadmapStore';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Textarea } from '@shared/components/ui/Textarea';
import { Select } from '@shared/components/ui/Select';
import {
  ROADMAP_TYPE_LABELS,
  ROADMAP_STATUS_LABELS,
  type RoadmapType,
  type RoadmapStatus,
} from '@personal/types/roadmap';
import { nextRoadmapStatuses } from '@personal/services/roadmapLifecycle';

interface EditRoadmapModalProps {
  roadmap: {
    _id: string;
    title: string;
    description: string;
    type: RoadmapType;
    status: RoadmapStatus;
    startDate?: string | null;
    targetDate?: string | null;
  };
  onClose: () => void;
}

const toDateInput = (value?: string | null) => (value ? String(value).slice(0, 10) : '');

export function EditRoadmapModal({ roadmap, onClose }: EditRoadmapModalProps) {
  const { updateRoadmap } = useRoadmapStore();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: roadmap.title,
    description: roadmap.description || '',
    type: roadmap.type,
    status: roadmap.status,
    startDate: toDateInput(roadmap.startDate),
    targetDate: toDateInput(roadmap.targetDate),
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
      await updateRoadmap(roadmap._id, {
        title: form.title.trim(),
        description: form.description,
        type: form.type,
        status: form.status,
        // Empty date input means "clear the field" — the API accepts null.
        startDate: form.startDate || null,
        targetDate: form.targetDate || null,
      });
      onClose();
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
        aria-label="Edit Roadmap"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg sm:text-xl font-display font-extrabold text-surface-50">Edit Roadmap</h2>
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
            <label htmlFor="rm-edit-title" className="block text-sm font-semibold text-surface-200 mb-1.5">Title *</label>
            <Input
              id="rm-edit-title"
              className="h-12 rounded-[14px]"
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="rm-edit-desc" className="block text-sm font-semibold text-surface-200 mb-1.5">Description</label>
            <Textarea
              id="rm-edit-desc"
              className="resize-none h-20 rounded-[14px] py-3"
              placeholder="What does this roadmap help you achieve?"
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="rm-edit-type" className="block text-sm font-semibold text-surface-200 mb-1.5">Type</label>
              <Select
                id="rm-edit-type"
                className="h-12 rounded-[14px]"
                value={form.type}
                onChange={e => setForm(p => ({ ...p, type: e.target.value as RoadmapType }))}
              >
                {(Object.entries(ROADMAP_TYPE_LABELS) as [RoadmapType, string][]).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </Select>
            </div>
            <div>
              <label htmlFor="rm-edit-status" className="block text-sm font-semibold text-surface-200 mb-1.5">Status</label>
              <Select
                id="rm-edit-status"
                className="h-12 rounded-[14px]"
                value={form.status}
                onChange={e => setForm(p => ({ ...p, status: e.target.value as RoadmapStatus }))}
              >
                {(nextRoadmapStatuses(roadmap.status) as RoadmapStatus[]).map(val => (
                  <option key={val} value={val}>{ROADMAP_STATUS_LABELS[val]}</option>
                ))}
              </Select>
            </div>
          </div>
          {form.status === 'completed' && roadmap.status !== 'completed' && (
            <p className="text-xs text-yellow-400">
              Completing this roadmap will also complete its remaining phases and milestones. Tasks are not modified.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="rm-edit-start" className="block text-sm font-semibold text-surface-200 mb-1.5">Start Date</label>
              <Input
                id="rm-edit-start"
                type="date"
                className="h-12 rounded-[14px]"
                value={form.startDate}
                onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="rm-edit-target" className="block text-sm font-semibold text-surface-200 mb-1.5">Target Date</label>
              <Input
                id="rm-edit-target"
                type="date"
                className="h-12 rounded-[14px]"
                value={form.targetDate}
                onChange={e => setForm(p => ({ ...p, targetDate: e.target.value }))}
              />
            </div>
          </div>
          {dateInvalid && (
            <p className="text-xs text-red-400">Target date must be after start date</p>
          )}
        </div>

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
            Save Changes
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
