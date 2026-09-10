import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ScheduleTemplate, ScheduleTemplateSlot } from '@worklog/types/scheduleTemplate';
import type { ScheduleItem } from '@shared/types';

const STORAGE_KEY = 'ff_schedule_templates';

interface ScheduleTemplateState {
  templates: ScheduleTemplate[];
  saveTemplate: (name: string, schedules: ScheduleItem[], tasks: any[]) => void;
  deleteTemplate: (id: string) => void;
  renameTemplate: (id: string, name: string) => void;
}

export const useScheduleTemplateStore = create<ScheduleTemplateState>()(
  persist(
    (set) => ({
      templates: [],

      saveTemplate: (name, schedules, tasks) => {
        const slots: ScheduleTemplateSlot[] = schedules
          .filter((s) => s.status !== 'cancelled')
          .map((s) => {
            const taskObj = typeof s.taskId === 'object' && s.taskId !== null ? s.taskId as any : tasks.find((t: any) => t.id === s.taskId);
            return {
              taskId: taskObj?.id || (typeof s.taskId === 'string' ? s.taskId : ''),
              taskTitle: taskObj?.title || 'Untitled',
              startTime: s.startTime,
              endTime: s.endTime,
              category: taskObj?.category || '',
              priority: taskObj?.priority || 'medium',
              color: taskObj?.color || '#0ea5e9',
            };
          });

        const template: ScheduleTemplate = {
          id: `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name,
          slots,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        set((state) => ({ templates: [...state.templates, template] }));
      },

      deleteTemplate: (id) => {
        set((state) => ({ templates: state.templates.filter((t) => t.id !== id) }));
      },

      renameTemplate: (id, name) => {
        set((state) => ({
          templates: state.templates.map((t) =>
            t.id === id ? { ...t, name, updatedAt: new Date().toISOString() } : t
          ),
        }));
      },
    }),
    {
      name: STORAGE_KEY,
    },
  ),
);
