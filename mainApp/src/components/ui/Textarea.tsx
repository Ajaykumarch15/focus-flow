import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ invalid, className, ...rest }, ref) => (
  <textarea
    ref={ref}
    className={cn('input resize-y min-h-24 py-2.5 leading-relaxed', invalid && 'input-error', className)}
    aria-invalid={invalid || undefined}
    {...rest}
  />
));

Textarea.displayName = 'Textarea';
