import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Layers, X, CalendarRange } from 'lucide-react';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';

const DEFAULT_CAPACITY_HOURS = 160;
const DEFAULT_TARGET_VELOCITY = 80;

function todayPlusDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// IES-R1 (P6-T4): Create-Sprint collects real project + capacity/target data.
// No mock members/ids — sprints carry no assignees; ownership is the workspace.
export function CreateSprintModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { projects, activeWorkspaceId, createSprint } = useCollaborationStore();

  const [projectId, setProjectId] = useState('');
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [goal, setGoal] = useState('');
  const [capacityHours, setCapacityHours] = useState(DEFAULT_CAPACITY_HOURS);
  const [targetVelocity, setTargetVelocity] = useState(DEFAULT_TARGET_VELOCITY);

  // Reset when the modal opens so stale values never leak into a new sprint.
  useEffect(() => {
    if (!isOpen) return;
    setProjectId(projects.find((p) => p.workspaceId === activeWorkspaceId)?.id ?? '');
    setName('');
    setStartDate(todayPlusDays(0));
    setEndDate(todayPlusDays(7));
    setGoal('');
    setCapacityHours(DEFAULT_CAPACITY_HOURS);
    setTargetVelocity(DEFAULT_TARGET_VELOCITY);
  }, [isOpen, projects, activeWorkspaceId]);

  const wsProjects = useMemo(
    () => projects.filter((p) => p.workspaceId === activeWorkspaceId),
    [projects, activeWorkspaceId],
  );

  if (!isOpen) return null;

  const datesValid = startDate && endDate && startDate <= endDate;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !name.trim() || !datesValid) return;
    createSprint(projectId, name.trim(), startDate, endDate, goal.trim(), {
      capacityHours,
      targetVelocity,
    });
    onClose();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="bg-surface-900 border border-surface-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-800 bg-surface-850/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
              <Layers size={18} />
            </div>
            <div>
              <h2 className="text-base font-display font-bold text-surface-50">Create Sprint</h2>
              <p className="text-xs text-surface-400">Commit capacity & velocity for a project</p>
            </div>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} className="p-1.5 text-surface-500 hover:text-surface-200 rounded-lg">
            <X size={18} />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-surface-300 mb-1.5">
              Project <span className="text-red-400">*</span>
            </label>
            <Select name="projectId" aria-label="Sprint project" required
              value={projectId} onChange={(e) => setProjectId(e.target.value)}
              className="bg-surface-850 border border-surface-700 text-sm text-surface-50 rounded-xl px-3 py-2.5 outline-none w-full">
              <option value="">Select project…</option>
              {wsProjects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
            {wsProjects.length === 0 && (
              <p className="text-[11px] text-surface-500 mt-1.5">
                No projects in this workspace yet — create one first.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-surface-300 mb-1.5">
              Sprint Name <span className="text-red-400">*</span>
            </label>
            <Input name="name" className="rounded-xl text-sm w-full"
              placeholder="e.g. Sprint 24 — AI Copilot"
              value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-surface-300 mb-1.5 flex items-center gap-1">
                <CalendarRange size={12} className="text-brand-400" /> Start
              </label>
              <Input name="startDate" type="date" className="rounded-xl text-sm w-full"
                value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-300 mb-1.5 flex items-center gap-1">
                <CalendarRange size={12} className="text-brand-400" /> End
              </label>
              <Input name="endDate" type="date" className="rounded-xl text-sm w-full"
                value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
            </div>
          </div>
          {!datesValid && (
            <p className="text-[11px] text-red-400 font-semibold">End date must be on or after the start date.</p>
          )}

          <div>
            <label className="block text-xs font-semibold text-surface-300 mb-1.5">Sprint Goal</label>
            <Textarea rows={2} className="rounded-xl text-sm w-full resize-none"
              placeholder="What is this sprint committing to deliver?"
              value={goal} onChange={(e) => setGoal(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-surface-300 mb-1.5">Capacity (hours)</label>
              <Input name="capacityHours" type="number" min={0}
                className="rounded-xl text-sm w-full"
                value={capacityHours} onChange={(e) => setCapacityHours(Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-surface-300 mb-1.5">Target Velocity (pts)</label>
              <Input name="targetVelocity" type="number" min={0}
                className="rounded-xl text-sm w-full"
                value={targetVelocity} onChange={(e) => setTargetVelocity(Number(e.target.value))} />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1 rounded-xl">Cancel</Button>
            <Button type="submit" disabled={!name.trim() || !projectId || !datesValid} className="flex-1 rounded-xl">
              Create Sprint
            </Button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
