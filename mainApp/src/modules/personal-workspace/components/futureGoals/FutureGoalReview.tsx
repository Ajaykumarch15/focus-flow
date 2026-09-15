import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Bookmark } from 'lucide-react';
import { useFutureGoalStore } from '@personal/services/useFutureGoalStore';
import { Card } from '@shared/components/ui/Card';
import { Button } from '@shared/components/ui/Button';
import { FUTURE_GOAL_CATEGORY_LABELS } from '@personal/types/futureGoal';
import { StartGoalModal } from './StartGoalModal';
import { useState } from 'react';

function monthsAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const days = Math.floor(diffMs / 86400000);
  if (days < 30) return `${days} days`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months > 1 ? 's' : ''}`;
  const years = Math.floor(months / 12);
  return `${years} year${years > 1 ? 's' : ''}`;
}

export function FutureGoalReview() {
  const { reviewGoals, reviewLoading, loadReviewGoals, reviewGoal, changeStatus } = useFutureGoalStore();
  const [startGoalId, setStartGoalId] = useState<string | null>(null);

  useEffect(() => { loadReviewGoals(); }, [loadReviewGoals]);

  if (reviewLoading || reviewGoals.length === 0) return null;

  const startGoal = reviewGoals.find(g => g._id === startGoalId);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <Card className="p-5 border-amber-500/20 bg-amber-500/5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Bookmark size={16} className="text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-display font-bold text-surface-100">Forgotten Ideas</h3>
              <p className="text-[11px] text-surface-400">
                You added these {reviewGoals.length > 1 ? `${reviewGoals.length} goals` : 'goal'} a while ago
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {reviewGoals.slice(0, 5).map((goal) => (
                <motion.div
                  key={goal._id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-900/50 border border-surface-800"
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: goal.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-surface-200 truncate">{goal.title}</p>
                    <p className="text-[10px] text-surface-500">
                      {monthsAgo(goal.createdAt)} ago · {FUTURE_GOAL_CATEGORY_LABELS[goal.category]}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[11px] px-2"
                      onClick={() => setStartGoalId(goal._id)}
                    >
                      <ArrowRight size={12} className="mr-1" />
                      Start
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[11px] px-2"
                      onClick={() => reviewGoal(goal._id)}
                    >
                      Keep
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[11px] px-2 text-red-400 hover:text-red-300"
                      onClick={() => changeStatus(goal._id, 'dropped')}
                    >
                      Drop
                    </Button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </Card>
      </motion.div>

      {startGoal && (
        <StartGoalModal goal={startGoal} onClose={() => setStartGoalId(null)} />
      )}
    </>
  );
}
