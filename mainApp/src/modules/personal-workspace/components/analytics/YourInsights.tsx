import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Lightbulb, TrendingUp, AlertTriangle } from 'lucide-react';

interface Insight {
  type: 'positive' | 'warning' | 'info';
  title: string;
  description: string;
}

interface YourInsightsProps {
  recentActivity: Array<{ date: string; type: string }>;
  focusedTimeMs: number;
  completedTasks: number;
  totalTasks: number;
  activeDays: number;
}

export function YourInsights({
  recentActivity,
  focusedTimeMs,
  completedTasks,
  totalTasks,
  activeDays,
}: YourInsightsProps) {
  const insights = useMemo(() => {
    const result: Insight[] = [];

    // Productivity insight
    if (completedTasks > 0) {
      const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      if (completionRate >= 60) {
        result.push({
          type: 'positive',
          title: 'Strong week!',
          description: `You completed ${completionRate}% of your tasks. Keep up the momentum!`,
        });
      }
    }

    // Consistency insight
    if (activeDays >= 5) {
      result.push({
        type: 'positive',
        title: 'Great consistency!',
        description: `You were active on ${activeDays} days this month. Consistency is key to progress.`,
      });
    } else if (activeDays > 0) {
      result.push({
        type: 'info',
        title: 'Try to stay consistent.',
        description: `You were active on ${activeDays} days. Aim for 12+ days to build momentum.`,
      });
    }

    // Focus insight
    if (focusedTimeMs > 0) {
      const hours = Math.round(focusedTimeMs / 3600000);
      if (hours >= 10) {
        result.push({
          type: 'positive',
          title: 'Deep focus mode!',
          description: `You've logged ${hours}+ hours of focused time. Your dedication shows!`,
        });
      }
    }

    // Task completion insight
    if (totalTasks > 0 && completedTasks < totalTasks * 0.3) {
      result.push({
        type: 'warning',
        title: 'Attention needed.',
        description: 'You have many pending tasks. Consider prioritizing and breaking them into smaller steps.',
      });
    }

    return result.slice(0, 3);
  }, [recentActivity, focusedTimeMs, completedTasks, totalTasks, activeDays]);

  if (insights.length === 0) return null;

  const getIcon = (type: Insight['type']) => {
    switch (type) {
      case 'positive': return <TrendingUp size={16} className="text-success-400" />;
      case 'warning': return <AlertTriangle size={16} className="text-warning-400" />;
      default: return <Lightbulb size={16} className="text-brand-400" />;
    }
  };

  const getBgColor = (type: Insight['type']) => {
    switch (type) {
      case 'positive': return 'bg-success-500/10 border-success-500/20';
      case 'warning': return 'bg-warning-500/10 border-warning-500/20';
      default: return 'bg-brand-500/10 border-brand-500/20';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
    >
      <h3 className="text-sm font-semibold text-surface-50 mb-3">Your Insights ✨</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {insights.map((insight, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.52 + idx * 0.05 }}
            className={`p-4 rounded-2xl border ${getBgColor(insight.type)}`}
          >
            <div className="flex items-center gap-2 mb-2">
              {getIcon(insight.type)}
              <p className="text-xs font-semibold text-surface-100">{insight.title}</p>
            </div>
            <p className="text-[11px] text-surface-300 leading-relaxed">{insight.description}</p>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}