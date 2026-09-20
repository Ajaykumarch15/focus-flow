import type { CardBackgroundProps } from './types';

export function ValueBackgroundSession({ className }: CardBackgroundProps) {
  return (
    <svg viewBox="0 0 200 120" fill="none" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="200" height="120" fill="currentColor" opacity="0.015" />
      {/* Timer merging into logbook */}
      <circle cx="50" cy="60" r="22" stroke="currentColor" strokeWidth="0.8" opacity="0.05" />
      <line x1="50" y1="60" x2="50" y2="44" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.06" />
      <line x1="50" y1="60" x2="62" y2="60" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" opacity="0.05" />
      <circle cx="50" cy="60" r="2" fill="currentColor" opacity="0.05" />
      {/* Connecting path */}
      <path d="M74 60 C90 55, 100 50, 110 55" stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.05" />
      {/* Logbook */}
      <rect x="110" y="40" width="60" height="45" rx="4" stroke="currentColor" strokeWidth="0.8" opacity="0.05" />
      <line x1="118" y1="55" x2="155" y2="55" stroke="currentColor" strokeWidth="0.5" opacity="0.03" />
      <line x1="118" y1="65" x2="145" y2="65" stroke="currentColor" strokeWidth="0.5" opacity="0.03" />
      <line x1="118" y1="75" x2="150" y2="75" stroke="currentColor" strokeWidth="0.5" opacity="0.03" />
    </svg>
  );
}

export function ValueBackgroundReports({ className }: CardBackgroundProps) {
  return (
    <svg viewBox="0 0 200 120" fill="none" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="200" height="120" fill="currentColor" opacity="0.015" />
      {/* Document emerging */}
      <rect x="60" y="30" width="80" height="70" rx="4" stroke="currentColor" strokeWidth="0.8" opacity="0.05" />
      <line x1="70" y1="48" x2="130" y2="48" stroke="currentColor" strokeWidth="0.5" opacity="0.03" />
      <line x1="70" y1="58" x2="120" y2="58" stroke="currentColor" strokeWidth="0.5" opacity="0.03" />
      <line x1="70" y1="68" x2="125" y2="68" stroke="currentColor" strokeWidth="0.5" opacity="0.03" />
      {/* Mini chart in document */}
      <path d="M75 85 L85 78 L95 82 L110 72 L120 76" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" opacity="0.05" />
      {/* Data visualization rising */}
      <rect x="20" y="70" width="8" height="30" rx="1" fill="currentColor" opacity="0.03" />
      <rect x="35" y="55" width="8" height="45" rx="1" fill="currentColor" opacity="0.035" />
      <rect x="160" y="60" width="8" height="40" rx="1" fill="currentColor" opacity="0.03" />
      <rect x="175" y="50" width="8" height="50" rx="1" fill="currentColor" opacity="0.035" />
    </svg>
  );
}

export function ValueBackgroundProof({ className }: CardBackgroundProps) {
  return (
    <svg viewBox="0 0 200 120" fill="none" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="200" height="120" fill="currentColor" opacity="0.015" />
      {/* Shield */}
      <path d="M100 20 L130 35 L130 65 C130 85, 100 105, 100 105 C100 105, 70 85, 70 65 L70 35Z" stroke="currentColor" strokeWidth="0.8" opacity="0.05" />
      <path d="M100 30 L122 42 L122 62 C122 78, 100 95, 100 95 C100 95, 78 78, 78 62 L78 42Z" stroke="currentColor" strokeWidth="0.5" opacity="0.03" />
      {/* Checkmark in shield */}
      <path d="M90 60 L97 67 L113 50" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.06" />
      {/* Mountain peak with flag */}
      <path d="M150 100 L170 70 L190 100Z" fill="currentColor" opacity="0.025" />
      <line x1="170" y1="70" x2="170" y2="55" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <path d="M170 55 L180 58 L170 61" fill="currentColor" opacity="0.03" />
    </svg>
  );
}
