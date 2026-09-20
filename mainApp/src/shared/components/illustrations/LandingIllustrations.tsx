import type { IllustrationProps } from './types';

export function HeroIllustration({ size = 300, className }: IllustrationProps) {
  return (
    <svg width={size} height={size * 0.75} viewBox="0 0 300 225" fill="none" className={className} aria-hidden="true">
      <rect x="30" y="40" width="240" height="150" rx="16" stroke="currentColor" strokeWidth="1.5" opacity="0.12" />
      <rect x="45" y="55" width="210" height="120" rx="8" stroke="currentColor" strokeWidth="1" opacity="0.08" />
      <line x1="45" y1="80" x2="255" y2="80" stroke="currentColor" strokeWidth="1" opacity="0.06" />
      <rect x="55" y="60" width="8" height="8" rx="2" fill="currentColor" opacity="0.08" />
      <rect x="68" y="60" width="8" height="8" rx="2" fill="currentColor" opacity="0.06" />
      <rect x="81" y="60" width="8" height="8" rx="2" fill="currentColor" opacity="0.04" />
      <rect x="55" y="90" width="60" height="8" rx="2" stroke="currentColor" strokeWidth="1" opacity="0.08" />
      <rect x="55" y="105" width="45" height="8" rx="2" stroke="currentColor" strokeWidth="1" opacity="0.06" />
      <rect x="55" y="120" width="55" height="8" rx="2" stroke="currentColor" strokeWidth="1" opacity="0.05" />
      <rect x="130" y="90" width="115" height="75" rx="6" stroke="currentColor" strokeWidth="1" opacity="0.06" />
      <path d="M145 150 L165 120 L185 135 L210 105 L230 115" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.1" />
      <circle cx="165" cy="120" r="3" fill="currentColor" opacity="0.08" />
      <circle cx="210" cy="105" r="3" fill="currentColor" opacity="0.1" />
    </svg>
  );
}

export function SmartTimerFeature({ size = 60, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" fill="none" className={className} aria-hidden="true">
      <circle cx="30" cy="32" r="20" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
      <line x1="30" y1="32" x2="30" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.25" />
      <line x1="30" y1="32" x2="40" y2="32" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.18" />
      <circle cx="30" cy="32" r="2.5" fill="currentColor" opacity="0.2" />
      <line x1="30" y1="8" x2="30" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.12" />
      <line x1="18" y1="12" x2="20" y2="15" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.1" />
      <line x1="42" y1="12" x2="40" y2="15" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.1" />
    </svg>
  );
}

export function AnalyticsFeature({ size = 60, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" fill="none" className={className} aria-hidden="true">
      <line x1="12" y1="48" x2="12" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.15" />
      <line x1="12" y1="48" x2="50" y2="48" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.15" />
      <rect x="18" y="35" width="6" height="13" rx="1.5" stroke="currentColor" strokeWidth="1" opacity="0.12" />
      <rect x="28" y="25" width="6" height="23" rx="1.5" stroke="currentColor" strokeWidth="1" opacity="0.15" />
      <rect x="38" y="30" width="6" height="18" rx="1.5" stroke="currentColor" strokeWidth="1" opacity="0.12" />
      <path d="M21 32 L31 22 L41 28" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.15" />
    </svg>
  );
}

export function JournalFeature({ size = 60, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" fill="none" className={className} aria-hidden="true">
      <rect x="15" y="10" width="30" height="40" rx="4" stroke="currentColor" strokeWidth="1.5" opacity="0.18" />
      <line x1="22" y1="10" x2="22" y2="50" stroke="currentColor" strokeWidth="1" opacity="0.1" />
      <line x1="27" y1="22" x2="40" y2="22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.12" />
      <line x1="27" y1="30" x2="38" y2="30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.08" />
      <line x1="27" y1="38" x2="36" y2="38" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.06" />
    </svg>
  );
}

export function FocusModeFeature({ size = 60, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" fill="none" className={className} aria-hidden="true">
      <circle cx="30" cy="30" r="22" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.12" />
      <circle cx="30" cy="30" r="14" stroke="currentColor" strokeWidth="1.5" opacity="0.18" />
      <circle cx="30" cy="30" r="6" stroke="currentColor" strokeWidth="1.5" opacity="0.22" />
      <circle cx="30" cy="30" r="1.5" fill="currentColor" opacity="0.25" />
    </svg>
  );
}

export function SubtasksFeature({ size = 60, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" fill="none" className={className} aria-hidden="true">
      <rect x="12" y="14" width="36" height="8" rx="3" stroke="currentColor" strokeWidth="1.5" opacity="0.18" />
      <rect x="18" y="28" width="30" height="7" rx="2.5" stroke="currentColor" strokeWidth="1" opacity="0.12" />
      <rect x="18" y="40" width="24" height="7" rx="2.5" stroke="currentColor" strokeWidth="1" opacity="0.08" />
      <path d="M16 18 L19 21 L23 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.2" />
    </svg>
  );
}

export function DailyGoalsFeature({ size = 60, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 60 60" fill="none" className={className} aria-hidden="true">
      <circle cx="30" cy="30" r="20" stroke="currentColor" strokeWidth="1.5" opacity="0.12" />
      <circle cx="30" cy="30" r="20" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="80 50" opacity="0.18" />
      <circle cx="30" cy="30" r="12" stroke="currentColor" strokeWidth="1.5" opacity="0.08" />
      <circle cx="30" cy="30" r="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="50 26" opacity="0.14" />
      <path d="M26 30 L29 33 L35 27" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.2" />
    </svg>
  );
}
