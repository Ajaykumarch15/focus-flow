import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Plus, Sparkles } from 'lucide-react';
import { useFutureGoalStore } from '@personal/services/useFutureGoalStore';
import { Input } from '@shared/components/ui/Input';
import { Button } from '@shared/components/ui/Button';
import { FUTURE_GOAL_CATEGORY_LABELS, FUTURE_GOAL_CATEGORY_COLORS, type FutureGoalCategory } from '@personal/types/futureGoal';

const CATEGORIES: FutureGoalCategory[] = ['other', 'career', 'projects', 'learning', 'travel', 'personal', 'health', 'finance', 'creative'];

export function FutureGoalQuickAdd() {
  const { createGoal } = useFutureGoalStore();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<FutureGoalCategory>('other');
  const [isCreating, setIsCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    const trimmed = title.trim();
    if (!trimmed || isCreating) return;
    setIsCreating(true);
    try {
      await createGoal({ title: trimmed, category, color: FUTURE_GOAL_CATEGORY_COLORS[category] });
      setTitle('');
      setCategory('other');
      inputRef.current?.focus();
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="flex items-center gap-2 p-3 rounded-2xl bg-surface-900 border border-surface-800 hover:border-surface-700 transition-colors"
    >
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex-shrink-0">
        <Sparkles size={16} className="text-violet-400" />
      </div>
      <input
        ref={inputRef}
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="I want to..."
        className="flex-1 bg-transparent text-sm text-surface-100 placeholder-surface-500 outline-none min-w-0"
        disabled={isCreating}
      />
      <select
        value={category}
        onChange={e => setCategory(e.target.value as FutureGoalCategory)}
        className="h-8 px-2 rounded-lg bg-surface-800 border border-surface-700 text-xs text-surface-300 outline-none focus:border-violet-500/50 cursor-pointer"
      >
        {CATEGORIES.map(c => (
          <option key={c} value={c}>{FUTURE_GOAL_CATEGORY_LABELS[c]}</option>
        ))}
      </select>
      <Button
        size="sm"
        onClick={handleSubmit}
        disabled={!title.trim() || isCreating}
        leftIcon={<Plus size={14} />}
        className="flex-shrink-0"
      >
        Add
      </Button>
    </motion.div>
  );
}
