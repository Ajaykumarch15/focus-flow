import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@shared/components/ui/Button';

// ── 404 ───────────────────────────────────────────────────────────────────────
// Theme source of truth = the `dark` class actually rendered on <html> (the
// same signal that drives every FocusFlow token). LIGHT: pure white page led
// entirely by the existing /404.png illustration. DARK: FocusFlow-typography
// treatment; the white-background PNG is never shown.

function useRenderedTheme(): 'light' | 'dark' {
  const [mode, setMode] = useState<'light' | 'dark'>(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  );

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setMode(root.classList.contains('dark') ? 'dark' : 'light');
    });
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return mode;
}

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] as const } },
};

export function NotFoundPage() {
  const renderedTheme = useRenderedTheme();
  const isDark = renderedTheme === 'dark';

  return (
    <div className={`relative min-h-[calc(100vh-3.5rem)] overflow-hidden ${isDark ? 'bg-surface-950' : 'bg-white'}`}>
      {/* Dark-only ambient accent glow */}
      {isDark && (
        <div
          aria-hidden="true"
          className="absolute top-0 right-0 w-[480px] h-[340px] opacity-20 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at top right, #8b5cf630, transparent 70%)' }}
        />
      )}

      <motion.div
        variants={fadeUp} initial="hidden" animate="show"
        className="relative min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center gap-9 px-6 py-12"
      >
        <h1 className="sr-only">Page not found</h1>

        {isDark ? (
          /* DARK — FocusFlow typography-led presentation */
          <div className="text-center" aria-hidden="true">
            <p className="font-display font-extrabold tracking-tight leading-none bg-gradient-to-br from-brand-500 via-brand-400 to-violet-600 bg-clip-text text-transparent text-[96px] sm:text-[136px]">
              404
            </p>
            <p className="-mt-2 sm:-mt-4 text-xl sm:text-2xl font-display font-bold text-surface-50">
              Page not found
            </p>
            <p className="mt-3 text-sm sm:text-base text-surface-400 leading-relaxed max-w-md mx-auto">
              The page you're looking for doesn't exist or may have moved.
            </p>
          </div>
        ) : (
          /* LIGHT — the existing illustration IS the visual */
          <img
            src="/404.png"
            alt=""
            aria-hidden="true"
            draggable={false}
            className="w-[90%] max-w-[500px] lg:max-w-[760px] h-auto object-contain select-none pointer-events-none"
          />
        )}

        <Link to="/" aria-label="Go to the FocusFlow home page">
          <Button size="lg" leftIcon={<ArrowLeft size={16} />} className="shadow-lg shadow-brand-500/20">
            Go Home
          </Button>
        </Link>
      </motion.div>
    </div>
  );
}
