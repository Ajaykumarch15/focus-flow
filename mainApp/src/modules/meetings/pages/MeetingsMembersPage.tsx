import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Search, Users, Calendar, Mail } from 'lucide-react';
import { useMeetingStore } from '../services/useMeetingStore';
import { Avatar } from '@shared/components/ui/Avatar';
import { Badge, type BadgeTone } from '@shared/components/ui/Badge';
import type { Meeting, MeetingParticipant } from '../types/meeting';

interface MemberDetail {
  user: MeetingParticipant;
  meetings: Meeting[];
  upcomingMeetings: Meeting[];
  pastMeetings: Meeting[];
  totalHours: number;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function calculateMeetingDuration(startTime: string, endTime: string): number {
  return (timeToMinutes(endTime) - timeToMinutes(startTime)) / 60;
}

export function MeetingsMembersPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const highlightUserId = searchParams.get('highlight');
  const { meetings, fetchMeetings, loading } = useMeetingStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const memberDetails = useMemo(() => {
    const detailsMap = new Map<string, MemberDetail>();
    const today = new Date().toISOString().split('T')[0];

    for (const meeting of meetings) {
      if (meeting.status === 'cancelled') continue;

      const participants = [
        meeting.organizerId,
        ...meeting.participantIds,
      ].filter(Boolean);

      for (const participant of participants) {
        const id = typeof participant === 'string' ? participant : participant._id;
        const user = typeof participant === 'string'
          ? { _id: id, name: 'Unknown', email: '', avatar: undefined }
          : participant;

        if (!detailsMap.has(id)) {
          detailsMap.set(id, {
            user,
            meetings: [],
            upcomingMeetings: [],
            pastMeetings: [],
            totalHours: 0,
          });
        }

        const detail = detailsMap.get(id)!;
        detail.meetings.push(meeting);
        detail.totalHours += calculateMeetingDuration(meeting.startTime, meeting.endTime);

        if (meeting.date >= today && (meeting.status === 'scheduled' || meeting.status === 'confirmed')) {
          detail.upcomingMeetings.push(meeting);
        } else if (meeting.date < today || meeting.status === 'completed') {
          detail.pastMeetings.push(meeting);
        }
      }
    }

    return Array.from(detailsMap.values());
  }, [meetings]);

  const filteredMembers = useMemo(() => {
    let result = memberDetails;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (m) => m.user.name.toLowerCase().includes(q) || m.user.email.toLowerCase().includes(q),
      );
    }

    if (filter === 'active') {
      result = result.filter((m) => m.upcomingMeetings.length > 0);
    } else if (filter === 'inactive') {
      result = result.filter((m) => m.upcomingMeetings.length === 0);
    }

    return result.sort((a, b) => b.meetings.length - a.meetings.length);
  }, [memberDetails, searchQuery, filter]);

  const stats = useMemo(() => ({
    total: memberDetails.length,
    active: memberDetails.filter((m) => m.upcomingMeetings.length > 0).length,
    inactive: memberDetails.filter((m) => m.upcomingMeetings.length === 0).length,
    totalMeetings: meetings.filter((m) => m.status !== 'cancelled').length,
  }), [memberDetails, meetings]);

  const getStatusBadge = (member: MemberDetail): { tone: BadgeTone; label: string } => {
    if (member.upcomingMeetings.length > 0) {
      return { tone: 'success', label: 'Active' };
    }
    return { tone: 'neutral', label: 'Inactive' };
  };

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/meetings')}
            className="mb-4 flex items-center gap-1.5 text-sm text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
          >
            <ArrowLeft size={16} />
            Back to Meetings
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-surface-800 dark:text-surface-100">
                Meeting Members
              </h1>
              <p className="mt-1 text-sm text-surface-400">
                All members participating in meetings
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-surface-200 bg-white p-4 dark:border-surface-800 dark:bg-surface-900">
            <p className="text-2xl font-bold text-surface-800 dark:text-surface-100">{stats.total}</p>
            <p className="text-xs text-surface-400">Total Members</p>
          </div>
          <div className="rounded-xl border border-surface-200 bg-white p-4 dark:border-surface-800 dark:bg-surface-900">
            <p className="text-2xl font-bold text-success-500">{stats.active}</p>
            <p className="text-xs text-surface-400">Active</p>
          </div>
          <div className="rounded-xl border border-surface-200 bg-white p-4 dark:border-surface-800 dark:bg-surface-900">
            <p className="text-2xl font-bold text-surface-400">{stats.inactive}</p>
            <p className="text-xs text-surface-400">Inactive</p>
          </div>
          <div className="rounded-xl border border-surface-200 bg-white p-4 dark:border-surface-800 dark:bg-surface-900">
            <p className="text-2xl font-bold text-brand-500">{stats.totalMeetings}</p>
            <p className="text-xs text-surface-400">Total Meetings</p>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-surface-200 bg-white py-2 pl-9 pr-3 text-sm text-surface-800 placeholder-surface-400 focus:border-brand-500 focus:outline-none dark:border-surface-700 dark:bg-surface-800 dark:text-surface-200"
            />
          </div>
          <div className="flex gap-1 rounded-lg bg-surface-100 p-1 dark:bg-surface-800">
            {(['all', 'active', 'inactive'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  filter === f
                    ? 'bg-white text-surface-800 shadow dark:bg-surface-700 dark:text-surface-100'
                    : 'text-surface-400 hover:text-surface-600 dark:hover:text-surface-300'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Members Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-300 py-12 dark:border-surface-700">
            <Users size={48} className="mb-3 text-surface-300 dark:text-surface-600" />
            <p className="text-sm font-medium text-surface-400">No members found</p>
            <p className="text-xs text-surface-400">
              {searchQuery ? 'Try a different search' : 'Create a meeting to add members'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredMembers.map((member) => {
              const status = getStatusBadge(member);
              const isHighlighted = member.user._id === highlightUserId;

              return (
                <div
                  key={member.user._id}
                  className={`rounded-xl border bg-white p-4 transition-all dark:bg-surface-900 ${
                    isHighlighted
                      ? 'border-brand-500 ring-2 ring-brand-500/20'
                      : 'border-surface-200 hover:border-brand-500/30 dark:border-surface-800'
                  }`}
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar
                          src={(member.user as any).avatar}
                          name={member.user.name}
                          size="md"
                        />
                        {member.upcomingMeetings.length > 0 && (
                          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-success-500 dark:border-surface-900" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-surface-800 dark:text-surface-100">
                          {member.user.name}
                        </p>
                        <p className="flex items-center gap-1 text-[11px] text-surface-400">
                          <Mail size={10} />
                          {member.user.email}
                        </p>
                      </div>
                    </div>
                    <Badge tone={status.tone} className="text-[9px]">
                      {status.label}
                    </Badge>
                  </div>

                  <div className="mb-3 grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-surface-50 px-2 py-1.5 text-center dark:bg-surface-800">
                      <p className="text-sm font-bold text-surface-800 dark:text-surface-100">
                        {member.meetings.length}
                      </p>
                      <p className="text-[9px] text-surface-400">Total</p>
                    </div>
                    <div className="rounded-lg bg-surface-50 px-2 py-1.5 text-center dark:bg-surface-800">
                      <p className="text-sm font-bold text-success-500">
                        {member.upcomingMeetings.length}
                      </p>
                      <p className="text-[9px] text-surface-400">Upcoming</p>
                    </div>
                    <div className="rounded-lg bg-surface-50 px-2 py-1.5 text-center dark:bg-surface-800">
                      <p className="text-sm font-bold text-brand-500">
                        {Math.round(member.totalHours)}h
                      </p>
                      <p className="text-[9px] text-surface-400">Hours</p>
                    </div>
                  </div>

                  {member.upcomingMeetings.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold text-surface-400">Upcoming</p>
                      {member.upcomingMeetings.slice(0, 2).map((m) => (
                        <div
                          key={m._id}
                          className="flex items-center gap-2 rounded-lg bg-surface-50 px-2 py-1 dark:bg-surface-800"
                        >
                          <Calendar size={10} className="text-surface-400" />
                          <span className="truncate text-[10px] text-surface-600 dark:text-surface-400">
                            {m.title}
                          </span>
                          <span className="ml-auto text-[9px] text-surface-400">
                            {m.date}
                          </span>
                        </div>
                      ))}
                      {member.upcomingMeetings.length > 2 && (
                        <p className="text-[9px] text-surface-400">
                          +{member.upcomingMeetings.length - 2} more
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
