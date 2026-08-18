import { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';

interface KpiCounterProps {
  value: number | string;
  duration?: number; // ms
  prefix?: string;
  suffix?: string;
  className?: string;
}

export function KpiCounter({
  value,
  duration = 800,
  prefix = '',
  suffix = '',
  className = '',
}: KpiCounterProps) {
  const { theme } = useStore();
  const isReducedMotion = theme?.reducedMotion;

  const numericTarget = typeof value === 'number' ? value : parseFloat(String(value));
  const isNumeric = !isNaN(numericTarget);

  const [displayValue, setDisplayValue] = useState<number>(0);

  useEffect(() => {
    if (!isNumeric || isReducedMotion) {
      return;
    }

    let startTimestamp: number | null = null;
    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // Ease out quad
      const easedProgress = 1 - (1 - progress) * (1 - progress);
      setDisplayValue(Math.round(easedProgress * numericTarget));

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      }
    };

    animationFrameId = requestAnimationFrame(step);

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [numericTarget, duration, isNumeric, isReducedMotion]);

  if (!isNumeric || isReducedMotion) {
    return <span className={className}>{prefix}{value}{suffix}</span>;
  }

  return (
    <span className={className}>
      {prefix}{displayValue}{suffix}
    </span>
  );
}
