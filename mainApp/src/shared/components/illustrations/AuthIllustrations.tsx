import type { IllustrationProps } from './types';

export function DeveloperAtDesk({ size = 300, className }: IllustrationProps) {
  return (
    <svg width={size} height={size * 0.75} viewBox="0 0 300 225" fill="none" className={className} aria-hidden="true">
      <rect x="60" y="80" width="180" height="110" rx="8" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <rect x="75" y="95" width="150" height="80" rx="4" stroke="currentColor" strokeWidth="1" opacity="0.1" />
      <line x1="90" y1="115" x2="140" y2="115" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.12" />
      <line x1="90" y1="128" x2="125" y2="128" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.08" />
      <line x1="90" y1="141" x2="135" y2="141" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.06" />
      <circle cx="195" cy="130" r="20" stroke="currentColor" strokeWidth="1.5" opacity="0.1" />
      <path d="M195 115 L195 130 L205 130" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.15" />
      <circle cx="150" cy="55" r="18" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <path d="M135 75 C135 65, 165 65, 165 75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.1" />
      <path d="M100 195 L110 190 M200 195 L190 190" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.08" />
    </svg>
  );
}

export function EmptyWorkspace({ size = 300, className }: IllustrationProps) {
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 300 180" fill="none" className={className} aria-hidden="true">
      <rect x="50" y="40" width="200" height="110" rx="12" stroke="currentColor" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.12" />
      <circle cx="150" cy="85" r="25" stroke="currentColor" strokeWidth="1.5" opacity="0.12" />
      <path d="M143 85 L157 85 M150 78 L150 92" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.18" />
      <path d="M110 135 L130 125 M190 135 L170 125" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.08" />
    </svg>
  );
}

export function OnboardingSteps({ size = 300, className }: IllustrationProps) {
  return (
    <svg width={size} height={size * 0.5} viewBox="0 0 300 150" fill="none" className={className} aria-hidden="true">
      <circle cx="60" cy="75" r="22" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
      <text x="60" y="80" textAnchor="middle" fontSize="16" fontWeight="600" fill="currentColor" opacity="0.2">1</text>
      <line x1="85" y1="75" x2="115" y2="75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 4" opacity="0.12" />
      <circle cx="150" cy="75" r="22" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <text x="150" y="80" textAnchor="middle" fontSize="16" fontWeight="600" fill="currentColor" opacity="0.15">2</text>
      <line x1="175" y1="75" x2="205" y2="75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="4 4" opacity="0.1" />
      <circle cx="240" cy="75" r="22" stroke="currentColor" strokeWidth="1.5" opacity="0.1" />
      <text x="240" y="80" textAnchor="middle" fontSize="16" fontWeight="600" fill="currentColor" opacity="0.1">3</text>
      <path d="M52 55 L60 45 L68 55" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.15" />
      <path d="M142 55 L150 45 L158 55" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.1" />
      <rect x="232" y="67" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1" opacity="0.1" />
      <path d="M236 75 L240 79 L248 71" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.12" />
    </svg>
  );
}
