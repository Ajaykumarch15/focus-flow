import { Badge, type BadgeTone } from '@shared/components/ui/Badge';
import type { RoadmapStatus } from '@collab/types/collaboration';

// EEP2-P3.4.2: one visual vocabulary for the Roadmap statuses
// (DDS §9: planned | active | completed). Used by RoadmapPage and the
// Milestone/Phase/Module detail pages so the 4-state rendering stays consistent.
const STATUS_CONFIG: Record<RoadmapStatus, { label: string; tone: BadgeTone; dot: string }> = {
  planned: { label: 'Planned', tone: 'info', dot: 'bg-info-500' },
  active: { label: 'Active', tone: 'brand', dot: 'bg-brand-500' },
  completed: { label: 'Completed', tone: 'success', dot: 'bg-success-500' },
};

export function RoadmapStatusBadge({ status }: { status: RoadmapStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.planned;
  return (
    <Badge tone={cfg.tone} icon={<span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} aria-hidden="true" />}>
      {cfg.label}
    </Badge>
  );
}

export const ROADMAP_STATUS_OPTIONS: RoadmapStatus[] = ['planned', 'active', 'completed'];
