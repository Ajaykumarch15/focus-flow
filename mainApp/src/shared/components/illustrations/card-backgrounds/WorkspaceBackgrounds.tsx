import type { CardBackgroundProps } from './types';

export function WorkspaceBackgroundPersonal({ className }: CardBackgroundProps) {
  return (
    <svg viewBox="0 0 400 240" fill="none" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="wsp-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.04" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <rect width="400" height="240" fill="url(#wsp-sky)" />
      {/* Mountain range */}
      <path d="M0 200 L60 140 L100 170 L160 100 L200 150 L260 80 L320 130 L360 110 L400 160 L400 240 L0 240Z" fill="currentColor" opacity="0.04" />
      <path d="M0 210 L80 160 L140 185 L200 130 L280 170 L340 145 L400 180 L400 240 L0 240Z" fill="currentColor" opacity="0.03" />
      {/* Sun/rise */}
      <circle cx="320" cy="60" r="25" stroke="currentColor" strokeWidth="1" opacity="0.08" />
      <circle cx="320" cy="60" r="15" stroke="currentColor" strokeWidth="0.5" opacity="0.06" />
      {/* Code brackets overlay */}
      <text x="50" y="80" fontSize="48" fontFamily="monospace" fill="currentColor" opacity="0.03">{'{'}</text>
      <text x="320" y="180" fontSize="48" fontFamily="monospace" fill="currentColor" opacity="0.03">{'}'}</text>
      {/* Dot grid */}
      {[...Array(8)].map((_, row) =>
        [...Array(12)].map((_, col) => (
          <circle key={`${row}-${col}`} cx={30 + col * 32} cy={20 + row * 28} r="1" fill="currentColor" opacity="0.04" />
        ))
      )}
      {/* Path/trail */}
      <path d="M20 220 C100 200, 150 180, 200 190 S300 170, 380 200" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" opacity="0.06" />
      {/* Rising dots along path */}
      <circle cx="100" cy="205" r="2" fill="currentColor" opacity="0.06" />
      <circle cx="200" cy="188" r="2.5" fill="currentColor" opacity="0.07" />
      <circle cx="300" cy="175" r="2" fill="currentColor" opacity="0.06" />
    </svg>
  );
}

export function WorkspaceBackgroundTeam({ className }: CardBackgroundProps) {
  return (
    <svg viewBox="0 0 400 240" fill="none" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="wst-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.03" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <rect width="400" height="240" fill="url(#wst-sky)" />
      {/* Building blocks / workspace structure */}
      <rect x="40" y="120" width="50" height="60" rx="4" stroke="currentColor" strokeWidth="1" opacity="0.06" />
      <rect x="100" y="90" width="50" height="90" rx="4" stroke="currentColor" strokeWidth="1" opacity="0.07" />
      <rect x="160" y="110" width="50" height="70" rx="4" stroke="currentColor" strokeWidth="1" opacity="0.05" />
      <rect x="220" y="80" width="50" height="100" rx="4" stroke="currentColor" strokeWidth="1" opacity="0.06" />
      <rect x="280" y="100" width="50" height="80" rx="4" stroke="currentColor" strokeWidth="1" opacity="0.05" />
      {/* Connection lines */}
      <line x1="90" y1="140" x2="100" y2="130" stroke="currentColor" strokeWidth="0.5" opacity="0.06" />
      <line x1="150" y1="130" x2="160" y2="140" stroke="currentColor" strokeWidth="0.5" opacity="0.06" />
      <line x1="210" y1="140" x2="220" y2="120" stroke="currentColor" strokeWidth="0.5" opacity="0.06" />
      <line x1="270" y1="120" x2="280" y2="135" stroke="currentColor" strokeWidth="0.5" opacity="0.06" />
      {/* Tree canopy above blocks */}
      <ellipse cx="125" cy="80" rx="30" ry="20" fill="currentColor" opacity="0.03" />
      <ellipse cx="245" cy="70" rx="35" ry="22" fill="currentColor" opacity="0.03" />
      {/* Connecting network dots */}
      <circle cx="65" cy="105" r="3" fill="currentColor" opacity="0.06" />
      <circle cx="125" cy="85" r="3" fill="currentColor" opacity="0.06" />
      <circle cx="185" cy="100" r="3" fill="currentColor" opacity="0.05" />
      <circle cx="245" cy="75" r="3" fill="currentColor" opacity="0.06" />
      <circle cx="305" cy="95" r="3" fill="currentColor" opacity="0.05" />
      {/* Network lines */}
      <line x1="68" y1="105" x2="122" y2="88" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.05" />
      <line x1="128" y1="85" x2="182" y2="100" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.05" />
      <line x1="188" y1="100" x2="242" y2="78" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.05" />
      <line x1="248" y1="75" x2="302" y2="95" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.05" />
      {/* Ground horizon */}
      <path d="M0 200 C100 195, 300 195, 400 200" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
    </svg>
  );
}

export function WorkspaceBackgroundWorklog({ className }: CardBackgroundProps) {
  return (
    <svg viewBox="0 0 400 240" fill="none" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="wsw-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.03" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <rect width="400" height="240" fill="url(#wsw-sky)" />
      {/* Clock face */}
      <circle cx="200" cy="120" r="70" stroke="currentColor" strokeWidth="1" opacity="0.05" />
      <circle cx="200" cy="120" r="65" stroke="currentColor" strokeWidth="0.5" opacity="0.03" />
      {/* Clock hands */}
      <line x1="200" y1="120" x2="200" y2="70" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.07" />
      <line x1="200" y1="120" x2="235" y2="120" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.06" />
      <circle cx="200" cy="120" r="3" fill="currentColor" opacity="0.06" />
      {/* Hour markers */}
      {[...Array(12)].map((_, i) => {
        const angle = (i * 30 - 90) * (Math.PI / 180);
        const x1 = 200 + Math.cos(angle) * 58;
        const y1 = 120 + Math.sin(angle) * 58;
        const x2 = 200 + Math.cos(angle) * 62;
        const y2 = 120 + Math.sin(angle) * 62;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="1" opacity="0.05" />;
      })}
      {/* Mountain silhouette inside clock */}
      <path d="M155 145 L180 110 L195 130 L210 100 L230 125 L245 145Z" fill="currentColor" opacity="0.03" />
      {/* Timeline dots extending from clock */}
      <circle cx="60" cy="120" r="2" fill="currentColor" opacity="0.05" />
      <circle cx="90" cy="120" r="2" fill="currentColor" opacity="0.05" />
      <circle cx="120" cy="120" r="2" fill="currentColor" opacity="0.06" />
      <circle cx="280" cy="120" r="2" fill="currentColor" opacity="0.06" />
      <circle cx="310" cy="120" r="2" fill="currentColor" opacity="0.05" />
      <circle cx="340" cy="120" r="2" fill="currentColor" opacity="0.05" />
      <line x1="62" y1="120" x2="118" y2="120" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 3" opacity="0.04" />
      <line x1="282" y1="120" x2="338" y2="120" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 3" opacity="0.04" />
    </svg>
  );
}

export function WorkspaceBackgroundAdmin({ className }: CardBackgroundProps) {
  return (
    <svg viewBox="0 0 400 240" fill="none" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="wsa-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.03" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <rect width="400" height="240" fill="url(#wsa-sky)" />
      {/* Control panel frame */}
      <rect x="60" y="50" width="280" height="140" rx="8" stroke="currentColor" strokeWidth="1" opacity="0.05" />
      {/* Gauge 1 */}
      <circle cx="120" cy="100" r="25" stroke="currentColor" strokeWidth="1" opacity="0.05" />
      <path d="M100 100 A20 20 0 0 1 135 85" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.07" />
      <circle cx="120" cy="100" r="2" fill="currentColor" opacity="0.06" />
      {/* Gauge 2 */}
      <circle cx="200" cy="100" r="25" stroke="currentColor" strokeWidth="1" opacity="0.05" />
      <path d="M180 100 A20 20 0 0 1 215 115" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.07" />
      <circle cx="200" cy="100" r="2" fill="currentColor" opacity="0.06" />
      {/* Gauge 3 */}
      <circle cx="280" cy="100" r="25" stroke="currentColor" strokeWidth="1" opacity="0.05" />
      <path d="M260 100 A20 20 0 0 1 290 80" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.07" />
      <circle cx="280" cy="100" r="2" fill="currentColor" opacity="0.06" />
      {/* Status bars */}
      <rect x="80" y="140" width="60" height="6" rx="3" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <rect x="80" y="140" width="40" height="6" rx="3" fill="currentColor" opacity="0.04" />
      <rect x="170" y="140" width="60" height="6" rx="3" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <rect x="170" y="140" width="50" height="6" rx="3" fill="currentColor" opacity="0.04" />
      <rect x="260" y="140" width="60" height="6" rx="3" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <rect x="260" y="140" width="30" height="6" rx="3" fill="currentColor" opacity="0.04" />
      {/* Garden/plant element growing from panel */}
      <path d="M200 190 L200 170" stroke="currentColor" strokeWidth="1" opacity="0.05" />
      <ellipse cx="190" cy="165" rx="8" ry="5" fill="currentColor" opacity="0.03" />
      <ellipse cx="210" cy="160" rx="10" ry="6" fill="currentColor" opacity="0.03" />
      <ellipse cx="200" cy="155" rx="7" ry="5" fill="currentColor" opacity="0.03" />
    </svg>
  );
}
