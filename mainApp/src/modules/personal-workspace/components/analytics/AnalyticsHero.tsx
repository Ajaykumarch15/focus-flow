import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface AnalyticsHeroProps {
  productivityScore: number | null;
  comparison: { pct: number; direction: 'up' | 'down' | 'flat' } | null;
}

export function AnalyticsHero({ productivityScore, comparison }: AnalyticsHeroProps) {
  if (productivityScore === null) return null;

  const getMotivationalMessage = (score: number) => {
    if (score >= 80) return "You're on fire! Keep the momentum.";
    if (score >= 60) return "You're making progress. Keep going!";
    if (score >= 40) return "Small steps lead to big achievements.";
    return "Every journey starts with a single step.";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="relative overflow-hidden -mx-4 sm:-mx-6 lg:-mx-8"
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 px-6 sm:px-8 lg:px-10 pt-0 pb-6 sm:pb-8 lg:pb-10 min-h-[200px] sm:min-h-[240px] max-w-[1400px] mx-auto">
        {/* Left: Text content */}
        <div className="flex-1 max-w-md">
          <h2 className="text-xl sm:text-2xl font-display font-extrabold text-surface-50 leading-tight mb-2">
            {getMotivationalMessage(productivityScore)}
          </h2>
          <p className="text-sm text-surface-400 mb-6">
            Keep going, small steps lead to big achievements.
          </p>

          {/* Productivity Score */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-surface-800"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeDasharray={`${(productivityScore / 100) * 264} 264`}
                  strokeLinecap="round"
                  className="text-brand-400"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-surface-50">{productivityScore}</span>
                <span className="text-[10px] text-surface-400">/100</span>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-surface-200">Productivity Score</p>
              {comparison && comparison.direction !== 'flat' && (
                <div className={`flex items-center gap-1 mt-1 text-xs font-medium ${
                  comparison.direction === 'up' ? 'text-success-400' : 'text-danger-400'
                }`}>
                  {comparison.direction === 'up' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {Math.abs(comparison.pct)}% from last period
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Illustration */}
        <div className="hidden sm:block flex-shrink-0 w-44 h-44 lg:w-52 lg:h-52">
          <img src="/SVG/roadmap.png" alt="" className="w-full h-full object-contain drop-shadow-md" />
        </div>
      </div>

      {/* Decorative quote */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 lg:top-8 lg:right-10 text-right pointer-events-none">
        <p className="text-xs text-brand-400/70 font-medium italic" style={{ transform: 'rotate(2deg)' }}>
          "Plan.<br />Focus.<br />Achieve."
        </p>
      </div>

      {/* Background decorative elements */}
      <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-brand-500/10 blur-2xl" />
      <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-brand-500/5 blur-2xl" />
    </motion.div>
  );
}