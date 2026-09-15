import { useState } from 'react';
import { motion } from 'framer-motion';
import { Trash2, ArrowRight, Clock, MoreHorizontal, ChevronDown } from 'lucide-react';
import { useFutureGoalStore } from '@personal/services/useFutureGoalStore';
import { Card } from '@shared/components/ui/Card';
import { Badge } from '@shared/components/ui/Badge';
import { Button } from '@shared/components/ui/Button';
import {
  FUTURE_GOAL_CATEGORY_LABELS,
  FUTURE_GOAL_STATUS_LABELS,
  FUTURE_GOAL_STATUS_TONES,
  type FutureGoal,
  type FutureGoalStatus,
} from '@personal/types/futureGoal';
import { StartGoalModal } from './StartGoalModal';

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const days = Math.floor(diffMs / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years > 1 ? 's' : ''} ago`;
}

interface FutureGoalCardProps {
  goal: FutureGoal;
}

export function FutureGoalCard({ goal }: FutureGoalCardProps) {
  const { changeStatus, deleteGoal, reviewGoal } = useFutureGoalStore();
  const [showStart, setShowStart] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const isActive = goal.status === 'active';
  const isDone = goal.status === 'completed' || goal.status === 'dropped';
  const nextStatuses: FutureGoalStatus[] = goal.status === 'someday'
    ? ['considering']
    : goal.status === 'considering'
      ? ['someday']
      : [];

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
      >
        <Card className={`p-4 group transition-all duration-200 hover:shadow-lg hover:shadow-black/10 ${isDone ? 'opacity-60' : 'hover:border-surface-700'}`}>
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: goal.color }}
              />
              <h3 className="font-display font-bold text-surface-50 text-sm truncate">
                {goal.title}
              </h3>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Badge tone={FUTURE_GOAL_STATUS_TONES[goal.status]}>
                {FUTURE_GOAL_STATUS_LABELS[goal.status]}
              </Badge>
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-1 rounded-lg text-surface-500 hover:text-surface-300 hover:bg-surface-800 transition-colors"
                >
                  <MoreHorizontal size={14} />
                </button>
                {showMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                    <div className="absolute right-0 top-8 z-20 w-40 py-1 rounded-xl bg-surface-800 border border-surface-700 shadow-xl">
                      {goal.status !== 'completed' && goal.status !== 'dropped' && goal.status !== 'active' && (
                        <button
                          onClick={() => { changeStatus(goal._id, 'completed'); setShowMenu(false); }}
                          className="w-full text-left px-3 py-1.5 text-xs text-surface-300 hover:bg-surface-700 transition-colors"
                        >
                          Mark completed
                        </button>
                      )}
                      {nextStatuses.map(s => (
                        <button
                          key={s}
                          onClick={() => { changeStatus(goal._id, s); setShowMenu(false); }}
                          className="w-full text-left px-3 py-1.5 text-xs text-surface-300 hover:bg-surface-700 transition-colors"
                        >
                          Move to {FUTURE_GOAL_STATUS_LABELS[s]}
                        </button>
                      ))}
                      {goal.status !== 'dropped' && goal.status !== 'active' && (
                        <button
                          onClick={() => { changeStatus(goal._id, 'dropped'); setShowMenu(false); }}
                          className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          Drop goal
                        </button>
                      )}
                      <button
                        onClick={() => { deleteGoal(goal._id); setShowMenu(false); }}
                        className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {goal.description && (
            <p className="text-xs text-surface-400 line-clamp-2 mb-2">
              {goal.description}
            </p>
          )}

          <div className="flex items-center gap-2 text-[11px] text-surface-500 mb-3">
            <span>{FUTURE_GOAL_CATEGORY_LABELS[goal.category]}</span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {timeAgo(goal.createdAt)}
            </span>
            {goal.lastReviewedAt && (
              <>
                <span>·</span>
                <span>Reviewed {timeAgo(goal.lastReviewedAt)}</span>
              </>
            )}
          </div>

          {!isDone && !isActive && goal.status !== 'active' && (
            <div className="flex gap-2 pt-2 border-t border-surface-800/50">
              {(goal.status === 'someday' || goal.status === 'considering') && (
                <Button
                  size="sm"
                  onClick={() => setShowStart(true)}
                  leftIcon={<ArrowRight size={12} />}
                  className="flex-1"
                >
                  Start Goal
                </Button>
              )}
              {goal.status === 'someday' && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => changeStatus(goal._id, 'considering')}
                >
                  Consider
                </Button>
              )}
            </div>
          )}

          {isActive && goal.linkedRoadmapId && (
            <div className="pt-2 border-t border-surface-800/50">
              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                onClick={() => window.location.href = `/personal/roadmaps/${goal.linkedRoadmapId}`}
                rightIcon={<ArrowRight size={12} />}
              >
                View Roadmap
              </Button>
            </div>
          )}
        </Card>
      </motion.div>

      {showStart && (
        <StartGoalModal goal={goal} onClose={() => setShowStart(false)} />
      )}
    </>
  );
}
