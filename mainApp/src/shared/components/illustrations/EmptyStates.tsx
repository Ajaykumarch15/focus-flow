import type { IllustrationProps } from './types';

const defaultProps = { size: 180 };

export function NothingHereYet({ size = defaultProps.size, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" className={className} aria-hidden="true">
      <circle cx="90" cy="90" r="70" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.2" />
      <circle cx="90" cy="90" r="40" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <path d="M70 85 C70 75, 110 75, 110 85 C110 95, 90 100, 90 100 C90 100, 70 95, 70 85Z" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.3" />
      <circle cx="90" cy="82" r="4" fill="currentColor" opacity="0.25" />
      <path d="M60 130 L75 115 M120 130 L105 115" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.15" />
    </svg>
  );
}

export function NothingNeedsAttention({ size = defaultProps.size, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" className={className} aria-hidden="true">
      <circle cx="90" cy="90" r="45" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <path d="M70 90 L85 105 L115 75" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.25" />
      <path d="M65 135 L75 130 M115 135 L105 130" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.1" />
    </svg>
  );
}

export function NoActivityMatches({ size = defaultProps.size, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" className={className} aria-hidden="true">
      <circle cx="78" cy="78" r="32" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <line x1="100" y1="100" x2="130" y2="130" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.25" />
      <path d="M68 78 L78 88 L90 68" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.2" />
      <line x1="60" y1="140" x2="120" y2="140" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.12" />
      <line x1="70" y1="148" x2="110" y2="148" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.08" />
    </svg>
  );
}

export function NothingScheduledToday({ size = defaultProps.size, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" className={className} aria-hidden="true">
      <rect x="40" y="45" width="100" height="90" rx="8" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
      <line x1="40" y1="70" x2="140" y2="70" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <circle cx="60" cy="57" r="4" fill="currentColor" opacity="0.15" />
      <circle cx="75" cy="57" r="4" fill="currentColor" opacity="0.15" />
      <circle cx="90" cy="57" r="4" fill="currentColor" opacity="0.15" />
      <circle cx="60" cy="90" r="8" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <circle cx="90" cy="90" r="8" stroke="currentColor" strokeWidth="1.5" opacity="0.12" />
      <circle cx="120" cy="90" r="8" stroke="currentColor" strokeWidth="1.5" opacity="0.12" />
      <circle cx="75" cy="115" r="8" stroke="currentColor" strokeWidth="1.5" opacity="0.1" />
      <circle cx="105" cy="115" r="8" stroke="currentColor" strokeWidth="1.5" opacity="0.1" />
      <path d="M82 145 C82 142, 98 142, 98 145" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.2" />
    </svg>
  );
}

export function NothingUpcoming({ size = defaultProps.size, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" className={className} aria-hidden="true">
      <path d="M50 130 L90 50 L130 130" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.15" />
      <path d="M65 130 L90 70 L115 130" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.1" />
      <circle cx="90" cy="50" r="6" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
      <path d="M87 50 L90 47 L93 50" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.25" />
      <line x1="90" y1="56" x2="90" y2="62" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.2" />
      <path d="M40 145 C60 140, 120 140, 140 145" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.12" />
    </svg>
  );
}

export function NoJournalEntries({ size = defaultProps.size, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" className={className} aria-hidden="true">
      <rect x="50" y="40" width="80" height="105" rx="6" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
      <line x1="65" y1="40" x2="65" y2="145" stroke="currentColor" strokeWidth="1.5" opacity="0.12" />
      <line x1="75" y1="65" x2="115" y2="65" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.15" />
      <line x1="75" y1="80" x2="105" y2="80" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.12" />
      <line x1="75" y1="95" x2="110" y2="95" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.1" />
      <path d="M110 115 L120 105 L130 115" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.2" />
      <line x1="120" y1="105" x2="120" y2="130" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.2" />
    </svg>
  );
}

export function NoFutureGoals({ size = defaultProps.size, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" className={className} aria-hidden="true">
      <circle cx="90" cy="70" r="28" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
      <circle cx="90" cy="70" r="18" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <circle cx="90" cy="70" r="8" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
      <circle cx="90" cy="70" r="2" fill="currentColor" opacity="0.3" />
      <path d="M90 98 L90 135" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.15" />
      <path d="M75 135 L105 135" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.15" />
      <path d="M55 145 L70 135 M125 145 L110 135" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.1" />
    </svg>
  );
}

export function TaskNotFound({ size = defaultProps.size, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" className={className} aria-hidden="true">
      <rect x="50" y="50" width="80" height="80" rx="8" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.15" />
      <path d="M75 75 L85 85 M105 75 L95 85 M85 75 L95 85 M75 85 L85 75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.2" />
      <path d="M70 110 L80 100 M110 110 L100 100" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.15" />
      <circle cx="90" cy="140" r="3" fill="currentColor" opacity="0.15" />
      <circle cx="80" cy="145" r="2" fill="currentColor" opacity="0.1" />
      <circle cx="100" cy="145" r="2" fill="currentColor" opacity="0.1" />
    </svg>
  );
}

export function NoWorkLogs({ size = defaultProps.size, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" className={className} aria-hidden="true">
      <rect x="45" y="35" width="60" height="80" rx="5" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
      <line x1="55" y1="55" x2="95" y2="55" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.15" />
      <line x1="55" y1="70" x2="85" y2="70" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.12" />
      <line x1="55" y1="85" x2="90" y2="85" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.1" />
      <line x1="55" y1="100" x2="80" y2="100" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.08" />
      <rect x="75" y="65" width="60" height="80" rx="5" stroke="currentColor" strokeWidth="1.5" opacity="0.12" />
      <path d="M105 100 L115 90 L125 100" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.15" />
      <line x1="115" y1="90" x2="115" y2="120" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.15" />
    </svg>
  );
}

export function NoMatchingLogs({ size = defaultProps.size, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" className={className} aria-hidden="true">
      <circle cx="78" cy="78" r="28" stroke="currentColor" strokeWidth="2" opacity="0.2" />
      <line x1="98" y1="98" x2="125" y2="125" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.2" />
      <rect x="60" y="120" width="50" height="6" rx="3" stroke="currentColor" strokeWidth="1" opacity="0.12" />
      <rect x="70" y="132" width="30" height="4" rx="2" stroke="currentColor" strokeWidth="1" opacity="0.08" />
    </svg>
  );
}

export function NoScheduledTasks({ size = defaultProps.size, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" className={className} aria-hidden="true">
      <rect x="35" y="45" width="110" height="95" rx="8" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
      <line x1="35" y1="70" x2="145" y2="70" stroke="currentColor" strokeWidth="1.5" opacity="0.12" />
      <rect x="45" y="50" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1" opacity="0.15" />
      <rect x="63" y="50" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1" opacity="0.15" />
      <rect x="81" y="50" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1" opacity="0.15" />
      <rect x="45" y="80" width="24" height="18" rx="3" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" opacity="0.1" />
      <rect x="77" y="80" width="24" height="18" rx="3" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" opacity="0.1" />
      <rect x="109" y="80" width="24" height="18" rx="3" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" opacity="0.08" />
      <rect x="45" y="106" width="24" height="18" rx="3" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" opacity="0.08" />
      <rect x="77" y="106" width="24" height="18" rx="3" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" opacity="0.08" />
    </svg>
  );
}

export function NoScheduledThisWeek({ size = defaultProps.size, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" className={className} aria-hidden="true">
      <rect x="30" y="50" width="120" height="85" rx="8" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
      <line x1="30" y1="72" x2="150" y2="72" stroke="currentColor" strokeWidth="1.5" opacity="0.12" />
      <line x1="55" y1="72" x2="55" y2="135" stroke="currentColor" strokeWidth="1" opacity="0.08" />
      <line x1="80" y1="72" x2="80" y2="135" stroke="currentColor" strokeWidth="1" opacity="0.08" />
      <line x1="105" y1="72" x2="105" y2="135" stroke="currentColor" strokeWidth="1" opacity="0.08" />
      <line x1="130" y1="72" x2="130" y2="135" stroke="currentColor" strokeWidth="1" opacity="0.08" />
      <line x1="30" y1="97" x2="150" y2="97" stroke="currentColor" strokeWidth="1" opacity="0.06" />
      <line x1="30" y1="117" x2="150" y2="117" stroke="currentColor" strokeWidth="1" opacity="0.06" />
      <path d="M80 90 L90 80 L100 90" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.15" />
      <line x1="90" y1="80" x2="90" y2="110" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.15" />
    </svg>
  );
}

export function NotEnoughData({ size = defaultProps.size, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" className={className} aria-hidden="true">
      <circle cx="90" cy="70" r="24" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
      <path d="M82 70 L88 76 L100 64" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.25" />
      <path d="M82 55 L82 50" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.15" />
      <path d="M98 55 L98 50" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.15" />
      <path d="M90 46 L90 40" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.15" />
      <path d="M60 55 L55 50" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.12" />
      <path d="M120 55 L125 50" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.12" />
      <path d="M70 110 L75 100 M90 110 L90 95 M110 110 L105 100" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.12" />
      <rect x="55" y="115" width="70" height="20" rx="4" stroke="currentColor" strokeWidth="1.5" opacity="0.12" />
      <line x1="65" y1="125" x2="115" y2="125" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.08" />
    </svg>
  );
}

export function NoHabits({ size = defaultProps.size, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" className={className} aria-hidden="true">
      <circle cx="90" cy="90" r="45" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <circle cx="90" cy="90" r="35" stroke="currentColor" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.1" />
      <path d="M90 55 A35 35 0 0 1 125 90" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.2" />
      <circle cx="90" cy="55" r="4" fill="currentColor" opacity="0.2" />
      <circle cx="125" cy="90" r="4" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <circle cx="90" cy="125" r="4" stroke="currentColor" strokeWidth="1.5" opacity="0.1" />
      <circle cx="55" cy="90" r="4" stroke="currentColor" strokeWidth="1.5" opacity="0.1" />
      <path d="M85 85 L95 85 M90 80 L90 90" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.2" />
    </svg>
  );
}

export function NoAnalytics({ size = defaultProps.size, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" className={className} aria-hidden="true">
      <line x1="40" y1="140" x2="40" y2="50" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.15" />
      <line x1="40" y1="140" x2="145" y2="140" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.15" />
      <rect x="55" y="110" width="14" height="30" rx="2" stroke="currentColor" strokeWidth="1.5" opacity="0.12" />
      <rect x="80" y="90" width="14" height="50" rx="2" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <rect x="105" y="100" width="14" height="40" rx="2" stroke="currentColor" strokeWidth="1.5" opacity="0.12" />
      <rect x="130" y="80" width="14" height="60" rx="2" stroke="currentColor" strokeWidth="1.5" opacity="0.1" />
      <path d="M62 105 L87 85 L112 95 L137 75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 4" opacity="0.15" />
    </svg>
  );
}

export function NoKnowledge({ size = defaultProps.size, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" className={className} aria-hidden="true">
      <rect x="45" y="40" width="55" height="75" rx="5" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
      <rect x="55" y="50" width="55" height="75" rx="5" stroke="currentColor" strokeWidth="1.5" opacity="0.12" />
      <line x1="65" y1="65" x2="100" y2="65" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.15" />
      <line x1="65" y1="80" x2="95" y2="80" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.1" />
      <line x1="65" y1="95" x2="90" y2="95" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.08" />
      <circle cx="120" cy="60" r="15" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <line x1="120" y1="53" x2="120" y2="67" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.2" />
      <line x1="113" y1="60" x2="127" y2="60" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.2" />
    </svg>
  );
}

export function NoBlockers({ size = defaultProps.size, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" className={className} aria-hidden="true">
      <path d="M90 45 L130 65 L130 105 L90 125 L50 105 L50 65 Z" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
      <path d="M90 55 L122 72 L122 100 L90 117 L58 100 L58 72 Z" stroke="currentColor" strokeWidth="1" opacity="0.1" />
      <path d="M78 82 L88 92 L105 75" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.25" />
    </svg>
  );
}

export function NoDecisions({ size = defaultProps.size, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" className={className} aria-hidden="true">
      <line x1="90" y1="45" x2="90" y2="100" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <circle cx="90" cy="42" r="5" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
      <path d="M55 100 L90 85 L125 100" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.2" />
      <path d="M55 100 L45 120" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.15" />
      <path d="M125 100 L135 120" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.15" />
      <circle cx="45" cy="123" r="6" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <circle cx="135" cy="123" r="6" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <path d="M42 123 L48 123 M45 120 L45 126" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.12" />
    </svg>
  );
}

export function WorkLogNotFound({ size = defaultProps.size, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" className={className} aria-hidden="true">
      <rect x="55" y="40" width="70" height="90" rx="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.15" />
      <line x1="70" y1="65" x2="110" y2="65" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.12" />
      <line x1="70" y1="80" x2="100" y2="80" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.1" />
      <line x1="70" y1="95" x2="105" y2="95" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.08" />
      <path d="M100 115 L110 105 M110 115 L100 105" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.2" />
    </svg>
  );
}

export function NoTimelineEntries({ size = defaultProps.size, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" className={className} aria-hidden="true">
      <line x1="90" y1="40" x2="90" y2="145" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <circle cx="90" cy="55" r="6" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <circle cx="90" cy="85" r="6" stroke="currentColor" strokeWidth="1.5" opacity="0.12" />
      <circle cx="90" cy="115" r="6" stroke="currentColor" strokeWidth="1.5" opacity="0.1" />
      <circle cx="90" cy="140" r="4" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" opacity="0.08" />
      <line x1="100" y1="55" x2="130" y2="55" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.1" />
      <line x1="100" y1="85" x2="125" y2="85" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.08" />
      <line x1="100" y1="115" x2="128" y2="115" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.06" />
    </svg>
  );
}

export function NoWorkspaces({ size = defaultProps.size, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" className={className} aria-hidden="true">
      <rect x="35" y="55" width="45" height="35" rx="6" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <rect x="100" y="55" width="45" height="35" rx="6" stroke="currentColor" strokeWidth="1.5" opacity="0.12" />
      <rect x="35" y="105" width="45" height="35" rx="6" stroke="currentColor" strokeWidth="1.5" opacity="0.12" />
      <rect x="100" y="105" width="45" height="35" rx="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.1" />
      <path d="M118 118 L127 118 M122.5 113.5 L122.5 122.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.2" />
    </svg>
  );
}

export function NoWorkspaceMembers({ size = defaultProps.size, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" className={className} aria-hidden="true">
      <circle cx="70" cy="75" r="16" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <circle cx="70" cy="60" r="6" stroke="currentColor" strokeWidth="1" opacity="0.12" />
      <path d="M50 100 C50 88, 90 88, 90 100" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.12" />
      <circle cx="115" cy="75" r="16" stroke="currentColor" strokeWidth="1.5" opacity="0.12" />
      <circle cx="115" cy="60" r="6" stroke="currentColor" strokeWidth="1" opacity="0.1" />
      <path d="M95 100 C95 88, 135 88, 135 100" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.1" />
      <path d="M85 125 L95 115 M95 125 L85 115" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.15" />
    </svg>
  );
}

export function NoLeaderboard({ size = defaultProps.size, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" className={className} aria-hidden="true">
      <rect x="35" y="95" width="30" height="45" rx="4" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <rect x="75" y="65" width="30" height="75" rx="4" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
      <rect x="115" y="80" width="30" height="60" rx="4" stroke="currentColor" strokeWidth="1.5" opacity="0.12" />
      <path d="M75 62 L90 50 L105 62" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.2" />
      <circle cx="90" cy="46" r="5" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
      <line x1="50" y1="145" x2="130" y2="145" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.12" />
    </svg>
  );
}

export function NoDiscussions({ size = defaultProps.size, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" className={className} aria-hidden="true">
      <path d="M45 60 C45 52, 53 45, 62 45 L118 45 C127 45, 135 52, 135 60 L135 90 C135 98, 127 105, 118 105 L75 105 L60 120 L60 105 L62 105 C53 105, 45 98, 45 90 Z" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
      <line x1="62" y1="65" x2="118" y2="65" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.12" />
      <line x1="62" y1="80" x2="100" y2="80" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.1" />
      <line x1="62" y1="95" x2="108" y2="95" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.08" />
    </svg>
  );
}

export function NoActivity({ size = defaultProps.size, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" className={className} aria-hidden="true">
      <circle cx="90" cy="90" r="40" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <path d="M70 90 L85 90 L90 70 L95 110 L100 90 L110 90" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.2" />
      <path d="M55 135 L65 130 M125 135 L115 130" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.1" />
    </svg>
  );
}

export function NoMemberships({ size = defaultProps.size, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" className={className} aria-hidden="true">
      <rect x="50" y="55" width="80" height="65" rx="8" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
      <rect x="60" y="65" width="20" height="20" rx="4" stroke="currentColor" strokeWidth="1" opacity="0.15" />
      <rect x="90" y="65" width="20" height="20" rx="4" stroke="currentColor" strokeWidth="1" opacity="0.12" />
      <line x1="60" y1="95" x2="100" y2="95" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.1" />
      <line x1="60" y1="105" x2="90" y2="105" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.08" />
      <path d="M120 130 L130 120 M130 130 L120 120" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.12" />
    </svg>
  );
}

export function NotificationsBlocked({ size = defaultProps.size, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" className={className} aria-hidden="true">
      <path d="M75 55 C75 45, 105 45, 105 55 L108 100 L120 115 L60 115 L72 100 Z" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
      <path d="M82 115 C82 125, 98 125, 98 115" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.15" />
      <line x1="45" y1="135" x2="135" y2="55" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.2" />
    </svg>
  );
}

export function NoReportsForDay({ size = defaultProps.size, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" className={className} aria-hidden="true">
      <rect x="45" y="40" width="90" height="100" rx="8" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
      <line x1="45" y1="65" x2="135" y2="65" stroke="currentColor" strokeWidth="1.5" opacity="0.12" />
      <rect x="55" y="48" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1" opacity="0.15" />
      <circle cx="75" cy="53" r="3" fill="currentColor" opacity="0.1" />
      <rect x="55" y="75" width="70" height="8" rx="2" stroke="currentColor" strokeWidth="1" opacity="0.1" />
      <rect x="55" y="90" width="50" height="8" rx="2" stroke="currentColor" strokeWidth="1" opacity="0.08" />
      <rect x="55" y="105" width="60" height="8" rx="2" stroke="currentColor" strokeWidth="1" opacity="0.06" />
      <path d="M85 120 L95 110 M95 120 L85 110" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.15" />
    </svg>
  );
}

export function ProfileNotFound({ size = defaultProps.size, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" className={className} aria-hidden="true">
      <circle cx="90" cy="70" r="28" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.15" />
      <circle cx="90" cy="60" r="10" stroke="currentColor" strokeWidth="1.5" opacity="0.12" />
      <path d="M70 95 C70 82, 110 82, 110 95" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.1" />
      <path d="M80 130 L90 120 L100 130" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.15" />
      <line x1="90" y1="120" x2="90" y2="145" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.15" />
    </svg>
  );
}

export function StartSearching({ size = defaultProps.size, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" className={className} aria-hidden="true">
      <circle cx="80" cy="80" r="30" stroke="currentColor" strokeWidth="2" opacity="0.2" />
      <line x1="102" y1="102" x2="130" y2="130" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.2" />
      <path d="M72 72 L88 88 M88 72 L72 88" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.12" />
    </svg>
  );
}

export function NoSearchResults({ size = defaultProps.size, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" className={className} aria-hidden="true">
      <circle cx="78" cy="78" r="30" stroke="currentColor" strokeWidth="2" opacity="0.2" />
      <line x1="100" y1="100" x2="128" y2="128" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.2" />
      <line x1="68" y1="78" x2="88" y2="78" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.15" />
      <path d="M65 130 L75 125 M115 130 L105 125" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.1" />
    </svg>
  );
}

export function NoActiveTimers({ size = defaultProps.size, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" className={className} aria-hidden="true">
      <circle cx="90" cy="95" r="40" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
      <line x1="90" y1="95" x2="90" y2="70" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.2" />
      <line x1="90" y1="95" x2="105" y2="95" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.15" />
      <circle cx="90" cy="95" r="3" fill="currentColor" opacity="0.2" />
      <path d="M78 52 L82 48 M102 52 L98 48" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.15" />
      <line x1="90" y1="50" x2="90" y2="55" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.15" />
      <path d="M65 145 L75 140 M115 145 L105 140" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.1" />
    </svg>
  );
}

export function NoUsersFound({ size = defaultProps.size, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" className={className} aria-hidden="true">
      <circle cx="78" cy="78" r="30" stroke="currentColor" strokeWidth="2" opacity="0.2" />
      <line x1="100" y1="100" x2="128" y2="128" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.2" />
      <circle cx="78" cy="70" r="8" stroke="currentColor" strokeWidth="1.5" opacity="0.15" />
      <path d="M62 98 C62 88, 94 88, 94 98" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.1" />
    </svg>
  );
}

export function SearchIdle({ size = defaultProps.size, className }: IllustrationProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 180 180" fill="none" className={className} aria-hidden="true">
      <circle cx="80" cy="80" r="30" stroke="currentColor" strokeWidth="2" opacity="0.15" />
      <line x1="102" y1="102" x2="125" y2="125" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" opacity="0.15" />
      <line x1="70" y1="80" x2="90" y2="80" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.1" />
      <line x1="80" y1="70" x2="80" y2="90" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.1" />
    </svg>
  );
}
