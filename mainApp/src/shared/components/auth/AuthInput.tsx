import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@shared/utils/cn';

interface AuthInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label: string;
  icon: ReactNode;
  error?: string;
  showToggle?: boolean;
  labelHidden?: boolean;
  action?: ReactNode;
}

export function AuthInput({ label, icon, error, showToggle = false, labelHidden = false, action, type = 'text', ...rest }: AuthInputProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const [visible, setVisible] = useState(false);
  const inputType = showToggle ? (visible ? 'text' : type) : type;

  return (
    <div>
      <div className={cn('mb-1.5 flex items-center justify-between', labelHidden && 'sr-only')}>
        <label htmlFor={id} className="text-xs font-bold uppercase tracking-wider text-surface-300">
          {label}
        </label>
        {action}
      </div>
      <div className="relative">
        <span aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-500">
          {icon}
        </span>
        <input
          id={id}
          type={inputType}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            'h-11 w-full rounded-xl border border-surface-800 bg-surface-850 pl-10 pr-10 text-sm text-surface-50 outline-none transition-all duration-200',
            'placeholder:text-surface-500 hover:border-surface-700',
            'focus:border-brand-500 focus:ring-[3px] focus:ring-brand-500/15',
            'disabled:cursor-not-allowed disabled:opacity-60',
            error && 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/15'
          )}
          {...rest}
        />
        {showToggle && (
          <button
            type="button"
            onClick={() => setVisible(v => !v)}
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-surface-500 transition-colors hover:text-surface-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
          >
            {visible ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        )}
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-danger-600 dark:text-danger-400">
          ⚠ {error}
        </p>
      )}
    </div>
  );
}
