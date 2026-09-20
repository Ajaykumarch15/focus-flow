import type { CardBackgroundProps } from './types';

export function FeatureBackgroundTimer({ className }: CardBackgroundProps) {
  return (
    <svg viewBox="0 0 200 160" fill="none" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="200" height="160" fill="currentColor" opacity="0.015" />
      {/* Mountain sunrise */}
      <path d="M0 130 L40 90 L70 110 L100 70 L140 100 L180 80 L200 95 L200 160 L0 160Z" fill="currentColor" opacity="0.03" />
      {/* Sun rays */}
      <circle cx="160" cy="40" r="20" stroke="currentColor" strokeWidth="0.5" opacity="0.06" />
      <circle cx="160" cy="40" r="12" fill="currentColor" opacity="0.03" />
      {[...Array(8)].map((_, i) => {
        const angle = (i * 45) * (Math.PI / 180);
        return <line key={i} x1={160 + Math.cos(angle) * 22} y1={40 + Math.sin(angle) * 22} x2={160 + Math.cos(angle) * 30} y2={40 + Math.sin(angle) * 30} stroke="currentColor" strokeWidth="0.5" opacity="0.04" />;
      })}
      {/* Focus rays from sun */}
      <path d="M160 40 L40 120" stroke="currentColor" strokeWidth="0.3" strokeDasharray="2 4" opacity="0.03" />
      <path d="M160 40 L100 130" stroke="currentColor" strokeWidth="0.3" strokeDasharray="2 4" opacity="0.03" />
    </svg>
  );
}

export function FeatureBackgroundAnalytics({ className }: CardBackgroundProps) {
  return (
    <svg viewBox="0 0 200 160" fill="none" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="200" height="160" fill="currentColor" opacity="0.015" />
      {/* Bar chart growing into tree */}
      <rect x="20" y="100" width="12" height="50" rx="2" fill="currentColor" opacity="0.04" />
      <ellipse cx="26" cy="95" rx="10" ry="6" fill="currentColor" opacity="0.025" />
      <rect x="45" y="80" width="12" height="70" rx="2" fill="currentColor" opacity="0.05" />
      <ellipse cx="51" cy="74" rx="12" ry="7" fill="currentColor" opacity="0.03" />
      <rect x="70" y="60" width="12" height="90" rx="2" fill="currentColor" opacity="0.06" />
      <ellipse cx="76" cy="53" rx="14" ry="8" fill="currentColor" opacity="0.035" />
      <rect x="95" y="45" width="12" height="105" rx="2" fill="currentColor" opacity="0.07" />
      <ellipse cx="101" cy="38" rx="16" ry="9" fill="currentColor" opacity="0.04" />
      {/* Trend line */}
      <path d="M26 95 L51 74 L76 53 L101 38" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.06" />
      {/* Ground */}
      <line x1="10" y1="150" x2="120" y2="150" stroke="currentColor" strokeWidth="0.5" opacity="0.03" />
    </svg>
  );
}

export function FeatureBackgroundJournal({ className }: CardBackgroundProps) {
  return (
    <svg viewBox="0 0 200 160" fill="none" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="200" height="160" fill="currentColor" opacity="0.015" />
      {/* Open book */}
      <path d="M100 40 L100 140" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <path d="M100 40 C80 35, 40 30, 20 40 L20 140 C40 130, 80 135, 100 140" stroke="currentColor" strokeWidth="0.8" opacity="0.05" />
      <path d="M100 40 C120 35, 160 30, 180 40 L180 140 C160 130, 120 135, 100 140" stroke="currentColor" strokeWidth="0.8" opacity="0.05" />
      {/* Lines on pages */}
      <line x1="35" y1="60" x2="90" y2="60" stroke="currentColor" strokeWidth="0.3" opacity="0.03" />
      <line x1="35" y1="75" x2="85" y2="75" stroke="currentColor" strokeWidth="0.3" opacity="0.03" />
      <line x1="35" y1="90" x2="88" y2="90" stroke="currentColor" strokeWidth="0.3" opacity="0.03" />
      <line x1="110" y1="60" x2="165" y2="60" stroke="currentColor" strokeWidth="0.3" opacity="0.03" />
      <line x1="110" y1="75" x2="160" y2="75" stroke="currentColor" strokeWidth="0.3" opacity="0.03" />
      {/* Garden growing from book */}
      <path d="M100 35 L100 20" stroke="currentColor" strokeWidth="0.5" opacity="0.05" />
      <ellipse cx="92" cy="18" rx="8" ry="5" fill="currentColor" opacity="0.025" />
      <ellipse cx="108" cy="15" rx="9" ry="5.5" fill="currentColor" opacity="0.03" />
      <ellipse cx="100" cy="12" rx="7" ry="4.5" fill="currentColor" opacity="0.025" />
    </svg>
  );
}

export function FeatureBackgroundFocus({ className }: CardBackgroundProps) {
  return (
    <svg viewBox="0 0 200 160" fill="none" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="200" height="160" fill="currentColor" opacity="0.015" />
      {/* Concentric circles */}
      <circle cx="100" cy="80" r="60" stroke="currentColor" strokeWidth="0.5" opacity="0.03" />
      <circle cx="100" cy="80" r="45" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <circle cx="100" cy="80" r="30" stroke="currentColor" strokeWidth="0.5" opacity="0.05" />
      <circle cx="100" cy="80" r="15" stroke="currentColor" strokeWidth="0.5" opacity="0.06" />
      <circle cx="100" cy="80" r="5" fill="currentColor" opacity="0.06" />
      {/* Mountain reflection in water */}
      <path d="M40 130 L70 100 L85 115 L100 85 L115 110 L130 95 L160 130Z" fill="currentColor" opacity="0.03" />
      <path d="M40 130 L160 130" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      {/* Reflected mountains (upside down, fainter) */}
      <path d="M40 130 L70 160 M100 130 L100 160 M160 130 L160 160" stroke="currentColor" strokeWidth="0.2" opacity="0.02" />
    </svg>
  );
}

export function FeatureBackgroundSubtasks({ className }: CardBackgroundProps) {
  return (
    <svg viewBox="0 0 200 160" fill="none" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="200" height="160" fill="currentColor" opacity="0.015" />
      {/* Nested blocks / building */}
      <rect x="30" y="50" width="140" height="90" rx="4" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <rect x="45" y="65" width="55" height="30" rx="3" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <rect x="110" y="65" width="50" height="30" rx="3" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <rect x="45" y="105" width="40" height="25" rx="3" stroke="currentColor" strokeWidth="0.5" opacity="0.03" />
      <rect x="95" y="105" width="65" height="25" rx="3" stroke="currentColor" strokeWidth="0.5" opacity="0.03" />
      {/* Checkmarks in completed blocks */}
      <path d="M52 80 L56 84 L64 76" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.05" />
      <path d="M117 80 L121 84 L129 76" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.05" />
      {/* Scaffolding */}
      <line x1="20" y1="50" x2="20" y2="145" stroke="currentColor" strokeWidth="0.3" opacity="0.03" />
      <line x1="180" y1="50" x2="180" y2="145" stroke="currentColor" strokeWidth="0.3" opacity="0.03" />
      <line x1="20" y1="95" x2="180" y2="95" stroke="currentColor" strokeWidth="0.3" strokeDasharray="2 3" opacity="0.02" />
    </svg>
  );
}

export function FeatureBackgroundGoals({ className }: CardBackgroundProps) {
  return (
    <svg viewBox="0 0 200 160" fill="none" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="200" height="160" fill="currentColor" opacity="0.015" />
      {/* Mountain path to star */}
      <path d="M20 140 C50 130, 80 100, 100 90 S140 60, 180 30" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" opacity="0.05" />
      <path d="M20 140 C50 135, 80 110, 100 100 S140 75, 180 40" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 4" opacity="0.03" />
      {/* Target/bullseye at peak */}
      <circle cx="175" cy="30" r="18" stroke="currentColor" strokeWidth="0.5" opacity="0.05" />
      <circle cx="175" cy="30" r="12" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <circle cx="175" cy="30" r="6" stroke="currentColor" strokeWidth="0.5" opacity="0.05" />
      <circle cx="175" cy="30" r="2" fill="currentColor" opacity="0.06" />
      {/* Star */}
      <path d="M175 8 L176.5 13 L182 13 L177.5 16 L179 21 L175 18 L171 21 L172.5 16 L168 13 L173.5 13Z" fill="currentColor" opacity="0.04" />
      {/* Waypoints along path */}
      <circle cx="60" cy="130" r="2" fill="currentColor" opacity="0.04" />
      <circle cx="100" cy="95" r="2.5" fill="currentColor" opacity="0.05" />
      <circle cx="140" cy="65" r="2" fill="currentColor" opacity="0.04" />
    </svg>
  );
}
