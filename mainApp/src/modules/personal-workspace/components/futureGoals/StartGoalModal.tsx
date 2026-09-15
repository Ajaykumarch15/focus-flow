import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Target, X } from 'lucide-react';
import { useFutureGoalStore } from '@personal/services/useFutureGoalStore';
import { Button } from '@shared/components/ui/Button';
import type { FutureGoal } from '@personal/types/futureGoal';

interface StartGoalModalProps {
  goal: FutureGoal;
  onClose: () => void;
}

export function StartGoalModal({ goal, onClose }: StartGoalModalProps) {
  const navigate = useNavigate();
  const { startGoal } = useFutureGoalStore();
  const [description, setDescription] = useState(goal.description || `Goal: ${goal.title}`);
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    setLoading(true);
    try {
      const roadmapId = await startGoal(goal._id);
      onClose();
      navigate(`/personal/roadmaps/${roadmapId}`);
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative z-10 w-full max-w-md rounded-2xl bg-surface-900 border border-surface-700 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-5 border-b border-surface-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                <Target size={20} className="text-violet-400" />
              </div>
              <div>
                <h2 className="text-base font-display font-bold text-surface-50">Start Goal</h2>
                <p className="text-xs text-surface-400 truncate max-w-[220px]">{goal.title}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-800 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-xs text-surface-400 leading-relaxed">
            This will create a Roadmap to help you plan and track your progress. You can add phases, milestones, and tasks once it's created.
          </p>

          <div>
            <label className="block text-xs font-medium text-surface-300 mb-1.5">What do you want to achieve?</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-xl bg-surface-800 border border-surface-700 text-sm text-surface-100 placeholder-surface-500 px-3 py-2.5 outline-none focus:border-violet-500/50 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-surface-800 flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleStart} disabled={loading}>
            {loading ? 'Creating...' : 'Create Roadmap'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
