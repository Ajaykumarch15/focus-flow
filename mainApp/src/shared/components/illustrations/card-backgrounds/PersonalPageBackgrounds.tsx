import type { CardBackgroundProps } from './types';

export function TodayHeroBackground({ className }: CardBackgroundProps) {
  return (
    <svg viewBox="0 0 400 200" fill="none" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="400" height="200" fill="currentColor" opacity="0.02" />
      {/* Sunrise over mountain */}
      <circle cx="320" cy="50" r="35" stroke="currentColor" strokeWidth="0.5" opacity="0.05" />
      <circle cx="320" cy="50" r="20" fill="currentColor" opacity="0.02" />
      {/* Sun rays */}
      {[...Array(12)].map((_, i) => {
        const angle = (i * 30) * (Math.PI / 180);
        return <line key={i} x1={320 + Math.cos(angle) * 38} y1={50 + Math.sin(angle) * 38} x2={320 + Math.cos(angle) * 50} y2={50 + Math.sin(angle) * 50} stroke="currentColor" strokeWidth="0.3" opacity="0.03" />;
      })}
      {/* Mountain range */}
      <path d="M0 160 L60 110 L100 135 L160 80 L220 120 L280 70 L340 100 L400 90 L400 200 L0 200Z" fill="currentColor" opacity="0.03" />
      <path d="M0 175 L80 140 L150 160 L220 125 L300 150 L400 130 L400 200 L0 200Z" fill="currentColor" opacity="0.02" />
      {/* Clock hands overlay */}
      <line x1="80" y1="80" x2="80" y2="50" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.04" />
      <line x1="80" y1="80" x2="100" y2="80" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" opacity="0.03" />
      <circle cx="80" cy="80" r="30" stroke="currentColor" strokeWidth="0.5" opacity="0.03" />
      <circle cx="80" cy="80" r="2" fill="currentColor" opacity="0.04" />
    </svg>
  );
}

export function TasksSidebarBackground({ className }: CardBackgroundProps) {
  return (
    <svg viewBox="0 0 200 200" fill="none" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="200" height="200" fill="currentColor" opacity="0.02" />
      {/* Mountain path with checkpoints */}
      <path d="M20 180 C50 160, 80 140, 100 130 S140 100, 180 60" stroke="currentColor" strokeWidth="0.8" strokeDasharray="4 4" opacity="0.04" />
      {/* Checkpoints */}
      <circle cx="50" cy="165" r="4" stroke="currentColor" strokeWidth="0.5" opacity="0.05" />
      <circle cx="100" cy="125" r="5" stroke="currentColor" strokeWidth="0.5" opacity="0.06" />
      <circle cx="150" cy="85" r="4" stroke="currentColor" strokeWidth="0.5" opacity="0.05" />
      <circle cx="180" cy="60" r="6" stroke="currentColor" strokeWidth="0.5" opacity="0.06" />
      {/* Completed checks */}
      <path d="M47 165 L50 168 L54 162" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" opacity="0.05" />
      <path d="M97 125 L100 128 L104 122" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" opacity="0.06" />
      {/* Mountain backdrop */}
      <path d="M0 190 L40 150 L80 170 L120 130 L160 155 L200 120 L200 200 L0 200Z" fill="currentColor" opacity="0.02" />
    </svg>
  );
}

export function AnalyticsHeroBackground({ className }: CardBackgroundProps) {
  return (
    <svg viewBox="0 0 400 160" fill="none" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="400" height="160" fill="currentColor" opacity="0.015" />
      {/* Data visualization growing into landscape */}
      <rect x="40" y="80" width="20" height="60" rx="2" fill="currentColor" opacity="0.03" />
      <ellipse cx="50" cy="75" rx="14" ry="8" fill="currentColor" opacity="0.02" />
      <rect x="80" y="50" width="20" height="90" rx="2" fill="currentColor" opacity="0.04" />
      <ellipse cx="90" cy="44" rx="16" ry="9" fill="currentColor" opacity="0.025" />
      <rect x="120" y="60" width="20" height="80" rx="2" fill="currentColor" opacity="0.035" />
      <ellipse cx="130" cy="54" rx="15" ry="8.5" fill="currentColor" opacity="0.02" />
      <rect x="160" y="35" width="20" height="105" rx="2" fill="currentColor" opacity="0.045" />
      <ellipse cx="170" cy="28" rx="18" ry="10" fill="currentColor" opacity="0.03" />
      {/* Trend line */}
      <path d="M50 75 L90 44 L130 54 L170 28" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.05" />
      {/* Mountain in background */}
      <path d="M250 140 L300 80 L350 120 L400 70 L400 160 L250 160Z" fill="currentColor" opacity="0.02" />
    </svg>
  );
}

export function JournalBackground({ className }: CardBackgroundProps) {
  return (
    <svg viewBox="0 0 200 160" fill="none" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="200" height="160" fill="currentColor" opacity="0.015" />
      {/* Notebook lines */}
      {[...Array(8)].map((_, i) => (
        <line key={i} x1="30" y1={30 + i * 16} x2="170" y2={30 + i * 16} stroke="currentColor" strokeWidth="0.3" opacity="0.03" />
      ))}
      {/* Margin line */}
      <line x1="50" y1="20" x2="50" y2="150" stroke="currentColor" strokeWidth="0.3" opacity="0.03" />
      {/* Pen */}
      <line x1="150" y1="30" x2="170" y2="10" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" opacity="0.04" />
      {/* Garden growing from notebook */}
      <path d="M100 25 L100 10" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <ellipse cx="93" cy="8" rx="7" ry="4" fill="currentColor" opacity="0.02" />
      <ellipse cx="107" cy="6" rx="8" ry="4.5" fill="currentColor" opacity="0.025" />
      <ellipse cx="100" cy="4" rx="6" ry="3.5" fill="currentColor" opacity="0.02" />
    </svg>
  );
}

export function RoadmapHeroBackground({ className }: CardBackgroundProps) {
  return (
    <svg viewBox="0 0 400 160" fill="none" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="400" height="160" fill="currentColor" opacity="0.015" />
      {/* Mountain range with milestone flags */}
      <path d="M0 130 L50 80 L100 110 L150 60 L200 90 L250 50 L300 80 L350 70 L400 100 L400 160 L0 160Z" fill="currentColor" opacity="0.025" />
      {/* Ridge path */}
      <path d="M50 80 L100 110 L150 60 L200 90 L250 50 L300 80 L350 70" stroke="currentColor" strokeWidth="0.8" strokeDasharray="4 4" opacity="0.04" />
      {/* Milestone flags */}
      <line x1="150" y1="60" x2="150" y2="42" stroke="currentColor" strokeWidth="0.5" opacity="0.05" />
      <path d="M150 42 L160 46 L150 50" fill="currentColor" opacity="0.03" />
      <line x1="250" y1="50" x2="250" y2="32" stroke="currentColor" strokeWidth="0.5" opacity="0.05" />
      <path d="M250 32 L260 36 L250 40" fill="currentColor" opacity="0.03" />
      <line x1="350" y1="70" x2="350" y2="52" stroke="currentColor" strokeWidth="0.5" opacity="0.05" />
      <path d="M350 52 L360 56 L350 60" fill="currentColor" opacity="0.03" />
      {/* Progress dots on path */}
      <circle cx="50" cy="80" r="3" fill="currentColor" opacity="0.04" />
      <circle cx="150" cy="60" r="3.5" fill="currentColor" opacity="0.05" />
      <circle cx="250" cy="50" r="3" fill="currentColor" opacity="0.04" />
      <circle cx="350" cy="70" r="3" fill="currentColor" opacity="0.04" />
    </svg>
  );
}

export function GoalsHeroBackground({ className }: CardBackgroundProps) {
  return (
    <svg viewBox="0 0 400 160" fill="none" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="400" height="160" fill="currentColor" opacity="0.015" />
      {/* Starry sky */}
      {[...Array(20)].map((_, i) => (
        <circle key={i} cx={20 + (i * 37) % 380} cy={10 + (i * 23) % 60} r={0.5 + (i % 3) * 0.5} fill="currentColor" opacity={0.02 + (i % 4) * 0.01} />
      ))}
      {/* Mountain peak */}
      <path d="M150 140 L200 50 L250 140Z" fill="currentColor" opacity="0.025" />
      <path d="M170 140 L200 70 L230 140Z" fill="currentColor" opacity="0.02" />
      {/* Ascending path to peak */}
      <path d="M100 140 C130 130, 160 100, 200 55" stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 4" opacity="0.04" />
      {/* Star at peak */}
      <path d="M200 35 L201.5 40 L207 40 L202.5 43 L204 48 L200 45 L196 48 L197.5 43 L193 40 L198.5 40Z" fill="currentColor" opacity="0.05" />
      {/* Glow around star */}
      <circle cx="200" cy="42" r="12" stroke="currentColor" strokeWidth="0.3" opacity="0.03" />
    </svg>
  );
}

export function ScheduleBackground({ className }: CardBackgroundProps) {
  return (
    <svg viewBox="0 0 200 120" fill="none" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="200" height="120" fill="currentColor" opacity="0.015" />
      {/* Calendar grid */}
      <rect x="20" y="20" width="160" height="80" rx="4" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <line x1="20" y1="40" x2="180" y2="40" stroke="currentColor" strokeWidth="0.5" opacity="0.03" />
      <line x1="60" y1="40" x2="60" y2="100" stroke="currentColor" strokeWidth="0.3" opacity="0.02" />
      <line x1="100" y1="40" x2="100" y2="100" stroke="currentColor" strokeWidth="0.3" opacity="0.02" />
      <line x1="140" y1="40" x2="140" y2="100" stroke="currentColor" strokeWidth="0.3" opacity="0.02" />
      <line x1="20" y1="60" x2="180" y2="60" stroke="currentColor" strokeWidth="0.3" opacity="0.02" />
      <line x1="20" y1="80" x2="180" y2="80" stroke="currentColor" strokeWidth="0.3" opacity="0.02" />
      {/* Horizon merging */}
      <path d="M0 110 C50 105, 150 105, 200 110" stroke="currentColor" strokeWidth="0.3" opacity="0.03" />
    </svg>
  );
}
