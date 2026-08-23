import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Zap, TrendingUp, BookmarkCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import { ThemeToggle } from '../ui/ThemeToggle';

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
    <header className="w-full">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-5 sm:px-8 py-6">
        <Link to="/" aria-label="FocusFlow home" className="inline-flex items-center rounded-lg">
          <img src={logo} alt="FocusFlow" className="h-9 w-auto" />
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}

interface AuthIllustrationProps {
  variant: 'person' | 'growth';
}

function AuthIllustration({ variant }: AuthIllustrationProps) {
  const theme = useStore(s => s.theme);
  const isDark = theme.mode === 'dark';
  const src = variant === 'person'
    ? (isDark ? '/auth-illustration-person-dark.png' : '/auth-illustration-person-light.png')
    : (isDark ? '/auth-illustration-growth-dark.png' : '/auth-illustration-growth-light.png');
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, delay: variant === 'person' ? 0.25 : 0.35 }}
      aria-hidden="true"
      className={`hidden md:block select-none pointer-events-none shrink-0 ${
        variant === 'person' ? 'order-first' : 'order-last'
      }`}
    >
      <img
        src={src}
        alt=""
        className={`w-auto object-contain opacity-90 ${
          variant === 'person'
            ? 'h-36 lg:h-52 xl:h-60'
            : 'h-32 lg:h-48 xl:h-56'
        }`}
        draggable={false}
      />
    </motion.div>
  );
}

function MobileDecoration() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      aria-hidden="true"
      className="md:hidden -mt-4 flex justify-center gap-2"
    >
      {BENEFITS.map(b => (
        <span
          key={b.title}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-900/70 border border-surface-800 text-brand-400 dark:text-brand-300"
        >
          <b.icon size={13} />
        </span>
      ))}
    </motion.div>
  );
}

function AuthBenefits() {
  return (
    <footer className="w-full pb-10 pt-4">
      <div className="max-w-3xl mx-auto px-5 sm:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
          {BENEFITS.map((b, i) => (
            <motion.div
              key={b.title}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.45 + i * 0.08 }}
              className="flex sm:flex-col items-center sm:text-center gap-3"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 border border-brand-500/15 text-brand-400 dark:text-brand-300">
                <b.icon size={16} />
              </span>
              <div>
                <p className="text-xs font-bold text-surface-100">{b.title}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-surface-400 max-w-[22ch]">{b.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </footer>
  );
}

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-950 text-surface-50 flex flex-col relative overflow-hidden">
      {/* Ambient decoration — subtle, theme-aware */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[560px] h-[320px] rounded-full blur-3xl bg-brand-500/10 dark:bg-indigo-500/10" />
        <div className="absolute bottom-[-120px] right-[-80px] w-[380px] h-[280px] rounded-full blur-3xl bg-violet-500/8 dark:bg-violet-600/10 hidden sm:block" />
      </div>

      <AuthHeader />

      <main className="relative flex-1 flex items-center justify-center px-4 sm:px-6 py-8 lg:py-12">
        <div className="w-full max-w-5xl flex flex-col md:flex-row items-center justify-center gap-6 md:gap-4 xl:gap-10">
          <AuthIllustration variant="person" />
          <div className="w-full max-w-md relative z-10">{children}</div>
          <AuthIllustration variant="growth" />
        </div>
      </main>

      <MobileDecoration />
      <AuthBenefits />
    </div>
  );
}
