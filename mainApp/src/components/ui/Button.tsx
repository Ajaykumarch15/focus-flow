import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'ghost' | 'outline';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-md shadow-brand-500/25 ' +
    'hover:shadow-lg hover:shadow-brand-500/35 hover:-translate-y-px',
  secondary: 'bg-surface-900 text-surface-50 border border-surface-800 hover:bg-surface-850 hover:border-surface-700',
  danger: 'bg-danger-500/10 text-danger-600 dark:text-danger-400 border border-danger-500/20 hover:bg-danger-500/20',
  success: 'bg-success-500/10 text-success-600 dark:text-success-400 border border-success-500/20 hover:bg-success-500/20',
  ghost: 'text-surface-400 hover:text-surface-50 hover:bg-surface-850',
  outline: 'border border-surface-800 text-surface-50 hover:bg-surface-850 hover:border-surface-700',
};

const sizeClasses: Record<ButtonSize, string> = {
  xs: 'h-7 px-2.5 text-xs gap-1.5 rounded-lg',
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-9 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-11 px-5 text-sm gap-2 rounded-xl',
  icon: 'h-9 w-9 rounded-xl p-0 justify-center',
  'icon-sm': 'h-8 w-8 rounded-lg p-0 justify-center',
};

const baseClasses =
  'inline-flex items-center justify-center font-semibold transition-all duration-200 select-none ' +
  'disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]';

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = 'primary', size = 'md', loading = false, leftIcon, rightIcon, className, disabled, children, ...rest },
    ref,
  ) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
      {...rest}
    >
      {loading ? <Spinner size={14} /> : leftIcon}
      {children}
      {rightIcon}
    </button>
  ),
);

Button.displayName = 'Button';
