import type { CardBackgroundProps } from './types';

export function HubHeroBackground({ className }: CardBackgroundProps) {
  return (
    <svg viewBox="0 0 400 200" fill="none" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="400" height="200" fill="currentColor" opacity="0.02" />
      {/* Building blocks assembling into workspace */}
      <rect x="60" y="100" width="40" height="50" rx="3" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <rect x="110" y="80" width="40" height="70" rx="3" stroke="currentColor" strokeWidth="0.5" opacity="0.05" />
      <rect x="160" y="90" width="40" height="60" rx="3" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <rect x="210" y="70" width="40" height="80" rx="3" stroke="currentColor" strokeWidth="0.5" opacity="0.05" />
      <rect x="260" y="85" width="40" height="65" rx="3" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      {/* Connection lines */}
      <line x1="100" y1="115" x2="110" y2="105" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <line x1="150" y1="105" x2="160" y2="110" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <line x1="200" y1="110" x2="210" y2="95" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <line x1="250" y1="95" x2="260" y2="108" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      {/* Grid pattern */}
      {[...Array(10)].map((_, row) =>
        [...Array(20)].map((_, col) => (
          <circle key={`${row}-${col}`} cx={10 + col * 20} cy={10 + row * 20} r="0.8" fill="currentColor" opacity="0.025" />
        ))
      )}
      {/* Floating accent dots */}
      <circle cx="320" cy="40" r="8" stroke="currentColor" strokeWidth="0.3" opacity="0.03" />
      <circle cx="80" cy="40" r="6" stroke="currentColor" strokeWidth="0.3" opacity="0.03" />
    </svg>
  );
}

export function ProjectsHeroBackground({ className }: CardBackgroundProps) {
  return (
    <svg viewBox="0 0 400 160" fill="none" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="400" height="160" fill="currentColor" opacity="0.015" />
      {/* Desk scene */}
      <rect x="120" y="40" width="160" height="90" rx="4" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <rect x="130" y="50" width="140" height="70" rx="2" stroke="currentColor" strokeWidth="0.3" opacity="0.03" />
      {/* Monitor content */}
      <line x1="140" y1="65" x2="200" y2="65" stroke="currentColor" strokeWidth="0.3" opacity="0.025" />
      <line x1="140" y1="75" x2="180" y2="75" stroke="currentColor" strokeWidth="0.3" opacity="0.02" />
      <line x1="140" y1="85" x2="190" y2="85" stroke="currentColor" strokeWidth="0.3" opacity="0.02" />
      {/* Books */}
      <rect x="40" y="70" width="15" height="60" rx="1" fill="currentColor" opacity="0.025" />
      <rect x="58" y="80" width="12" height="50" rx="1" fill="currentColor" opacity="0.02" />
      <rect x="73" y="75" width="14" height="55" rx="1" fill="currentColor" opacity="0.022" />
      {/* Plant */}
      <line x1="340" y1="100" x2="340" y2="60" stroke="currentColor" strokeWidth="0.5" opacity="0.03" />
      <ellipse cx="332" cy="55" rx="10" ry="6" fill="currentColor" opacity="0.02" />
      <ellipse cx="348" cy="52" rx="12" ry="7" fill="currentColor" opacity="0.025" />
      <ellipse cx="340" cy="48" rx="9" ry="5.5" fill="currentColor" opacity="0.02" />
      {/* Window frame */}
      <rect x="310" y="30" width="60" height="70" rx="2" stroke="currentColor" strokeWidth="0.3" opacity="0.03" />
      <line x1="340" y1="30" x2="340" y2="100" stroke="currentColor" strokeWidth="0.3" opacity="0.02" />
      <line x1="310" y1="65" x2="370" y2="65" stroke="currentColor" strokeWidth="0.3" opacity="0.02" />
    </svg>
  );
}

export function PeopleBackground({ className }: CardBackgroundProps) {
  return (
    <svg viewBox="0 0 200 160" fill="none" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="200" height="160" fill="currentColor" opacity="0.015" />
      {/* Constellation of avatars */}
      <circle cx="60" cy="40" r="12" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <circle cx="140" cy="35" r="12" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <circle cx="100" cy="80" r="14" stroke="currentColor" strokeWidth="0.5" opacity="0.05" />
      <circle cx="40" cy="110" r="10" stroke="currentColor" strokeWidth="0.5" opacity="0.03" />
      <circle cx="160" cy="105" r="10" stroke="currentColor" strokeWidth="0.5" opacity="0.03" />
      <circle cx="100" cy="135" r="8" stroke="currentColor" strokeWidth="0.5" opacity="0.03" />
      {/* Network lines */}
      <line x1="70" y1="48" x2="90" y2="72" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.03" />
      <line x1="130" y1="42" x2="110" y2="72" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.03" />
      <line x1="52" y1="50" x2="48" y2="102" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.03" />
      <line x1="148" y1="45" x2="152" y2="97" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.03" />
      <line x1="100" y1="94" x2="100" y2="127" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.03" />
      {/* Person silhouettes in circles */}
      <circle cx="60" cy="37" r="3" fill="currentColor" opacity="0.03" />
      <path d="M52 48 C52 43, 68 43, 68 48" stroke="currentColor" strokeWidth="0.5" opacity="0.025" />
      <circle cx="100" cy="77" r="3.5" fill="currentColor" opacity="0.03" />
      <path d="M90 90 C90 84, 110 84, 110 90" stroke="currentColor" strokeWidth="0.5" opacity="0.025" />
    </svg>
  );
}

export function LeaderboardBackground({ className }: CardBackgroundProps) {
  return (
    <svg viewBox="0 0 200 160" fill="none" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="200" height="160" fill="currentColor" opacity="0.015" />
      {/* Podium with mountain peaks */}
      <rect x="30" y="100" width="45" height="50" rx="2" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <rect x="80" y="70" width="45" height="80" rx="2" stroke="currentColor" strokeWidth="0.5" opacity="0.05" />
      <rect x="130" y="90" width="45" height="60" rx="2" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      {/* Mountain peaks above podium */}
      <path d="M30 80 L52 50 L75 80Z" fill="currentColor" opacity="0.025" />
      <path d="M80 50 L102 20 L125 50Z" fill="currentColor" opacity="0.03" />
      <path d="M130 70 L152 40 L175 70Z" fill="currentColor" opacity="0.025" />
      {/* Trophy/star at top */}
      <path d="M102 15 L103.5 20 L109 20 L104.5 23 L106 28 L102 25 L98 28 L99.5 23 L95 20 L100.5 20Z" fill="currentColor" opacity="0.04" />
      {/* Numbers */}
      <text x="52" y="130" fontSize="10" fontFamily="monospace" fill="currentColor" opacity="0.04" textAnchor="middle">2</text>
      <text x="102" y="115" fontSize="12" fontFamily="monospace" fill="currentColor" opacity="0.05" textAnchor="middle">1</text>
      <text x="152" y="125" fontSize="10" fontFamily="monospace" fill="currentColor" opacity="0.04" textAnchor="middle">3</text>
    </svg>
  );
}

export function ActivityFeedBackground({ className }: CardBackgroundProps) {
  return (
    <svg viewBox="0 0 200 160" fill="none" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="200" height="160" fill="currentColor" opacity="0.015" />
      {/* Timeline */}
      <line x1="40" y1="20" x2="40" y2="140" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      {/* Timeline nodes */}
      <circle cx="40" cy="35" r="4" fill="currentColor" opacity="0.04" />
      <circle cx="40" cy="65" r="4" fill="currentColor" opacity="0.04" />
      <circle cx="40" cy="95" r="4" fill="currentColor" opacity="0.04" />
      <circle cx="40" cy="125" r="4" fill="currentColor" opacity="0.04" />
      {/* Activity lines extending from nodes */}
      <line x1="50" y1="35" x2="120" y2="35" stroke="currentColor" strokeWidth="0.3" opacity="0.03" />
      <line x1="50" y1="65" x2="140" y2="65" stroke="currentColor" strokeWidth="0.3" opacity="0.03" />
      <line x1="50" y1="95" x2="110" y2="95" stroke="currentColor" strokeWidth="0.3" opacity="0.03" />
      <line x1="50" y1="125" x2="130" y2="125" stroke="currentColor" strokeWidth="0.3" opacity="0.03" />
      {/* Activity blocks */}
      <rect x="60" y="30" width="50" height="10" rx="2" fill="currentColor" opacity="0.025" />
      <rect x="60" y="60" width="70" height="10" rx="2" fill="currentColor" opacity="0.025" />
      <rect x="60" y="90" width="40" height="10" rx="2" fill="currentColor" opacity="0.02" />
      <rect x="60" y="120" width="60" height="10" rx="2" fill="currentColor" opacity="0.02" />
    </svg>
  );
}
