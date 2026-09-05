import { Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus } from 'lucide-react';
import { KanbanCard } from './KanbanCard';
import { ColumnMenu } from './ColumnMenu';
import { useKanbanStore } from './kanbanStore';
import { cn } from '@shared/utils/cn';
import type { KanbanColumnData, KanbanTask } from './types';

interface KanbanColumnProps {
  column: KanbanColumnData;
  tasks: KanbanTask[];
}

export function KanbanColumn({ column, tasks }: KanbanColumnProps) {
  const { openAddModal, openDetailsPanel } = useKanbanStore();

  return (
    <div className="flex flex-col min-w-[280px] max-w-[340px] flex-1">
      {/* Column header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className={cn('w-2 h-2 rounded-full', column.dotColor)} />
          <h3 className="text-sm font-bold text-surface-50">{column.title}</h3>
          <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-surface-800 dark:bg-surface-700 text-[10px] font-bold text-surface-400">
            {tasks.length}
          </span>
        </div>
        <ColumnMenu columnId={column.id} columnTitle={column.title} />
      </div>

      {/* Add task button */}
      <button
        type="button"
        onClick={() => openAddModal(column.id)}
        className="flex items-center justify-center gap-1.5 w-full py-2 mb-3 rounded-xl border border-dashed border-surface-800 dark:border-surface-700 text-xs font-medium text-surface-500 hover:text-brand-400 hover:border-brand-500/30 hover:bg-brand-500/5 transition-all"
      >
        <Plus size={14} />
        Add task
      </button>

      {/* Droppable card list */}
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              'flex-1 space-y-3 min-h-[100px] rounded-xl transition-colors duration-200',
              snapshot.isDraggingOver && 'bg-brand-500/5',
            )}
          >
            {tasks.map((task, index) => (
              <Draggable key={task.id} draggableId={task.id} index={index}>
                {(dragProvided, dragSnapshot) => (
                  <div
                    ref={dragProvided.innerRef}
                    {...dragProvided.draggableProps}
                    {...dragProvided.dragHandleProps}
                  >
                    <KanbanCard
                      task={task}
                      isDragging={dragSnapshot.isDragging}
                      onClick={() => openDetailsPanel(task.id)}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}

            {/* Empty state */}
            {tasks.length === 0 && !snapshot.isDraggingOver && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-xs text-surface-500 mb-2">No tasks yet</p>
                <button
                  type="button"
                  onClick={() => openAddModal(column.id)}
                  className="text-xs font-medium text-brand-400 hover:text-brand-300 transition-colors"
                >
                  + Add task
                </button>
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}
