import type { CardBackgroundProps } from './types';

export function AdminHeroBackground({ className }: CardBackgroundProps) {
  return (
    <svg viewBox="0 0 400 200" fill="none" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="400" height="200" fill="currentColor" opacity="0.02" />
      {/* Control panel with plant elements */}
      <rect x="100" y="60" width="200" height="100" rx="6" stroke="currentColor" strokeWidth="0.8" opacity="0.04" />
      <rect x="110" y="70" width="180" height="80" rx="4" stroke="currentColor" strokeWidth="0.5" opacity="0.03" />
      {/* Gauge circles */}
      <circle cx="150" cy="100" r="20" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <path d="M150 80 L150 100 L165 100" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" opacity="0.05" />
      <circle cx="200" cy="100" r="20" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <path d="M200 85 L200 100 L212 100" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" opacity="0.05" />
      <circle cx="250" cy="100" r="20" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <path d="M250 90 L250 100 L258 100" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" opacity="0.05" />
      {/* Plant elements emerging from controls */}
      <path d="M150 80 L150 55" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <ellipse cx="142" cy="50" rx="8" ry="5" fill="currentColor" opacity="0.02" />
      <ellipse cx="158" cy="48" rx="9" ry="5.5" fill="currentColor" opacity="0.025" />
      <ellipse cx="150" cy="45" rx="7" ry="4.5" fill="currentColor" opacity="0.02" />
      {/* Grid pattern */}
      {[...Array(10)].map((_, row) =>
        [...Array(20)].map((_, col) => (
          <circle key={`${row}-${col}`} cx={10 + col * 20} cy={10 + row * 20} r="0.8" fill="currentColor" opacity="0.02" />
        ))
      )}
    </svg>
  );
}

export function SettingsBackground({ className }: CardBackgroundProps) {
  return (
    <svg viewBox="0 0 200 160" fill="none" className={className} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <rect width="200" height="160" fill="currentColor" opacity="0.015" />
      {/* Gear with garden inside */}
      <circle cx="100" cy="80" r="40" stroke="currentColor" strokeWidth="0.8" opacity="0.04" />
      <circle cx="100" cy="80" r="25" stroke="currentColor" strokeWidth="0.5" opacity="0.03" />
      <circle cx="100" cy="80" r="10" fill="currentColor" opacity="0.03" />
      {/* Gear teeth */}
      {[...Array(8)].map((_, i) => {
        const angle = (i * 45) * (Math.PI / 180);
        const innerR = 40;
        return (
          <rect
            key={i}
            x={100 + Math.cos(angle) * innerR - 4}
            y={80 + Math.sin(angle) * innerR - 4}
            width="8"
            height="8"
            rx="1"
            fill="currentColor"
            opacity="0.03"
            transform={`rotate(${i * 45} ${100 + Math.cos(angle) * innerR} ${80 + Math.sin(angle) * innerR})`}
          />
        );
      })}
      {/* Garden inside gear */}
      <path d="M100 75 L100 55" stroke="currentColor" strokeWidth="0.5" opacity="0.04" />
      <ellipse cx="93" cy="52" rx="7" ry="4" fill="currentColor" opacity="0.02" />
      <ellipse cx="107" cy="50" rx="8" ry="4.5" fill="currentColor" opacity="0.025" />
      <ellipse cx="100" cy="48" rx="6" ry="3.5" fill="currentColor" opacity="0.02" />
    </svg>
  );
}
