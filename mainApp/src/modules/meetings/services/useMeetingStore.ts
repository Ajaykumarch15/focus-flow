import { create } from 'zustand';
import { api } from '@shared/utils/api';
import type { Meeting, MeetingStatus, MeetingCreatePayload, MeetingUpdatePayload, MeetingParticipant } from '../types/meeting';

interface MeetingState {
  meetings: Meeting[];
  todayMeetings: Meeting[];
  selectedMeeting: Meeting | null;
  activeMeeting: Meeting | null;
  availableUsers: MeetingParticipant[];
  loading: boolean;
  error: string | null;
  statusFilter: MeetingStatus | 'all';
  searchQuery: string;
  isCreateModalOpen: boolean;
  isDetailPanelOpen: boolean;

  fetchMeetings: (params?: { from?: string; to?: string; status?: string }) => Promise<void>;
  fetchTodayMeetings: () => Promise<void>;
  fetchMeeting: (id: string) => Promise<Meeting | null>;
  fetchAvailableUsers: () => Promise<void>;
  createMeeting: (data: MeetingCreatePayload) => Promise<Meeting | null>;
  updateMeeting: (id: string, data: MeetingUpdatePayload) => Promise<Meeting | null>;
  updateStatus: (id: string, status: MeetingStatus) => Promise<void>;
  addParticipant: (meetingId: string, userId: string) => Promise<void>;
  removeParticipant: (meetingId: string, userId: string) => Promise<void>;
  deleteMeeting: (id: string) => Promise<void>;
  setSelectedMeeting: (meeting: Meeting | null) => void;
  setActiveMeeting: (meeting: Meeting | null) => void;
  setStatusFilter: (filter: MeetingStatus | 'all') => void;
  setSearchQuery: (query: string) => void;
  openCreateModal: () => void;
  closeCreateModal: () => void;
  openDetailPanel: (meeting?: Meeting) => void;
  closeDetailPanel: () => void;
}

function getTodayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const useMeetingStore = create<MeetingState>()((set, get) => ({
  meetings: [],
  todayMeetings: [],
  selectedMeeting: null,
  activeMeeting: null,
  availableUsers: [],
  loading: false,
  error: null,
  statusFilter: 'all',
  searchQuery: '',
  isCreateModalOpen: false,
  isDetailPanelOpen: false,

  fetchMeetings: async (params) => {
    set({ loading: true, error: null });
    try {
      const meetings = await api.meetings.list(params);
      set({ meetings, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  fetchTodayMeetings: async () => {
    set({ loading: true, error: null });
    try {
      const todayMeetings = await api.meetings.today();
      set({ todayMeetings, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  fetchMeeting: async (id) => {
    set({ loading: true, error: null });
    try {
      const meeting = await api.meetings.get(id);
      set({ selectedMeeting: meeting, loading: false });
      return meeting;
    } catch (err: any) {
      set({ error: err.message, loading: false });
      return null;
    }
  },

  fetchAvailableUsers: async () => {
    try {
      const users = await api.users.list();
      const mapped: MeetingParticipant[] = (Array.isArray(users) ? users : []).map((u: any) => ({
        _id: u._id || u.id,
        name: u.name || 'Unknown',
        email: u.email || '',
        avatar: u.avatar,
      }));
      set({ availableUsers: mapped });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  createMeeting: async (data) => {
    set({ loading: true, error: null });
    try {
      const meeting = await api.meetings.create(data);
      set((state) => ({
        meetings: [...state.meetings, meeting],
        todayMeetings: meeting.date === getTodayStr()
          ? [...state.todayMeetings, meeting]
          : state.todayMeetings,
        loading: false,
        isCreateModalOpen: false,
      }));
      return meeting;
    } catch (err: any) {
      set({ error: err.message, loading: false });
      return null;
    }
  },

  updateMeeting: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const updated = await api.meetings.update(id, data);
      set((state) => ({
        meetings: state.meetings.map((m) => (m._id === id ? updated : m)),
        todayMeetings: state.todayMeetings.map((m) => (m._id === id ? updated : m)),
        selectedMeeting: state.selectedMeeting?._id === id ? updated : state.selectedMeeting,
        loading: false,
      }));
      return updated;
    } catch (err: any) {
      set({ error: err.message, loading: false });
      return null;
    }
  },

  updateStatus: async (id, status) => {
    try {
      const updated = await api.meetings.updateStatus(id, status);
      set((state) => ({
        meetings: state.meetings.map((m) => (m._id === id ? updated : m)),
        todayMeetings: state.todayMeetings.map((m) => (m._id === id ? updated : m)),
        selectedMeeting: state.selectedMeeting?._id === id ? updated : state.selectedMeeting,
        activeMeeting: status === 'in_progress' ? updated
          : state.activeMeeting?._id === id ? null : state.activeMeeting,
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  addParticipant: async (meetingId, userId) => {
    try {
      const updated = await api.meetings.addParticipant(meetingId, userId);
      set((state) => ({
        meetings: state.meetings.map((m) => (m._id === meetingId ? updated : m)),
        todayMeetings: state.todayMeetings.map((m) => (m._id === meetingId ? updated : m)),
        selectedMeeting: state.selectedMeeting?._id === meetingId ? updated : state.selectedMeeting,
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  removeParticipant: async (meetingId, userId) => {
    try {
      const updated = await api.meetings.removeParticipant(meetingId, userId);
      set((state) => ({
        meetings: state.meetings.map((m) => (m._id === meetingId ? updated : m)),
        todayMeetings: state.todayMeetings.map((m) => (m._id === meetingId ? updated : m)),
        selectedMeeting: state.selectedMeeting?._id === meetingId ? updated : state.selectedMeeting,
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  deleteMeeting: async (id) => {
    try {
      await api.meetings.delete(id);
      set((state) => ({
        meetings: state.meetings.filter((m) => m._id !== id),
        todayMeetings: state.todayMeetings.filter((m) => m._id !== id),
        selectedMeeting: state.selectedMeeting?._id === id ? null : state.selectedMeeting,
        isDetailPanelOpen: state.selectedMeeting?._id === id ? false : state.isDetailPanelOpen,
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  setSelectedMeeting: (meeting) => set({ selectedMeeting: meeting }),
  setActiveMeeting: (meeting) => set({ activeMeeting: meeting }),
  setStatusFilter: (filter) => set({ statusFilter: filter }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  openCreateModal: () => set({ isCreateModalOpen: true }),
  closeCreateModal: () => set({ isCreateModalOpen: false }),
  openDetailPanel: (meeting) => set({ isDetailPanelOpen: true, selectedMeeting: meeting ?? get().selectedMeeting }),
  closeDetailPanel: () => set({ isDetailPanelOpen: false }),
}));
