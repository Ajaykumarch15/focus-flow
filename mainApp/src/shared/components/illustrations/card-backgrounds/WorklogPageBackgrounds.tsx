import type { CardBackgroundProps } from './types';

export function TodayWorklogHero({ className }: CardBackgroundProps) {
  return (
    <svg viewBox="0 0 400 200" fill="none" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="400" height="200" fill="currentColor" opacity="0.02" />
      {/* Concentric focus rings over mountain lake */}
      <circle cx="200" cy="100" r="70" stroke="currentColor" strokeWidth="0.5" opacity="0.03" />
      <circle cx="200" cy="100" r="55" stroke="currentColor" strokeWidth="0.5" opacity="0.035" />
      <circle cx="200" cy="100" r="40" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <circle cx="200" cy="100" r="25" stroke="currentColor" strokeWidth="0.5" opacity="0.045" />
      <circle cx="200" cy="100" r="10" fill="currentColor" opacity="0.04" />
      {/* Mountain reflection */}
      <path d="M80 130 L140 80 L180 110 L200 70 L220 105 L260 75 L320 130Z" fill="currentColor" opacity="0.025" />
      <line x1="80" y1="130" x2="320" y2="130" stroke="currentColor" strokeWidth="0.5" opacity="0.03" />
      {/* Reflected mountains */}
      <path d="M80 130 L140 170 M200 130 L200 170 M320 130 L320 170" stroke="currentColor" strokeWidth="0.2" opacity="0.015" />
    </svg>
  );
}

export function HabitsBackground({ className }: CardBackgroundProps) {
  return (
    <svg viewBox="0 0 400 200" fill="none" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="400" height="200" fill="currentColor" opacity="0.015" />
      {/* Circular progress rings growing into tree rings */}
      <circle cx="200" cy="100" r="70" stroke="currentColor" strokeWidth="0.5" opacity="0.025" />
      <circle cx="200" cy="100" r="70" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="140 300" opacity="0.04" />
      <circle cx="200" cy="100" r="55" stroke="currentColor" strokeWidth="0.5" opacity="0.025" />
      <circle cx="200" cy="100" r="55" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="110 235" opacity="0.035" />
      <circle cx="200" cy="100" r="40" stroke="currentColor" strokeWidth="0.5" opacity="0.025" />
      <circle cx="200" cy="100" r="40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="80 170" opacity="0.03" />
      <circle cx="200" cy="100" r="25" stroke="currentColor" strokeWidth="0.5" opacity="0.03" />
      <circle cx="200" cy="100" r="5" fill="currentColor" opacity="0.04" />
      {/* Flame/streak indicator */}
      <path d="M200 75 C205 85, 195 90, 200 80 C205 90, 195 95, 200 85" stroke="currentColor" strokeWidth="0.8" opacity="0.04" />
    </svg>
  );
}

export function InsightsBackground({ className }: CardBackgroundProps) {
  return (
    <svg viewBox="0 0 200 160" fill="none" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="200" height="160" fill="currentColor" opacity="0.015" />
      {/* Lightbulb */}
      <path d="M100 30 C75 30, 60 50, 60 70 C60 85, 75 95, 80 105 L120 105 C125 95, 140 85, 140 70 C140 50, 125 30, 100 30Z" stroke="currentColor" strokeWidth="0.8" opacity="0.05" />
      <line x1="85" y1="112" x2="115" y2="112" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <line x1="88" y1="119" x2="112" y2="119" stroke="currentColor" strokeWidth="0.5" opacity="0.03" />
      {/* Garden growing inside */}
      <path d="M100 100 L100 60" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <ellipse cx="90" cy="58" rx="8" ry="5" fill="currentColor" opacity="0.02" />
      <ellipse cx="110" cy="55" rx="9" ry="5.5" fill="currentColor" opacity="0.025" />
      <ellipse cx="100" cy="52" rx="7" ry="4.5" fill="currentColor" opacity="0.02" />
      {/* Light rays */}
      {[...Array(8)].map((_, i) => {
        const angle = (i * 45) * (Math.PI / 180);
        return <line key={i} x1={100 + Math.cos(angle) * 35} y1={70 + Math.sin(angle) * 35} x2={100 + Math.cos(angle) * 45} y2={70 + Math.sin(angle) * 45} stroke="currentColor" strokeWidth="0.3" opacity="0.03" />;
      })}
    </svg>
  );
}

export function KnowledgeBackground({ className }: CardBackgroundProps) {
  return (
    <svg viewBox="0 0 200 160" fill="none" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="200" height="160" fill="currentColor" opacity="0.015" />
      {/* Connected nodes with book elements */}
      <circle cx="60" cy="50" r="15" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <circle cx="140" cy="50" r="15" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <circle cx="100" cy="100" r="15" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <circle cx="40" cy="120" r="12" stroke="currentColor" strokeWidth="0.5" opacity="0.03" />
      <circle cx="160" cy="120" r="12" stroke="currentColor" strokeWidth="0.5" opacity="0.03" />
      {/* Connection lines */}
      <line x1="73" y1="55" x2="87" y2="92" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.03" />
      <line x1="127" y1="55" x2="113" y2="92" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.03" />
      <line x1="60" y1="65" x2="48" y2="112" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.03" />
      <line x1="140" y1="65" x2="152" y2="112" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.03" />
      {/* Book icons in nodes */}
      <rect x="52" y="44" width="16" height="12" rx="1" stroke="currentColor" strokeWidth="0.5" opacity="0.03" />
      <rect x="132" y="44" width="16" height="12" rx="1" stroke="currentColor" strokeWidth="0.5" opacity="0.03" />
      <rect x="92" y="94" width="16" height="12" rx="1" stroke="currentColor" strokeWidth="0.5" opacity="0.03" />
    </svg>
  );
}

export function ReportsHeroBackground({ className }: CardBackgroundProps) {
  return (
    <svg viewBox="0 0 400 160" fill="none" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="400" height="160" fill="currentColor" opacity="0.015" />
      {/* Chart bars transforming into mountain range */}
      <rect x="40" y="80" width="30" height="60" rx="2" fill="currentColor" opacity="0.03" />
      <rect x="85" y="50" width="30" height="90" rx="2" fill="currentColor" opacity="0.035" />
      <rect x="130" y="65" width="30" height="75" rx="2" fill="currentColor" opacity="0.03" />
      <rect x="175" y="35" width="30" height="105" rx="2" fill="currentColor" opacity="0.04" />
      <rect x="220" y="55" width="30" height="85" rx="2" fill="currentColor" opacity="0.035" />
      {/* Mountain silhouette overlay */}
      <path d="M250 130 L290 80 L320 100 L350 70 L380 90 L400 75 L400 140 L250 140Z" fill="currentColor" opacity="0.025" />
      {/* Trend line connecting bar tops */}
      <path d="M55 80 L100 50 L145 65 L190 35 L235 55" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.04" />
    </svg>
  );
}
