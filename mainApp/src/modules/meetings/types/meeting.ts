export type MeetingStatus = 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
export type MeetingPlatform = 'google_meet' | 'zoom' | 'teams' | 'other';
export type MeetingCategory = 'essentials' | 'standup' | 'review' | 'brainstorm' | 'other';

export interface MeetingParticipant {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface Meeting {
  _id: string;
  title: string;
  description?: string;
  date: string; // "YYYY-MM-DD"
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  allDay: boolean;
  platform: MeetingPlatform;
  meetingLink: string;
  location: string;
  category: MeetingCategory;
  status: MeetingStatus;
  organizerId: MeetingParticipant;
  participantIds: MeetingParticipant[];
  notes: string;
  tags: string[];
  workspaceId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MeetingCreatePayload {
  title: string;
  description?: string;
  date: string;
  startTime: string;
  endTime: string;
  allDay?: boolean;
  platform?: MeetingPlatform;
  meetingLink?: string;
  location?: string;
  category?: MeetingCategory;
  participantIds?: string[];
  notes?: string;
  tags?: string[];
  workspaceId?: string;
}

export interface MeetingUpdatePayload extends Partial<MeetingCreatePayload> {
  status?: MeetingStatus;
}

export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  scheduled: 'Scheduled',
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const MEETING_STATUS_COLORS: Record<MeetingStatus, string> = {
  scheduled: 'info',
  confirmed: 'success',
  in_progress: 'brand',
  completed: 'surface',
  cancelled: 'danger',
};

export const MEETING_PLATFORM_LABELS: Record<MeetingPlatform, string> = {
  google_meet: 'Google Meet',
  zoom: 'Zoom',
  teams: 'Microsoft Teams',
  other: 'Other',
};

export const MEETING_CATEGORY_LABELS: Record<MeetingCategory, string> = {
  essentials: 'Essentials',
  standup: 'Standup',
  review: 'Review',
  brainstorm: 'Brainstorm',
  other: 'Other',
};
