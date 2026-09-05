import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  X, ArrowRight, ArrowLeft, Check, Map,
  GraduationCap, Rocket, Target, Trophy, BookOpen, Code,
  Briefcase, Lightbulb, Brain, Palette, Globe, Heart, Star, Zap, Award,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRoadmapStore } from '@personal/services/useRoadmapStore';
import { Button } from '@shared/components/ui/Button';
import { Input } from '@shared/components/ui/Input';
import { Textarea } from '@shared/components/ui/Textarea';
import { Select } from '@shared/components/ui/Select';
import {
  ROADMAP_TYPE_LABELS,
  ROADMAP_ICONS,
  ROADMAP_COLORS,
  type RoadmapType,
} from '@personal/types/roadmap';
import { toast } from '@shared/services/useToastStore';

const ICON_MAP: Record<string, any> = {
  Map, GraduationCap, Rocket, Target, Trophy, BookOpen,
  Code, Briefcase, Lightbulb, Brain, Palette, Globe,
  Heart, Star, Zap, Award,
};

interface CreateRoadmapModalProps {
  onClose: () => void;
}

export function CreateRoadmapModal({ onClose }: CreateRoadmapModalProps) {
  const navigate = useNavigate();
  const { createRoadmap } = useRoadmapStore();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'learning' as RoadmapType,
    startDate: '',
    targetDate: '',
    icon: 'Map',
    color: '#0ea5e9',
  });

  const canNext = step === 0
    ? form.title.trim().length > 0
    : true;

  const dateInvalid = step === 1 && form.startDate && form.targetDate && new Date(form.targetDate) <= new Date(form.startDate);

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    setSubmitting(true);
    try {
      const roadmap = await createRoadmap({
        title: form.title,
        description: form.description,
        type: form.type,
        startDate: form.startDate || undefined,
        targetDate: form.targetDate || undefined,
        icon: form.icon,
        color: form.color,
      });
      onClose();
      navigate(`/personal/roadmaps/${roadmap._id}`);
    } catch (err: any) {
      toast.error('Failed to create roadmap', err?.message);
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
        aria-label="Create Roadmap"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg sm:text-xl font-display font-extrabold text-surface-50">Create Roadmap</h2>
            <p className="text-xs text-surface-400 mt-0.5">
              Step {step + 1} of 3 — {['Define your goal', 'Set timeline', 'Customize appearance'][step]}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-surface-400 hover:text-surface-50 hover:bg-surface-800 transition-all"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Step progress */}
        <div className="flex gap-2 mb-6" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={3}>
          {[0, 1, 2].map(s => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                s <= step ? 'bg-brand-500' : 'bg-surface-800'
              }`}
            />
          ))}
        </div>

        {/* Step 0: Define */}
        {step === 0 && (
          <div className="space-y-4">
            <div>
              <label htmlFor="rm-title" className="block text-sm font-semibold text-surface-200 mb-1.5">Title *</label>
              <Input
                id="rm-title"
                className="h-12 rounded-[14px]"
                placeholder="e.g. Machine Learning Engineer"
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="rm-desc" className="block text-sm font-semibold text-surface-200 mb-1.5">Description</label>
              <Textarea
                id="rm-desc"
                className="resize-none h-20 rounded-[14px] py-3"
                placeholder="What does this roadmap help you achieve?"
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="rm-type" className="block text-sm font-semibold text-surface-200 mb-1.5">Type</label>
              <Select
                id="rm-type"
                className="h-12 rounded-[14px]"
                value={form.type}
                onChange={e => setForm(p => ({ ...p, type: e.target.value as RoadmapType }))}
              >
                {(Object.entries(ROADMAP_TYPE_LABELS) as [RoadmapType, string][]).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </Select>
            </div>
          </div>
        )}

        {/* Step 1: Timeline */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label htmlFor="rm-start" className="block text-sm font-semibold text-surface-200 mb-1.5">Start Date</label>
              <Input
                id="rm-start"
                type="date"
                className="h-12 rounded-[14px]"
                value={form.startDate}
                onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="rm-target" className="block text-sm font-semibold text-surface-200 mb-1.5">Target Date</label>
              <Input
                id="rm-target"
                type="date"
                className="h-12 rounded-[14px]"
                value={form.targetDate}
                onChange={e => setForm(p => ({ ...p, targetDate: e.target.value }))}
              />
              {dateInvalid && (
                <p className="text-xs text-red-400 mt-1">Target date must be after start date</p>
              )}
            </div>
            <p className="text-xs text-surface-500">
              Dates are optional. You can always update them later.
            </p>
          </div>
        )}

        {/* Step 2: Appearance */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-surface-200 mb-2">Icon</label>
              <div className="grid grid-cols-8 gap-2">
                {ROADMAP_ICONS.map(iconName => {
                  const IconComp = ICON_MAP[iconName] || Map;
                  return (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, icon: iconName }))}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all ${
                        form.icon === iconName
                          ? 'bg-brand-500/20 text-brand-400 ring-2 ring-brand-500'
                          : 'bg-surface-800 text-surface-400 hover:bg-surface-700 hover:text-surface-200'
                      }`}
                      aria-label={`Select ${iconName} icon`}
                      aria-pressed={form.icon === iconName}
                    >
                      <IconComp size={16} />
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-surface-200 mb-2">Color</label>
              <div className="flex gap-2 flex-wrap">
                {ROADMAP_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, color }))}
                    className={`w-7 h-7 rounded-full transition-all ${
                      form.color === color
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-surface-900 scale-110 shadow-md'
                        : ''
                    }`}
                    style={{ backgroundColor: color }}
                    aria-label={`Select color ${color}`}
                    aria-pressed={form.color === color}
                  />
                ))}
              </div>
            </div>
            {/* Preview */}
            <div className="bg-surface-800/50 rounded-xl p-4 border border-surface-700/50">
              <p className="text-xs text-surface-400 mb-2 font-medium">Preview</p>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${form.color}15`, color: form.color }}
                >
                  {(() => { const I = ICON_MAP[form.icon] || Map; return <I size={20} />; })()}
                </div>
                <div>
                  <p className="text-sm font-bold text-surface-50">
                    {form.title || 'Roadmap Title'}
                  </p>
                  <p className="text-xs text-surface-400">
                    {ROADMAP_TYPE_LABELS[form.type]}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3 pt-6">
          {step > 0 && (
            <Button variant="secondary" onClick={() => setStep(s => s - 1)} leftIcon={<ArrowLeft size={16} />}>
              Back
            </Button>
          )}
          {step < 2 ? (
            <Button
              onClick={() => setStep(s => s + 1)}
              disabled={!canNext || !!dateInvalid}
              className="flex-1"
              rightIcon={<ArrowRight size={16} />}
            >
              Continue
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              loading={submitting}
              disabled={!form.title.trim()}
              className="flex-1"
              leftIcon={<Check size={16} />}
            >
              Create Roadmap
            </Button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
