import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Play, Pause, Square, Plus, Sparkles, CheckCircle2, AlertTriangle, Lightbulb, FileText } from 'lucide-react';
import { WorkLog, TimelineEntry, useWorkLogStore } from '../../store/useWorkLogStore';
import { format } from 'date-fns';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';

interface TimelineViewProps {
  workLog: WorkLog;
}

const TYPE_CONFIG: Record<TimelineEntry['type'], { icon: any; bg: string; color: string; border: string }> = {
  timer_start:     { icon: Play,           bg: 'bg-sky-500/10',     color: 'text-sky-400',     border: 'border-sky-500/30' },
  timer_pause:     { icon: Pause,          bg: 'bg-amber-500/10',   color: 'text-amber-400',   border: 'border-amber-500/30' },
  timer_resume:    { icon: Play,           bg: 'bg-emerald-500/10', color: 'text-emerald-400', border: 'border-emerald-500/30' },
  timer_stop:      { icon: Square,        bg: 'bg-purple-500/10',  color: 'text-purple-400',  border: 'border-purple-500/30' },
  note:            { icon: FileText,      bg: 'bg-blue-500/10',    color: 'text-blue-400',    border: 'border-blue-500/30' },
  snapshot:        { icon: Sparkles,      bg: 'bg-indigo-500/10',  color: 'text-indigo-400',  border: 'border-indigo-500/30' },
  completed_item:  { icon: CheckCircle2,  bg: 'bg-emerald-500/10', color: 'text-emerald-400', border: 'border-emerald-500/30' },
  decision:        { icon: Lightbulb,     bg: 'bg-amber-500/10',   color: 'text-amber-400',   border: 'border-amber-500/30' },
  blocker:         { icon: AlertTriangle, bg: 'bg-red-500/10',     color: 'text-red-400',     border: 'border-red-500/30' },
};

export function TimelineView({ workLog }: TimelineViewProps) {
  const { addTimelineEntry } = useWorkLogStore();
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Work Note');

  const entries = workLog.timelineEntries || [];

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await addTimelineEntry(workLog._id, {
      title,
      description,
      category,
      type: 'note',
      timestamp: Date.now(),
    });
    setTitle('');
    setDescription('');
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-surface-50 flex items-center gap-2">
            <Clock size={18} className="text-brand-400" />
            Daily Engineering Timeline
          </h3>
          <p className="text-xs text-surface-400">
            Chronological history of work sessions, milestones, and daily events.
          </p>
        </div>
        <Button
          size="xs"
          onClick={() => setShowAddModal(true)}
          className="px-3 py-1.5"
          leftIcon={<Plus size={14} />}
        >
          Add Event
        </Button>
      </div>

      {/* Modal / Form */}
      <AnimatePresence>
        {showAddModal && (
          <motion.form
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            onSubmit={handleAdd}
            className="card p-4 rounded-xl border border-brand-500/30 bg-surface-850 space-y-3"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input
                className="text-sm rounded-lg col-span-2"
                placeholder="Timeline event title (e.g., Investigated API latency issue)"
                value={title} onChange={e => setTitle(e.target.value)} required
              />
              <Input
                className="text-sm rounded-lg"
                placeholder="Category (e.g., Debugging, Feature)"
                value={category} onChange={e => setCategory(e.target.value)}
              />
            </div>
            <Textarea
              className="text-sm rounded-lg w-full resize-none"
              placeholder="Additional details or observations..."
              rows={2} value={description} onChange={e => setDescription(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" size="xs" onClick={() => setShowAddModal(false)} className="px-3 py-1.5">Cancel</Button>
              <Button type="submit" size="xs" className="px-4 py-1.5">Save Entry</Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Timeline List */}
      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-surface-800 bg-surface-900 overflow-hidden">
          <EmptyState
            icon={<Clock size={32} className="text-surface-600" />}
            title="No timeline entries yet"
            description="Start a timer session or add manual entries to build your day's story."
          />
        </div>
      ) : (
        <div className="relative pl-6 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-800">
          {entries.map((entry) => {
            const config = TYPE_CONFIG[entry.type] || TYPE_CONFIG.note;
            const Icon = config.icon;
            const timeStr = format(new Date(entry.timestamp), 'h:mm a');

            return (
              <motion.div
                key={entry._id}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                className="relative group"
              >
                {/* Dot */}
                <div className={`absolute -left-6 top-1 w-6 h-6 rounded-full ${config.bg} ${config.color} border ${config.border} flex items-center justify-center flex-shrink-0 z-10 shadow-sm`}>
                  <Icon size={12} />
                </div>

                <Card className="p-4 rounded-xl border border-surface-800 hover:border-surface-700 transition-all bg-surface-900/60">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-brand-400 font-semibold">{timeStr}</span>
                      <span className="text-xs font-semibold text-surface-50">{entry.title}</span>
                    </div>
                    {entry.category && (
                      <Badge tone="neutral" className="text-[10px]">
                        {entry.category}
                      </Badge>
                    )}
                  </div>
                  {entry.description && (
                    <p className="text-xs text-surface-300 mt-1 whitespace-pre-wrap leading-relaxed">
                      {entry.description}
                    </p>
                  )}
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
