import type { IllustrationProps } from './types';

export function HabitRings({ size = 300, className }: IllustrationProps) {
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 300 180" fill="none" className={className} aria-hidden="true">
      <circle cx="150" cy="90" r="60" stroke="currentColor" strokeWidth="2" opacity="0.15" />
      <circle cx="150" cy="90" r="60" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="120 260" opacity="0.2" />
      <circle cx="150" cy="90" r="45" stroke="currentColor" strokeWidth="2" opacity="0.12" />
      <circle cx="150" cy="90" r="45" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="90 190" opacity="0.18" />
      <circle cx="150" cy="90" r="30" stroke="currentColor" strokeWidth="1.5" opacity="0.1" />
      <circle cx="150" cy="90" r="30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="60 130" opacity="0.15" />
      <circle cx="150" cy="90" r="6" fill="currentColor" opacity="0.15" />
    </svg>
  );
}

export function ControlPanel({ size = 300, className }: IllustrationProps) {
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 300 180" fill="none" className={className} aria-hidden="true">
      <rect x="40" y="30" width="220" height="120" rx="12" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <circle cx="90" cy="80" r="25" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <path d="M90 60 L90 80 L105 80" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.2" />
      <rect x="140" y="55" width="80" height="8" rx="4" stroke="currentColor" strokeWidth="1" opacity="0.12" />
      <rect x="140" y="70" width="60" height="8" rx="4" stroke="currentColor" strokeWidth="1" opacity="0.1" />
      <rect x="140" y="85" width="70" height="8" rx="4" stroke="currentColor" strokeWidth="1" opacity="0.08" />
      <rect x="55" y="120" width="30" height="18" rx="4" stroke="currentColor" strokeWidth="1" opacity="0.12" />
      <rect x="95" y="120" width="30" height="18" rx="4" stroke="currentColor" strokeWidth="1" opacity="0.1" />
      <rect x="135" y="120" width="30" height="18" rx="4" stroke="currentColor" strokeWidth="1" opacity="0.08" />
    </svg>
  );
}

export function DataVisualization({ size = 300, className }: IllustrationProps) {
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 300 180" fill="none" className={className} aria-hidden="true">
      <circle cx="100" cy="90" r="50" stroke="currentColor" strokeWidth="1.5" opacity="0.12" />
      <path d="M100 40 A50 50 0 0 1 150 90" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.2" />
      <path d="M150 90 A50 50 0 0 1 100 140" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.15" />
      <circle cx="100" cy="90" r="30" stroke="currentColor" strokeWidth="1.5" opacity="0.08" />
      <line x1="200" y1="50" x2="200" y2="130" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.1" />
      <line x1="220" y1="60" x2="220" y2="130" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.12" />
      <line x1="240" y1="45" x2="240" y2="130" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.15" />
      <line x1="260" y1="70" x2="260" y2="130" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.1" />
      <circle cx="200" cy="50" r="3" fill="currentColor" opacity="0.15" />
      <circle cx="220" cy="60" r="3" fill="currentColor" opacity="0.18" />
      <circle cx="240" cy="45" r="3" fill="currentColor" opacity="0.2" />
      <circle cx="260" cy="70" r="3" fill="currentColor" opacity="0.15" />
    </svg>
  );
}

export function KnowledgeNetwork({ size = 300, className }: IllustrationProps) {
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 300 180" fill="none" className={className} aria-hidden="true">
      <circle cx="150" cy="90" r="20" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
      <circle cx="80" cy="60" r="12" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <circle cx="220" cy="60" r="12" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <circle cx="80" cy="130" r="12" stroke="currentColor" strokeWidth="1.5" opacity="0.12" />
      <circle cx="220" cy="130" r="12" stroke="currentColor" strokeWidth="1.5" opacity="0.12" />
      <line x1="132" y1="80" x2="92" y2="65" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.12" />
      <line x1="168" y1="80" x2="208" y2="65" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.12" />
      <line x1="132" y1="100" x2="92" y2="125" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.1" />
      <line x1="168" y1="100" x2="208" y2="125" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.1" />
      <line x1="92" y1="60" x2="92" y2="130" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeDasharray="3 3" opacity="0.08" />
      <line x1="208" y1="60" x2="208" y2="130" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeDasharray="3 3" opacity="0.08" />
    </svg>
  );
}

export function LargeTimer({ size = 300, className }: IllustrationProps) {
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 300 180" fill="none" className={className} aria-hidden="true">
      <circle cx="150" cy="100" r="60" stroke="currentColor" strokeWidth="2" opacity="0.15" />
      <circle cx="150" cy="100" r="55" stroke="currentColor" strokeWidth="1" opacity="0.08" />
      <line x1="150" y1="100" x2="150" y2="60" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.2" />
      <line x1="150" y1="100" x2="175" y2="100" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.15" />
      <circle cx="150" cy="100" r="4" fill="currentColor" opacity="0.2" />
      <path d="M138 42 L142 38 M158 42 L162 38" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.12" />
      <line x1="150" y1="36" x2="150" y2="42" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.12" />
      <path d="M210 55 L220 45 M230 55 L240 45" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.08" />
      <path d="M90 55 L80 45 M70 55 L60 45" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.08" />
    </svg>
  );
}

export function NotFoundIllustration({ size = 300, className }: IllustrationProps) {
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 300 180" fill="none" className={className} aria-hidden="true">
      <text x="150" y="110" textAnchor="middle" fontSize="64" fontWeight="700" fill="currentColor" opacity="0.08">404</text>
      <path d="M100 70 L130 40 M170 40 L200 70" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.15" />
      <circle cx="150" cy="130" r="8" stroke="currentColor" strokeWidth="1.5" opacity="0.12" />
      <path d="M145 130 L155 130" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.12" />
      <path d="M110 150 L130 145 M190 150 L170 145" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.08" />
    </svg>
  );
}
