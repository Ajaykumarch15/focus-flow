import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

const sideClasses: Record<TooltipSide, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

interface TooltipProps {
  label: ReactNode;
  children: ReactNode;
  side?: TooltipSide;
  className?: string;
}

export function Tooltip({ label, children, side = 'top', className }: TooltipProps) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-50 whitespace-nowrap rounded-lg bg-surface-100 px-2.5 py-1 text-xs font-medium text-surface-900 shadow-lg opacity-0 transition-all duration-150 group-hover:opacity-100',
          sideClasses[side],
          className,
        )}
      >
        {label}
      </span>
    </span>
  );
}
