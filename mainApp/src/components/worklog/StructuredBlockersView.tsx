import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertOctagon, Plus, Trash2, CheckCircle, ShieldAlert } from 'lucide-react';
import { WorkLog, StructuredBlocker, useWorkLogStore } from '../../store/useWorkLogStore';

interface StructuredBlockersViewProps {
  workLog: WorkLog;
}

const SEVERITY_BADGES: Record<StructuredBlocker['severity'], { bg: string; color: string; border: string }> = {
  low:      { bg: 'bg-blue-500/10', color: 'text-blue-400', border: 'border-blue-500/30' },
  medium:   { bg: 'bg-amber-500/10', color: 'text-amber-400', border: 'border-amber-500/30' },
  high:     { bg: 'bg-orange-500/10', color: 'text-orange-400', border: 'border-orange-500/30' },
  critical: { bg: 'bg-red-500/10', color: 'text-red-400', border: 'border-red-500/30' },
};

const STATUS_BADGES: Record<StructuredBlocker['status'], { label: string; bg: string; color: string }> = {
  open:          { label: 'Open', bg: 'bg-red-500/10', color: 'text-red-400' },
  investigating: { label: 'Investigating', bg: 'bg-amber-500/10', color: 'text-amber-400' },
  blocked:       { label: 'Blocked', bg: 'bg-purple-500/10', color: 'text-purple-400' },
  resolved:      { label: 'Resolved', bg: 'bg-emerald-500/10', color: 'text-emerald-400' },
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
        <button
          onClick={() => setShowAdd(true)}
          className="btn-primary text-xs flex items-center gap-1.5 px-3 py-1.5"
        >
          <Plus size={14} /> Add Blocker
        </button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.form
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            onSubmit={handleAdd}
            className="card p-4 rounded-xl border border-red-500/30 bg-surface-850 space-y-3"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                className="input text-sm rounded-lg col-span-2"
                placeholder="Blocker title (e.g., Blocked on Google Drive OAuth scope approval)"
                value={title} onChange={e => setTitle(e.target.value)} required
              />
              <select
                className="input text-sm rounded-lg"
                value={severity} onChange={e => setSeverity(e.target.value as any)}
              >
                <option value="low">Low Severity</option>
                <option value="medium">Medium Severity</option>
                <option value="high">High Severity</option>
                <option value="critical">Critical Severity</option>
              </select>
            </div>
            <textarea
              className="input text-sm rounded-lg w-full resize-none" rows={2}
              placeholder="Blocker details, error logs, or dependencies..."
              value={notes} onChange={e => setNotes(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAdd(false)} className="btn-secondary text-xs px-3 py-1.5">Cancel</button>
              <button type="submit" className="btn-primary text-xs px-4 py-1.5">Record Blocker</button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {blockers.length === 0 ? (
        <div className="card p-8 text-center border border-dashed border-surface-800 rounded-2xl">
          <ShieldAlert size={32} className="mx-auto text-emerald-500/60 mb-2" />
          <p className="text-sm font-medium text-surface-300">No active blockers</p>
          <p className="text-xs text-surface-500 mt-1">Great progress! No impediments recorded for this work item.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {blockers.map(b => {
            const sevBadge = SEVERITY_BADGES[b.severity] || SEVERITY_BADGES.medium;
            const statBadge = STATUS_BADGES[b.status] || STATUS_BADGES.open;

            return (
              <div key={b._id} className="card p-4 rounded-xl border border-surface-800 bg-surface-900/60 flex items-start justify-between gap-4 group">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`badge ${sevBadge.bg} ${sevBadge.color} border ${sevBadge.border} text-[10px] uppercase font-bold`}>
                      {b.severity}
                    </span>
                    <span className={`badge ${statBadge.bg} ${statBadge.color} text-[10px]`}>
                      {statBadge.label}
                    </span>
                    <h4 className={`text-sm font-semibold truncate ${b.status === 'resolved' ? 'line-through text-surface-400' : 'text-surface-50'}`}>
                      {b.title}
                    </h4>
                  </div>
                  {b.notes && (
                    <p className="text-xs text-surface-300 leading-relaxed">{b.notes}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <select
                    className="input text-xs py-1 px-2 rounded-lg"
                    value={b.status}
                    onChange={e => updateBlocker(workLog._id, b._id, { status: e.target.value as any })}
                  >
                    <option value="open">Open</option>
                    <option value="investigating">Investigating</option>
                    <option value="blocked">Blocked</option>
                    <option value="resolved">Resolved</option>
                  </select>
                  <button
                    onClick={() => deleteBlocker(workLog._id, b._id)}
                    className="p-1 rounded text-surface-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Delete blocker"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
