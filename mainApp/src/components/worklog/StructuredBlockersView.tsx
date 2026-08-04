import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertOctagon, Plus, Trash2, ShieldAlert } from 'lucide-react';
import { WorkLog, StructuredBlocker, useWorkLogStore } from '../../store/useWorkLogStore';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { Badge, type BadgeTone } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';

interface StructuredBlockersViewProps {
  workLog: WorkLog;
}

const SEVERITY_TONES: Record<StructuredBlocker['severity'], BadgeTone> = {
  low: 'info',
  medium: 'warning',
  high: 'warning',
  critical: 'danger',
};

const STATUS_TONES: Record<StructuredBlocker['status'], BadgeTone> = {
  open: 'danger',
  investigating: 'warning',
  blocked: 'brand',
  resolved: 'success',
};

const STATUS_LABELS: Record<StructuredBlocker['status'], string> = {
  open: 'Open',
  investigating: 'Investigating',
  blocked: 'Blocked',
  resolved: 'Resolved',
};

export function StructuredBlockersView({ workLog }: StructuredBlockersViewProps) {
  const { addBlocker, updateBlocker, deleteBlocker } = useWorkLogStore();
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<StructuredBlocker['severity']>('medium');
  const [notes, setNotes] = useState('');

  const blockers = workLog.blockerList || [];

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await addBlocker(workLog._id, {
      title,
      severity,
      status: 'open',
      notes,
    });
    setTitle('');
    setNotes('');
    setShowAdd(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-surface-50 flex items-center gap-2">
            <AlertOctagon size={18} className="text-red-400" />
            Blockers & Impediments Tracker
          </h3>
          <p className="text-xs text-surface-400">
            Track technical blockers, dependencies, severity levels, and resolution status.
          </p>
        </div>
        <Button
          size="xs"
          onClick={() => setShowAdd(true)}
          className="px-3 py-1.5"
          leftIcon={<Plus size={14} />}
        >
          Add Blocker
        </Button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.form
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            onSubmit={handleAdd}
            className="card p-4 rounded-xl border border-red-500/30 bg-surface-850 space-y-3"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Input
                className="text-sm rounded-lg col-span-2"
                placeholder="Blocker title (e.g., Blocked on Google Drive OAuth scope approval)"
                value={title} onChange={e => setTitle(e.target.value)} required
              />
              <Select
                className="text-sm rounded-lg"
                value={severity} onChange={e => setSeverity(e.target.value as StructuredBlocker['severity'])}
              >
                <option value="low">Low Severity</option>
                <option value="medium">Medium Severity</option>
                <option value="high">High Severity</option>
                <option value="critical">Critical Severity</option>
              </Select>
            </div>
            <Textarea
              className="text-sm rounded-lg w-full resize-none" rows={2}
              placeholder="Blocker details, error logs, or dependencies..."
              value={notes} onChange={e => setNotes(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" size="xs" onClick={() => setShowAdd(false)} className="px-3 py-1.5">Cancel</Button>
              <Button type="submit" size="xs" className="px-4 py-1.5">Record Blocker</Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {blockers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-surface-800 bg-surface-900 overflow-hidden">
          <EmptyState
            icon={<ShieldAlert size={32} className="text-emerald-500/60" />}
            title="No active blockers"
            description="Great progress! No impediments recorded for this work item."
          />
        </div>
      ) : (
        <div className="space-y-3">
          {blockers.map(b => {
            const sevTone = SEVERITY_TONES[b.severity];
            const statTone = STATUS_TONES[b.status];

            return (
              <Card key={b._id} className="p-4 rounded-xl border border-surface-800 bg-surface-900/60 flex items-start justify-between gap-4 group">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge tone={sevTone} className="text-[10px] uppercase font-bold">
                      {b.severity}
                    </Badge>
                    <Badge tone={statTone} className="text-[10px]">
                      {STATUS_LABELS[b.status]}
                    </Badge>
                    <h4 className={`text-sm font-semibold truncate ${b.status === 'resolved' ? 'line-through text-surface-400' : 'text-surface-50'}`}>
                      {b.title}
                    </h4>
                  </div>
                  {b.notes && (
                    <p className="text-xs text-surface-300 leading-relaxed">{b.notes}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <Select
                    className="text-xs py-1 px-2 rounded-lg"
                    value={b.status}
                    onChange={e => updateBlocker(workLog._id, b._id, { status: e.target.value as StructuredBlocker['status'] })}
                  >
                    <option value="open">Open</option>
                    <option value="investigating">Investigating</option>
                    <option value="blocked">Blocked</option>
                    <option value="resolved">Resolved</option>
                  </Select>
                  <button
                    onClick={() => deleteBlocker(workLog._id, b._id)}
                    className="p-1 rounded text-surface-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete blocker"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
