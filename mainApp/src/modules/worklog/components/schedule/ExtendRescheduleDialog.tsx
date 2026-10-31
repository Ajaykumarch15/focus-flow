import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, AlertTriangle, Undo2, Layers, MoveRight, Shrink, Minimize2, Lock, Info } from 'lucide-react';
import { useScheduleStore } from '@worklog/services/useScheduleStore';
import { useStore } from '@worklog/services/useStore';
import { usePersonalTaskStore } from '@personal/services/usePersonalTaskStore';
import { useWorkHours } from '@shared/hooks/useWorkHours';
import { timeToMinutes, formatMinutes } from '@worklog/services/scheduleAnalytics';
import { RescheduleStrategy, RescheduleProposal } from '@shared/types';
import { buildProposal, makeInput } from '@worklog/services/rescheduleEngine';
import { Button } from '@shared/components/ui/Button';

const STRATEGIES: { id: RescheduleStrategy; name: string; icon: ReactNode; desc: string }[] = [
  { id: 'shift-all', name: 'Shift all affected tasks', icon: <Layers size={14} />, desc: 'Move every later task forward by the extension, preserving order and durations.' },
  { id: 'relocate', name: 'Move conflicts to free slots', icon: <MoveRight size={14} />, desc: 'Extend this task, then relocate only the overlapping tasks into the nearest suitable slots.' },
  { id: 'shrink', name: 'Shrink flexible tasks', icon: <Shrink size={14} />, desc: 'Absorb the extension by shortening lower-priority flexible tasks (never below their minimum duration).' },
  { id: 'keep-as-is', name: 'Keep schedule unchanged', icon: <Minimize2 size={14} />, desc: 'Extend only this slot; accept overlaps with the rest of the plan.' },
];

function newEndPreview(endTime: string, extra: number): string {
  const mins = Math.min(1439, timeToMinutes(endTime) + extra);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function ExtendRescheduleDialog() {
  const {
    extendDialogScheduleId,
    closeExtendDialog,
    schedules,
    applyReschedule,
    rescheduleHistory,
    undoLastReschedule,
  } = useScheduleStore();
  const { tasks: workTasks } = useStore();
  const { tasks: personalTasks } = usePersonalTaskStore();
  const { startMinutes, endMinutes } = useWorkHours();

  const schedule = useMemo(
    () => schedules.find(s => s._id === extendDialogScheduleId),
    [schedules, extendDialogScheduleId],
  );

  const [extraMinutes, setExtraMinutes] = useState(30);
  const [strategy, setStrategy] = useState<RescheduleStrategy | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [applying, setApplying] = useState(false);

  // Reset per-open state whenever a different schedule opens the dialog
  useEffect(() => {
    setExtraMinutes(30);
    setStrategy(null);
    setAcknowledged(false);
    setApplying(false);
  }, [extendDialogScheduleId]);

  const tasks = useMemo(
    () => [
      ...personalTasks.map(t => ({ id: t.id, title: t.title })),
      ...workTasks.map(t => ({ id: t.id, title: t.title })),
    ],
    [personalTasks, workTasks],
  );

  const taskMap = useMemo(() => new Map(tasks.map(t => [t.id, t.title])), [tasks]);

  const daySchedules = useMemo(
    () => (schedule ? schedules.filter(s => s.date === schedule.date) : []),
    [schedules, schedule],
  );

  const proposal: RescheduleProposal | null = useMemo(() => {
    if (!extendDialogScheduleId || !schedule || !strategy || extraMinutes < 1) return null;
    const input = makeInput({
      scheduleId: schedule._id,
      extraMinutes,
      schedules: daySchedules,
      tasks,
      workStartMins: startMinutes,
      workEndMins: endMinutes,
    });
    return buildProposal(strategy, input) as RescheduleProposal | null;
  }, [extendDialogScheduleId, schedule, strategy, extraMinutes, daySchedules, tasks, startMinutes, endMinutes]);

  if (!extendDialogScheduleId || !schedule) return null;

  const targetTitle =
    typeof schedule.taskId === 'object' && schedule.taskId !== null
      ? (schedule.taskId as { title?: string }).title || 'Untitled Task'
      : taskMap.get(schedule.taskId as string) || 'Untitled Task';

  const hasUnabsorbed = !!proposal && !!(proposal.unabsorbedMins && proposal.unabsorbedMins > 0);
  const needsAck = !!proposal && (strategy === 'keep-as-is' || proposal.conflicts.length > 0);
  const canApply = !!proposal && !applying && !hasUnabsorbed && (!needsAck || acknowledged);

  const plannedMins = timeToMinutes(schedule.endTime) - timeToMinutes(schedule.startTime);

  const handleApply = async () => {
    if (!proposal || !strategy) return;
    setApplying(true);
    const ok = await applyReschedule(proposal.changes, {
      strategy,
      scheduleId: schedule._id,
      label: `Extended "${targetTitle}" +${extraMinutes}m (${STRATEGIES.find(s => s.id === strategy)?.name})`,
    });
    setApplying(false);
    if (ok) closeExtendDialog();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4"
        onClick={closeExtendDialog}
        role="dialog"
        aria-modal="true"
        aria-label="Extend Task Duration"
      >
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-surface-900 border border-surface-700 rounded-2xl shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-surface-800 sticky top-0 bg-surface-900 z-10">
            <div>
              <h2 className="text-sm font-bold text-surface-50">Extend Task Duration</h2>
              <p className="text-[11px] text-surface-400 mt-0.5">
                {targetTitle} · Original slot {schedule.startTime} – {schedule.endTime} ({formatMinutes(plannedMins)})
                {schedule.extendedMins ? ` · already extended ${schedule.extendedMins}m` : ''}
                {schedule.locked && ' · 🔒 Fixed slot'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {rescheduleHistory.length > 0 && (
                <Button size="sm" variant="ghost" onClick={() => void undoLastReschedule()} className="text-xs gap-1 text-surface-400 hover:text-surface-200">
                  <Undo2 size={12} /> Undo last
                </Button>
              )}
              <button onClick={closeExtendDialog} className="text-surface-400 hover:text-surface-200 p-1" aria-label="Close">
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* Extra minutes */}
            <div>
              <label className="block text-xs font-medium text-surface-300 mb-1.5" htmlFor="extend-extra-mins">
                Additional time requested
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  id="extend-extra-mins"
                  type="number"
                  min={5}
                  max={480}
                  step={5}
                  value={extraMinutes}
                  onChange={(e) => setExtraMinutes(Math.max(1, Math.min(480, Number(e.target.value) || 0)))}
                  className="w-24 bg-surface-950 border border-surface-700 rounded-lg px-2.5 py-1.5 text-sm text-surface-100 outline-none focus:border-brand-500"
                />
                <span className="text-xs text-surface-500">minutes</span>
                {[15, 30, 45, 60].map(mins => (
                  <button
                    key={mins}
                    onClick={() => setExtraMinutes(mins)}
                    className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                      extraMinutes === mins
                        ? 'bg-brand-500/20 border-brand-500/50 text-brand-300'
                        : 'bg-surface-950 border-surface-700 text-surface-300 hover:bg-surface-800'
                    }`}
                  >
                    +{mins}m
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-surface-400 mt-1.5">
                New proposed end time: <span className="font-semibold text-surface-200">{newEndPreview(schedule.endTime, extraMinutes)}</span>
              </p>
            </div>

            {/* Strategy cards */}
            <div>
              <p className="text-xs font-medium text-surface-300 mb-2">How should affected tasks be handled?</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {STRATEGIES.map(st => (
                  <button
                    key={st.id}
                    onClick={() => { setStrategy(st.id); setAcknowledged(false); }}
                    className={`text-left p-3 rounded-xl border transition-all ${
                      strategy === st.id
                        ? 'border-brand-500/60 bg-brand-500/10'
                        : 'border-surface-700 bg-surface-950 hover:border-surface-600'
                    }`}
                    aria-pressed={strategy === st.id}
                  >
                    <span className="flex items-center gap-2 text-xs font-semibold text-surface-100">
                      <span className={strategy === st.id ? 'text-brand-400' : 'text-surface-500'}>{st.icon}</span>
                      {st.name}
                    </span>
                    <p className="text-[10px] text-surface-400 mt-1 leading-snug">{st.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Preview */}
            {proposal && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-surface-200">Before → After preview</p>
                <div className="rounded-xl border border-surface-800 divide-y divide-surface-800/70 overflow-hidden">
                  {proposal.changes.map(c => (
                    <div key={c.scheduleId} className="p-2.5 flex items-center gap-2 text-xs bg-surface-950/60">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-surface-200 truncate">{c.taskTitle}</p>
                        <p className="text-[10px] text-surface-500">
                          <span className={c.kind === 'unchanged' ? 'text-surface-500' : 'text-surface-400 line-through'}>
                            {c.from.startTime} – {c.from.endTime}
                          </span>
                          {' '}<ArrowRight size={10} className="inline -mt-0.5" />{' '}
                          <span className="font-semibold text-surface-200">{c.to.startTime} – {c.to.endTime}</span>
                          {c.reducedMins !== undefined && c.originalMins !== undefined && (
                            <span className="text-amber-400"> ({c.originalMins}m → {c.reducedMins}m)</span>
                          )}
                        </p>
                      </div>
                      <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                        c.kind === 'extended' ? 'bg-brand-500/15 text-brand-300'
                        : c.kind === 'shifted' ? 'bg-sky-500/15 text-sky-300'
                        : c.kind === 'moved' ? 'bg-violet-500/15 text-violet-300'
                        : c.kind === 'shrunk' ? 'bg-amber-500/15 text-amber-300'
                        : 'bg-surface-800 text-surface-500'
                      }`}>
                        {c.kind}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3 text-[10px] text-surface-500 flex-wrap">
                  <span>Total additional scheduled time: <span className="font-semibold text-surface-300">+{proposal.totalExtraMins}m</span></span>
                  {proposal.absorbedMins !== undefined && <span>Absorbed by shrinking: {proposal.absorbedMins}m</span>}
                  {proposal.unabsorbedMins !== undefined && proposal.unabsorbedMins > 0 && (
                    <span className="text-amber-400">Unabsorbed: {proposal.unabsorbedMins}m</span>
                  )}
                </div>
              </div>
            )}

            {/* Warnings */}
            {proposal && proposal.warnings.length > 0 && (
              <div className="space-y-1.5">
                {proposal.warnings.map((w, i) => (
                  <div key={i} className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-[11px] text-amber-200 flex items-start gap-2">
                    <Info size={13} className="text-amber-400 flex-shrink-0 mt-0.5" />
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Conflicts */}
            {proposal && proposal.conflicts.length > 0 && (
              <div className="space-y-1.5">
                {proposal.conflicts.map((c, i) => (
                  <div key={i} className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-[11px] text-red-200 flex items-start gap-2">
                    <AlertTriangle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
                    <span>{c}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Required acknowledgement */}
            {proposal && needsAck && (
              <label className="flex items-start gap-2 p-2.5 rounded-xl bg-surface-950 border border-surface-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="mt-0.5 accent-brand-500"
                />
                <span className="text-[11px] text-surface-300">
                  {strategy === 'keep-as-is'
                    ? 'I understand the extended task will overlap the tasks above and I accept the overlaps.'
                    : 'I understand the conflicts above (locked/running tasks) and accept the proposed changes despite them.'}
                </span>
              </label>
            )}

            {/* Safety note */}
            <p className="text-[10px] text-surface-500 flex items-center gap-1.5">
              <Lock size={10} className="text-surface-600" />
              Completed slots are never moved. Running sessions are never interrupted. Every change is undoable and audited.
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 p-4 border-t border-surface-800 sticky bottom-0 bg-surface-900">
            <Button size="sm" variant="ghost" onClick={closeExtendDialog} className="text-xs">
              Cancel
            </Button>
            {strategy && (
              <Button size="sm" variant="secondary" onClick={() => { setStrategy(null); setAcknowledged(false); }} className="text-xs">
                Choose Another Strategy
              </Button>
            )}
            <Button size="sm" onClick={handleApply} disabled={!canApply} className="text-xs">
              {applying ? 'Applying…' : 'Apply Changes'}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
