import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { ScheduleCard } from '@personal/components/schedule/ScheduleCard';
import type { ScheduleItem, DerivedScheduleState } from '@shared/types';

interface SortableScheduleCardProps {
  schedule: ScheduleItem;
  derivedState?: DerivedScheduleState;
}

export function SortableScheduleCard({ schedule, derivedState }: SortableScheduleCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: schedule._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <div
        {...attributes}
        {...listeners}
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-6 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-10"
      >
        <GripVertical size={14} className="text-surface-500 hover:text-surface-300" />
      </div>
      <ScheduleCard schedule={schedule} derivedState={derivedState} />
    </div>
  );
}
