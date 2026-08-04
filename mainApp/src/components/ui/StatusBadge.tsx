import { Badge, type BadgeTone } from './Badge';

const STATUS_TONE: Record<string, BadgeTone> = {
  planning: 'info',
  backlog: 'info',
  ready: 'info',
  todo: 'info',
  'in_progress': 'brand',
  'in-progress': 'brand',
  active: 'brand',
  running: 'brand',
  review: 'warning',
  paused: 'warning',
  waiting: 'warning',
  blocked: 'danger',
  cancelled: 'danger',
  failed: 'danger',
  done: 'success',
  completed: 'success',
  resolved: 'success',
};

interface StatusBadgeProps {
  status: string;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return <Badge tone={STATUS_TONE[status.toLowerCase()] ?? 'neutral'} className={className}>{label ?? status}</Badge>;
}
