import { forwardRef, type SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@shared/utils/cn';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ invalid, className, children, ...rest }, ref) => (
  <div className="relative w-full">
    <select
      ref={ref}
      className={cn('input appearance-none pr-10 cursor-pointer', invalid && 'input-error', className)}
      aria-invalid={invalid || undefined}
      {...rest}
    >
      {children}
    </select>
    <ChevronDown
      size={16}
      aria-hidden="true"
      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-surface-400"
    />
  </div>
));

Select.displayName = 'Select';
