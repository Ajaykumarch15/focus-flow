import type { FeatureType } from '../../types/collaboration';
import { Badge, type BadgeTone } from '../ui/Badge';
import { cn } from '../../lib/cn';

// IES-R1 (P6-T2): work-item type → badge tone/label mapping for the Features
// page. Types mirror the server Feature enum (server/models/Feature.js).
const TYPE_META: Record<FeatureType, { label: string; tone: BadgeTone }> = {
  feature: { label: 'Feature', tone: 'brand' },
  bug: { label: 'Bug', tone: 'danger' },
  spike: { label: 'Spike', tone: 'warning' },
  chore: { label: 'Chore', tone: 'neutral' },
  research: { label: 'Research', tone: 'info' },
  debt: { label: 'Tech Debt', tone: 'warning' },
  improvement: { label: 'Improvement', tone: 'success' },
};

interface WorkItemTypeBadgeProps {
  type: FeatureType;
  className?: string;
}

export function WorkItemTypeBadge({ type, className }: WorkItemTypeBadgeProps) {
  const meta = TYPE_META[type] ?? { label: type, tone: 'neutral' as BadgeTone };
  return (
    <Badge tone={meta.tone} className={cn('text-[10px] font-extrabold uppercase', className)}>
      {meta.label}
    </Badge>
  );
}
