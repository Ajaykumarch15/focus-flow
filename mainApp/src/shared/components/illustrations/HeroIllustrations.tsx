import type { IllustrationProps } from './types';

export function GoalPath({ size = 300, className }: IllustrationProps) {
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 300 180" fill="none" className={className} aria-hidden="true">
      <path d="M30 160 C80 140, 100 100, 150 90 C200 80, 220 50, 270 30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.2" />
      <path d="M30 160 C80 145, 100 110, 150 100 C200 90, 220 60, 270 40" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeDasharray="4 4" opacity="0.1" />
      <circle cx="270" cy="30" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <path d="M267 30 L270 25 L273 30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.25" />
      <circle cx="30" cy="160" r="5" fill="currentColor" opacity="0.15" />
      <circle cx="150" cy="90" r="4" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
    </svg>
  );
}

export function ReportEmerging({ size = 300, className }: IllustrationProps) {
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 300 180" fill="none" className={className} aria-hidden="true">
      <rect x="80" y="30" width="80" height="110" rx="8" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
      <line x1="95" y1="55" x2="145" y2="55" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.15" />
      <line x1="95" y1="70" x2="130" y2="70" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.12" />
      <line x1="95" y1="85" x2="140" y2="85" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.1" />
      <rect x="95" y="100" width="50" height="25" rx="4" stroke="currentColor" strokeWidth="1" opacity="0.12" />
      <path d="M105 112 L115 105 L125 115 L135 108" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.15" />
      <path d="M190 60 L210 40 M210 60 L190 40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.15" />
      <circle cx="200" cy="140" r="12" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <path d="M196 140 L200 136 L204 140" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.2" />
    </svg>
  );
}
