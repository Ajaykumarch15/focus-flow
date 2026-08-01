import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertOctagon, X } from 'lucide-react';
import { useCollaborationStore } from '../../store/useCollaborationStore';
import { BlockerSeverity } from '../../types/collaboration';

export function CreateBlockerModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { createBlocker, tasks } = useCollaborationStore();
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<BlockerSeverity>('high');
  const [impactDescription, setImpactDescription] = useState('');
  const [taskId, setTaskId] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !impactDescription.trim()) return;

    createBlocker(title.trim(), severity, impactDescription.trim(), taskId || undefined);
    onClose();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="bg-surface-900 border border-surface-700/80 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-800 bg-surface-850/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <AlertOctagon size={18} />
            </div>
            <div>
              <h2 className="text-base font-display font-bold text-surface-50">Report Blocker</h2>
              <p className="text-xs text-surface-400">Notify managers & team immediately</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-surface-500 hover:text-surface-200 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-surface-300 mb-1.5">
              Blocker Title <span className="text-red-400">*</span>
            </label>
            <input className="input rounded-xl text-sm w-full" placeholder="e.g. Staging DB Timeout, API Auth failure..."
              value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
          </div>

          <div>
            <label className="block text-xs font-semibold text-surface-300 mb-1.5">Severity Level</label>
            <div className="grid grid-cols-4 gap-2">
              {(['critical', 'high', 'medium', 'low'] as const).map((sev) => {
                const selected = severity === sev;
                const colors = {
                  critical: 'bg-red-500/20 text-red-400 border-red-500/40',
                  high: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
                  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
                  low: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
                };
                return (
                  <button key={sev} type="button" onClick={() => setSeverity(sev)}
                    className={`py-2 rounded-xl text-xs font-bold uppercase border transition-all ${
                      selected ? colors[sev] : 'bg-surface-800 text-surface-500 border-surface-700'
                    }`}>
                    {sev}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-surface-300 mb-1.5">Associated Task (Optional)</label>
            <select className="input rounded-xl text-sm w-full" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
              <option value="">— Select Task —</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-surface-300 mb-1.5">
              Impact & Context Description <span className="text-red-400">*</span>
            </label>
            <textarea rows={3} className="input rounded-xl text-sm w-full resize-none"
              placeholder="What is blocked? Who is impacted? What help is needed?"
              value={impactDescription} onChange={(e) => setImpactDescription(e.target.value)} required />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 rounded-xl">Cancel</button>
            <button type="submit" disabled={!title.trim() || !impactDescription.trim()} className="btn-danger flex-1 rounded-xl">
              Report Blocker
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}
