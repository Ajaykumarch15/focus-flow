export interface ScheduleTemplateSlot {
  taskId: string;
  taskTitle: string;
  startTime: string;
  endTime: string;
  category: string;
  priority: string;
  color: string;
}

export interface ScheduleTemplate {
  id: string;
  name: string;
  slots: ScheduleTemplateSlot[];
  createdAt: string;
  updatedAt: string;
}
