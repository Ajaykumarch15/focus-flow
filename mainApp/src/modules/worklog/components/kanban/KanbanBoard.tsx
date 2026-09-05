import { useMemo, useCallback } from 'react';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import { KanbanColumn } from './KanbanColumn';
import { useKanbanStore } from './kanbanStore';
import { KANBAN_COLUMNS } from './types';
import type { KanbanStatus } from './types';

export function KanbanBoard() {
  const { tasks, searchQuery, filters, sortBy, moveTask, reorderInColumn } = useKanbanStore();

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesDesc = t.description.toLowerCase().includes(q);
        const matchesLabels = t.labels.some((l) => l.name.toLowerCase().includes(q));
        const matchesAssignees = t.assignees.some((a) => a.name.toLowerCase().includes(q));
        if (!matchesTitle && !matchesDesc && !matchesLabels && !matchesAssignees) return false;
      }
      if (filters.status !== 'all' && t.status !== filters.status) return false;
      if (filters.priority && t.priority !== filters.priority) return false;
      if (filters.label && !t.labels.some((l) => l.name === filters.label)) return false;
      if (filters.assignee && !t.assignees.some((a) => a.id === filters.assignee)) return false;
      return true;
    });
  }, [tasks, searchQuery, filters]);

  const tasksByColumn = useMemo(() => {
    const grouped: Record<KanbanStatus, typeof filteredTasks> = {
      todo: [],
      doing: [],
      review: [],
      done: [],
    };

    for (const task of filteredTasks) {
      grouped[task.status].push(task);
    }

    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };

    for (const col of Object.keys(grouped) as KanbanStatus[]) {
      const colTasks = grouped[col];
      if (sortBy === 'priority') {
        colTasks.sort((a, b) => (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99));
      } else if (sortBy === 'dueDate') {
        colTasks.sort((a, b) => {
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        });
      } else {
        colTasks.sort((a, b) => a.order - b.order);
      }
    }

    return grouped;
  }, [filteredTasks, sortBy]);

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      const { source, destination, draggableId } = result;
      if (!destination) return;
      if (source.droppableId === destination.droppableId && source.index === destination.index) return;

      const fromStatus = source.droppableId as KanbanStatus;
      const toStatus = destination.droppableId as KanbanStatus;

      if (fromStatus === toStatus) {
        reorderInColumn(fromStatus, source.index, destination.index);
      } else {
        moveTask(draggableId, toStatus, destination.index);
      }
    },
    [moveTask, reorderInColumn],
  );

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4 px-1 min-h-[calc(100vh-180px)]">
        {KANBAN_COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            column={col}
            tasks={tasksByColumn[col.id]}
          />
        ))}
      </div>
    </DragDropContext>
  );
}
