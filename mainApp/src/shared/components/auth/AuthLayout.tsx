import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Zap, TrendingUp, BookmarkCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStore } from '@worklog/services/useStore';
import { ThemeToggle } from '@shared/components/ui/ThemeToggle';

const BENEFITS = [
  {
    icon: Zap,
    title: 'Stay Focused',
    desc: 'Eliminate distractions and get things done.',
  },
  {
    icon: TrendingUp,
    title: 'Track Progress',
    desc: 'Measure your focus time and productivity.',
  },
  {
    icon: BookmarkCheck,
    title: 'Remember Work',
    desc: 'Pick up exactly where you left off.',
  },
];

function AuthHeader() {
  const theme = useStore(s => s.theme);
  const logo = theme.mode === 'dark' ? '/focusflow-logo-dark.png' : '/focusflow-logo-light.png';
  return (
    <header className="w-full relative z-20">
      <div className="max-w-7xl mx-auto flex items-center justify-between px-5 sm:px-8 py-5">
        <Link to="/" aria-label="FocusFlow home" className="inline-flex items-center rounded-lg">
          <img src={logo} alt="FocusFlow" className="h-8 w-auto" />
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}

function MobileBenefits() {
  return (
    <div className="lg:hidden px-5 pb-5 pt-1">
      <div className="flex items-center justify-center gap-5">
        {BENEFITS.map((b, i) => (
          <motion.div
            key={b.title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.3 + i * 0.06 }}
            className="flex items-center gap-2"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 border border-brand-500/15 text-brand-400">
              <b.icon size={12} />
            </span>
            <span className="text-[11px] font-semibold text-surface-300">{b.title}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-950 text-surface-50 flex flex-col overflow-hidden">
      <AuthHeader />

      <main className="relative flex-1 flex flex-col lg:flex-row min-h-0">
        {/* LEFT PANEL - brand + benefits + illustration */}
        <div className="hidden lg:flex lg:w-[42%] xl:w-[45%] flex-col justify-center pl-10 xl:pl-14 pr-6 xl:pr-8 relative overflow-hidden">
          {/* Subtle ambient blobs - no solid background, blends with main bg */}
          <div className="absolute top-[15%] left-[10%] w-56 h-56 rounded-full bg-brand-400/[0.03] blur-3xl pointer-events-none" />
          <div className="absolute bottom-[20%] right-[5%] w-40 h-40 rounded-full bg-violet-400/[0.02] blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.1 }}
            >
              <h1 className="text-2xl xl:text-3xl font-display font-extrabold tracking-tight leading-[1.1] mb-2">
                Focus deeper.
                <br />
              </h1>
              <p className="text-xs text-surface-400 max-w-xs leading-relaxed mb-8">
                Task management, time tracking, and analytics — all in one app.
              </p>
            </motion.div>

            {/* Benefits - compact vertical list */}
            <div className="space-y-3">
              {BENEFITS.map((b, i) => (
                <motion.div
                  key={b.title}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.35, delay: 0.2 + i * 0.07 }}
                  className="flex items-center gap-3"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-400">
                    <b.icon size={15} />
                  </span>
                  <div>
                    <p className="text-xs font-bold text-surface-100">{b.title}</p>
                    <p className="text-[11px] text-surface-400">{b.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Illustration - smaller, at bottom */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="relative z-10 mt-auto pt-8"
          >
            <img
              src="/login_page_01.png"
              alt=""
              aria-hidden="true"
              className="w-full max-w-[180px] object-contain opacity-80 select-none pointer-events-none"
              draggable={false}
            />
          </motion.div>
        </div>

        {/* RIGHT PANEL - form */}
        <div className="flex-1 lg:w-[58%] xl:w-[55%] flex items-center justify-center px-5 sm:px-8 lg:px-12 py-6 lg:py-0">
          <div className="w-full max-w-sm relative z-10">
            {children}
          </div>
        </div>
      </main>

      <MobileBenefits />
    </div>
  );
}
