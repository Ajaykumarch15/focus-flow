import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ invalid, className, ...rest }, ref) => (
  <input
    ref={ref}
    className={cn('input', invalid && 'input-error', className)}
    aria-invalid={invalid || undefined}
    {...rest}
  />
));

Input.displayName = 'Input';
