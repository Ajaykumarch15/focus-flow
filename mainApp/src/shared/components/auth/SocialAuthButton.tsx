import type { ReactNode } from 'react';
import { GoogleIcon } from './GoogleIcon';

export function AuthDivider({ label }: { label: string }) {
  return (
    <div className="my-5 flex items-center gap-3" role="separator" aria-label={label}>
      <span className="h-px flex-1 bg-surface-800" />
      <span className="text-[11px] font-medium uppercase tracking-wider text-surface-500">{label}</span>
      <span className="h-px flex-1 bg-surface-800" />
    </div>
  );
}

interface SocialAuthButtonProps {
  onClick?: () => void;
  children?: ReactNode;
  disabled?: boolean;
}

export function SocialAuthButton({ onClick, children, disabled }: SocialAuthButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-surface-800 bg-surface-900 text-sm font-semibold text-surface-100 transition-all duration-200 hover:border-surface-700 hover:bg-surface-850 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:pointer-events-none disabled:opacity-50"
    >
      <GoogleIcon />
      {children ?? 'Continue with Google'}
    </button>
  );
}
