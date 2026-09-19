import { motion } from 'framer-motion';

const QUOTES = [
  { text: 'One task at a time. One step at a time.', author: '' },
  { text: 'Small consistent progress leads to big results.', author: 'Keep going!' },
  { text: 'Discipline today builds the freedom tomorrow.', author: '' },
  { text: 'Focus is your superpower. Use it wisely.', author: '' },
  { text: 'Done is better than perfect.', author: '' },
];

export function RightSidebar() {
  const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];

  return (
    <div className="flex flex-col gap-5">
      {/* Motivational Quote */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl border border-surface-800 bg-surface-900 p-5 relative overflow-hidden"
      >
        <div className="absolute top-2 right-3 text-5xl text-brand-500/15 font-display select-none pointer-events-none leading-none">
          &ldquo;
        </div>
        <div className="relative z-10">
          <p className="text-sm font-semibold text-surface-100 leading-relaxed italic pr-6">
            {quote.text}
          </p>
          {quote.author && (
            <p className="text-xs text-surface-500 mt-2 font-medium">
              {quote.author} 🚀
            </p>
          )}
        </div>
      </motion.div>

      {/* Progress Card */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-2xl border border-surface-800 bg-surface-900 p-5 relative overflow-hidden"
      >
        <div className="absolute -top-4 -right-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
            <span className="text-emerald-400 text-xl">🌱</span>
          </div>
          <div>
            <p className="text-sm font-bold text-surface-200">Progress, not perfection.</p>
            <p className="text-xs text-surface-500 mt-0.5">You&apos;re building a better you.</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}