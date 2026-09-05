import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CalendarEvent, CalendarEventType, CalendarView } from '@worklog/types/calendar';

const STORAGE_KEY = 'ff_calendar_events';

function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface CalendarState {
  events: CalendarEvent[];
  viewMode: CalendarView;
  selectedDate: string;
  categoryFilter: CalendarEventType | 'all';
  searchQuery: string;
  isModalOpen: boolean;
  modalDefaults: Partial<CalendarEvent> | null;
  selectedEvent: CalendarEvent | null;
  isDetailsOpen: boolean;

  setViewMode: (mode: CalendarView) => void;
  setSelectedDate: (date: string) => void;
  setCategoryFilter: (filter: CalendarEventType | 'all') => void;
  setSearchQuery: (query: string) => void;
  addEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  updateEvent: (id: string, patch: Partial<CalendarEvent>) => void;
  deleteEvent: (id: string) => void;
  openModal: (defaults?: Partial<CalendarEvent>) => void;
  closeModal: () => void;
  openDetails: (event: CalendarEvent) => void;
  closeDetails: () => void;
}

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set) => ({
      events: [],
      viewMode: 'week',
      selectedDate: todayDateString(),
      categoryFilter: 'all',
      searchQuery: '',
      isModalOpen: false,
      modalDefaults: null,
      selectedEvent: null,
      isDetailsOpen: false,

      setViewMode: (mode) => set({ viewMode: mode }),
      setSelectedDate: (date) => set({ selectedDate: date }),
      setCategoryFilter: (filter) => set({ categoryFilter: filter }),
      setSearchQuery: (query) => set({ searchQuery: query }),

      addEvent: (event) =>
        set((state) => ({
          events: [
            ...state.events,
            { ...event, id: `cal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` },
          ],
        })),

      updateEvent: (id, patch) =>
        set((state) => ({
          events: state.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })),

      deleteEvent: (id) =>
        set((state) => ({
          events: state.events.filter((e) => e.id !== id),
        })),

      openModal: (defaults) => set({ isModalOpen: true, modalDefaults: defaults ?? null }),
      closeModal: () => set({ isModalOpen: false, modalDefaults: null }),

      openDetails: (event) => set({ selectedEvent: event, isDetailsOpen: true }),
      closeDetails: () => set({ selectedEvent: null, isDetailsOpen: false }),
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({ events: state.events }),
    },
  ),
);
