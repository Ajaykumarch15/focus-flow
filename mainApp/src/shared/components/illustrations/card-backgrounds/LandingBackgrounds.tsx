import type { CardBackgroundProps } from './types';

export function LandingHeroBackground({ className }: CardBackgroundProps) {
  return (
    <svg viewBox="0 0 400 200" fill="none" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="400" height="200" fill="currentColor" opacity="0.015" />
      {/* Mountain range with sunrise */}
      <circle cx="320" cy="50" r="30" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <circle cx="320" cy="50" r="18" fill="currentColor" opacity="0.02" />
      {[...Array(10)].map((_, i) => {
        const angle = (i * 36) * (Math.PI / 180);
        return <line key={i} x1={320 + Math.cos(angle) * 33} y1={50 + Math.sin(angle) * 33} x2={320 + Math.cos(angle) * 42} y2={50 + Math.sin(angle) * 42} stroke="currentColor" strokeWidth="0.3" opacity="0.03" />;
      })}
      {/* Mountain range */}
      <path d="M0 150 L40 100 L80 125 L140 70 L200 100 L260 60 L320 90 L380 80 L400 95 L400 200 L0 200Z" fill="currentColor" opacity="0.025" />
      <path d="M0 170 C60 155, 140 165, 200 150 C260 135, 340 145, 400 140 L400 200 L0 200Z" fill="currentColor" opacity="0.02" />
      {/* Building blocks assembling */}
      <rect x="50" y="130" width="20" height="30" rx="2" stroke="currentColor" strokeWidth="0.3" opacity="0.03" />
      <rect x="75" y="115" width="20" height="45" rx="2" stroke="currentColor" strokeWidth="0.3" opacity="0.03" />
      <rect x="100" y="120" width="20" height="40" rx="2" stroke="currentColor" strokeWidth="0.3" opacity="0.03" />
      {/* Grid pattern */}
      {[...Array(10)].map((_, row) =>
        [...Array(20)].map((_, col) => (
          <circle key={`${row}-${col}`} cx={10 + col * 20} cy={10 + row * 20} r="0.8" fill="currentColor" opacity="0.02" />
        ))
      )}
    </svg>
  );
}

export function LandingFeatureBackground({ className }: CardBackgroundProps) {
  return (
    <svg viewBox="0 0 200 160" fill="none" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="200" height="160" fill="currentColor" opacity="0.015" />
      {/* Timer merging into growth */}
      <circle cx="60" cy="80" r="25" stroke="currentColor" strokeWidth="0.8" opacity="0.04" />
      <line x1="60" y1="80" x2="60" y2="62" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.05" />
      <line x1="60" y1="80" x2="75" y2="80" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" opacity="0.04" />
      <circle cx="60" cy="80" r="2" fill="currentColor" opacity="0.04" />
      {/* Growing path */}
      <path d="M85 80 C100 75, 120 60, 140 55" stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.04" />
      {/* Mountain/growth element */}
      <path d="M120 130 L150 70 L180 130Z" fill="currentColor" opacity="0.025" />
      <path d="M135 130 L150 90 L165 130Z" fill="currentColor" opacity="0.02" />
      {/* Sun at peak */}
      <circle cx="150" cy="65" r="8" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      {/* Dot trail */}
      <circle cx="140" cy="55" r="2" fill="currentColor" opacity="0.04" />
      <circle cx="150" cy="65" r="2.5" fill="currentColor" opacity="0.045" />
    </svg>
  );
}

export function LandingSocialProofBackground({ className }: CardBackgroundProps) {
  return (
    <svg viewBox="0 0 400 120" fill="none" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="400" height="120" fill="currentColor" opacity="0.015" />
      {/* Constellation of testimonials */}
      <circle cx="50" cy="30" r="6" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <circle cx="120" cy="50" r="8" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <circle cx="200" cy="25" r="7" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <circle cx="280" cy="45" r="6" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <circle cx="350" cy="35" r="7" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      {/* Connection lines */}
      <line x1="55" y1="35" x2="113" y2="45" stroke="currentColor" strokeWidth="0.3" strokeDasharray="3 3" opacity="0.025" />
      <line x1="126" y1="45" x2="193" y2="30" stroke="currentColor" strokeWidth="0.3" strokeDasharray="3 3" opacity="0.025" />
      <line x1="206" y1="30" x2="274" y2="42" stroke="currentColor" strokeWidth="0.3" strokeDasharray="3 3" opacity="0.025" />
      <line x1="285" y1="40" x2="343" y2="38" stroke="currentColor" strokeWidth="0.3" strokeDasharray="3 3" opacity="0.025" />
      {/* Mountain silhouette */}
      <path d="M0 110 C80 90, 160 100, 240 85 C320 70, 380 90, 400 80 L400 120 L0 120Z" fill="currentColor" opacity="0.015" />
    </svg>
  );
}
