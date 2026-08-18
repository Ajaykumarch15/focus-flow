import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/useStore';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

export function AnimatedCounter({ value, duration = 800, decimals = 0, prefix = '', suffix = '', className }: AnimatedCounterProps) {
  const { theme } = useStore();
  const reducedMotion = theme?.reducedMotion;
  const [display, setDisplay] = useState(reducedMotion ? value : 0);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);

  useEffect(() => {
    if (reducedMotion) { setDisplay(value); return; }
    fromRef.current = display;
    startRef.current = null;

    const animate = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = fromRef.current + (value - fromRef.current) * eased;
      setDisplay(current);
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration, reducedMotion]);

  const formatted = decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString();
  return <span className={className}>{prefix}{formatted}{suffix}</span>;
}
