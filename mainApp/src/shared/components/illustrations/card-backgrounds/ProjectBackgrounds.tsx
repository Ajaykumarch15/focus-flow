import type { CardBackgroundProps } from './types';

export function ProjectBackgroundPurple({ className }: CardBackgroundProps) {
  return (
    <svg viewBox="0 0 300 420" fill="none" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="300" height="420" fill="currentColor" opacity="0.02" />
      {/* Mountain peaks */}
      <path d="M0 350 L60 280 L100 310 L160 240 L200 290 L260 220 L300 270 L300 420 L0 420Z" fill="currentColor" opacity="0.03" />
      {/* Circuit overlay */}
      <path d="M40 100 L80 100 L80 140 L120 140" stroke="currentColor" strokeWidth="0.5" opacity="0.06" />
      <path d="M180 80 L220 80 L220 120 L260 120" stroke="currentColor" strokeWidth="0.5" opacity="0.06" />
      <circle cx="120" cy="140" r="3" fill="currentColor" opacity="0.06" />
      <circle cx="260" cy="120" r="3" fill="currentColor" opacity="0.06" />
      {/* Code symbols */}
      <text x="30" y="60" fontSize="14" fontFamily="monospace" fill="currentColor" opacity="0.04">{'</>'}</text>
      <text x="240" y="180" fontSize="14" fontFamily="monospace" fill="currentColor" opacity="0.04">{'{}'}</text>
      {/* Dot grid */}
      {[...Array(14)].map((_, row) =>
        [...Array(10)].map((_, col) => (
          <circle key={`${row}-${col}`} cx={15 + col * 30} cy={15 + row * 30} r="1" fill="currentColor" opacity="0.04" />
        ))
      )}
      {/* Floating accent */}
      <circle cx="250" cy="60" r="20" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <circle cx="250" cy="60" r="10" fill="currentColor" opacity="0.03" />
    </svg>
  );
}

export function ProjectBackgroundGreen({ className }: CardBackgroundProps) {
  return (
    <svg viewBox="0 0 300 420" fill="none" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="300" height="420" fill="currentColor" opacity="0.02" />
      {/* Rolling hills */}
      <path d="M0 320 C60 290, 120 340, 180 300 C240 260, 280 310, 300 290 L300 420 L0 420Z" fill="currentColor" opacity="0.03" />
      <path d="M0 360 C80 340, 160 370, 240 350 C280 340, 300 355, 300 350 L300 420 L0 420Z" fill="currentColor" opacity="0.025" />
      {/* Growing plants / progress bars */}
      <rect x="40" y="280" width="4" height="40" rx="2" fill="currentColor" opacity="0.05" />
      <ellipse cx="42" cy="275" rx="8" ry="5" fill="currentColor" opacity="0.03" />
      <rect x="80" y="250" width="4" height="70" rx="2" fill="currentColor" opacity="0.06" />
      <ellipse cx="82" cy="245" rx="10" ry="6" fill="currentColor" opacity="0.035" />
      <rect x="120" y="260" width="4" height="60" rx="2" fill="currentColor" opacity="0.05" />
      <ellipse cx="122" cy="255" rx="9" ry="5" fill="currentColor" opacity="0.03" />
      <rect x="160" y="230" width="4" height="90" rx="2" fill="currentColor" opacity="0.06" />
      <ellipse cx="162" cy="224" rx="12" ry="7" fill="currentColor" opacity="0.04" />
      {/* Sun */}
      <circle cx="260" cy="60" r="20" stroke="currentColor" strokeWidth="0.5" opacity="0.05" />
      {/* Dot grid */}
      {[...Array(14)].map((_, row) =>
        [...Array(10)].map((_, col) => (
          <circle key={`${row}-${col}`} cx={15 + col * 30} cy={15 + row * 30} r="1" fill="currentColor" opacity="0.03" />
        ))
      )}
    </svg>
  );
}

export function ProjectBackgroundPink({ className }: CardBackgroundProps) {
  return (
    <svg viewBox="0 0 300 420" fill="none" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="300" height="420" fill="currentColor" opacity="0.02" />
      {/* Cherry blossom branches */}
      <path d="M0 200 C50 180, 100 220, 150 190 S250 210, 300 180" stroke="currentColor" strokeWidth="0.8" opacity="0.05" />
      <path d="M150 190 C160 170, 180 160, 200 170" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <path d="M150 190 C140 175, 130 165, 120 175" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      {/* Blossoms (data points) */}
      <circle cx="100" cy="210" r="4" fill="currentColor" opacity="0.04" />
      <circle cx="150" cy="188" r="5" fill="currentColor" opacity="0.05" />
      <circle cx="200" cy="175" r="4" fill="currentColor" opacity="0.04" />
      <circle cx="250" cy="190" r="3" fill="currentColor" opacity="0.03" />
      <circle cx="160" cy="168" r="3" fill="currentColor" opacity="0.03" />
      <circle cx="130" cy="172" r="3" fill="currentColor" opacity="0.03" />
      {/* Falling petals */}
      <ellipse cx="80" cy="120" rx="3" ry="2" fill="currentColor" opacity="0.03" transform="rotate(30 80 120)" />
      <ellipse cx="200" cy="100" rx="3" ry="2" fill="currentColor" opacity="0.03" transform="rotate(-20 200 100)" />
      <ellipse cx="280" cy="140" rx="2.5" ry="1.5" fill="currentColor" opacity="0.03" transform="rotate(45 280 140)" />
      {/* Ground */}
      <path d="M0 350 C100 340, 200 345, 300 340 L300 420 L0 420Z" fill="currentColor" opacity="0.02" />
    </svg>
  );
}

export function ProjectBackgroundBlue({ className }: CardBackgroundProps) {
  return (
    <svg viewBox="0 0 300 420" fill="none" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="300" height="420" fill="currentColor" opacity="0.02" />
      {/* Cloud layers */}
      <ellipse cx="80" cy="80" rx="50" ry="20" fill="currentColor" opacity="0.025" />
      <ellipse cx="220" cy="100" rx="60" ry="22" fill="currentColor" opacity="0.02" />
      <ellipse cx="150" cy="60" rx="40" ry="15" fill="currentColor" opacity="0.02" />
      {/* Floating IDE windows */}
      <rect x="30" y="140" width="80" height="50" rx="4" stroke="currentColor" strokeWidth="0.5" opacity="0.05" />
      <line x1="30" y1="152" x2="110" y2="152" stroke="currentColor" strokeWidth="0.5" opacity="0.03" />
      <line x1="40" y1="162" x2="80" y2="162" stroke="currentColor" strokeWidth="0.5" opacity="0.03" />
      <line x1="40" y1="170" x2="70" y2="170" stroke="currentColor" strokeWidth="0.5" opacity="0.03" />
      <rect x="180" y="200" width="90" height="55" rx="4" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <line x1="180" y1="212" x2="270" y2="212" stroke="currentColor" strokeWidth="0.5" opacity="0.03" />
      <line x1="190" y1="222" x2="240" y2="222" stroke="currentColor" strokeWidth="0.5" opacity="0.03" />
      <line x1="190" y1="230" x2="230" y2="230" stroke="currentColor" strokeWidth="0.5" opacity="0.03" />
      {/* Connection lines */}
      <path d="M110 165 C140 170, 160 195, 180 200" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.04" />
    </svg>
  );
}

export function ProjectBackgroundOrange({ className }: CardBackgroundProps) {
  return (
    <svg viewBox="0 0 300 420" fill="none" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="300" height="420" fill="currentColor" opacity="0.02" />
      {/* Sunset horizon */}
      <circle cx="150" cy="300" r="40" fill="currentColor" opacity="0.02" />
      <path d="M0 300 L300 300" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      {/* Kanban columns */}
      <rect x="20" y="60" width="70" height="180" rx="4" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <rect x="110" y="60" width="70" height="180" rx="4" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <rect x="200" y="60" width="70" height="180" rx="4" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      {/* Cards in columns */}
      <rect x="28" y="75" width="54" height="30" rx="3" fill="currentColor" opacity="0.03" />
      <rect x="28" y="115" width="54" height="25" rx="3" fill="currentColor" opacity="0.025" />
      <rect x="118" y="75" width="54" height="35" rx="3" fill="currentColor" opacity="0.03" />
      <rect x="118" y="120" width="54" height="25" rx="3" fill="currentColor" opacity="0.025" />
      <rect x="208" y="75" width="54" height="28" rx="3" fill="currentColor" opacity="0.03" />
      {/* Arrows between columns */}
      <path d="M92 100 L108 100" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <path d="M92 100 L98 96 M92 100 L98 104" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <path d="M182 100 L198 100" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <path d="M182 100 L188 96 M182 100 L188 104" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
    </svg>
  );
}

export function ProjectBackgroundGray({ className }: CardBackgroundProps) {
  return (
    <svg viewBox="0 0 300 420" fill="none" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="300" height="420" fill="currentColor" opacity="0.02" />
      {/* Blueprint grid */}
      {[...Array(21)].map((_, row) => (
        <line key={`h${row}`} x1="0" y1={row * 20} x2="300" y2={row * 20} stroke="currentColor" strokeWidth="0.2" opacity="0.02" />
      ))}
      {[...Array(16)].map((_, col) => (
        <line key={`v${col}`} x1={col * 20} y1="0" x2={col * 20} y2="420" stroke="currentColor" strokeWidth="0.2" opacity="0.02" />
      ))}
      {/* Architectural elements */}
      <rect x="40" y="100" width="100" height="120" rx="2" stroke="currentColor" strokeWidth="0.5" opacity="0.05" />
      <rect x="160" y="140" width="80" height="80" rx="2" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      {/* Dimension lines */}
      <line x1="40" y1="240" x2="140" y2="240" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <line x1="40" y1="237" x2="40" y2="243" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <line x1="140" y1="237" x2="140" y2="243" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      {/* Dot accents */}
      <circle cx="40" cy="100" r="2" fill="currentColor" opacity="0.05" />
      <circle cx="140" cy="100" r="2" fill="currentColor" opacity="0.05" />
      <circle cx="160" cy="140" r="2" fill="currentColor" opacity="0.04" />
      <circle cx="240" cy="140" r="2" fill="currentColor" opacity="0.04" />
    </svg>
  );
}
