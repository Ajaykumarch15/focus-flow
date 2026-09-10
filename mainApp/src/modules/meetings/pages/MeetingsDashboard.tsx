import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMeetingStore } from '../services/useMeetingStore';
import { ActiveCallBanner } from '../components/ActiveCallBanner';
import { UpcomingMeetingsList } from '../components/UpcomingMeetingsList';
import { NextMeetingsPanel } from '../components/NextMeetingsPanel';
import { MeetingMembersList } from '../components/MeetingMembersList';
import { CreateMeetingModal } from '../components/CreateMeetingModal';
import { Button } from '@shared/components/ui/Button';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export function MeetingsDashboard() {
  const navigate = useNavigate();
  const {
    todayMeetings,
    meetings,
    activeMeeting,
    isCreateModalOpen,
    fetchTodayMeetings,
    fetchMeetings,
    updateStatus,
    setActiveMeeting,
    openCreateModal,
    closeCreateModal,
  } = useMeetingStore();

  useEffect(() => {
    fetchTodayMeetings();
    fetchMeetings({ from: todayStr() });
  }, [fetchTodayMeetings, fetchMeetings]);

  const active = todayMeetings.find((m) => m.status === 'in_progress') || activeMeeting;
  const upcoming = todayMeetings.filter((m) => m.status === 'scheduled' || m.status === 'confirmed');
  const nextMeeting = meetings.find((m) => m.status === 'scheduled' || m.status === 'confirmed');

  const handleConfirm = async (meetingId: string) => {
    await updateStatus(meetingId, 'confirmed');
  };

  const handleJoin = (meeting: any) => {
    if (meeting.meetingLink) {
      window.open(`https://${meeting.meetingLink}`, '_blank');
    }
  };

  const handleStop = async () => {
    if (active) {
      await updateStatus(active._id, 'completed');
      setActiveMeeting(null);
    }
  };

  const handleCancel = async (meetingId: string) => {
    await updateStatus(meetingId, 'cancelled');
  };

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-surface-800 dark:text-surface-100">
              Today's Meetings
            </h1>
            <p className="mt-1 text-sm text-surface-400">{formatDateDisplay(todayStr())}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => navigate('/meetings/members')}
              leftIcon={<span className="text-sm">👥</span>}
            >
              Members
            </Button>
            <Button onClick={openCreateModal} leftIcon={<span className="text-lg">+</span>}>
              New Meeting
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {active && (
              <ActiveCallBanner
                meeting={active}
                onStop={handleStop}
                onJoin={() => handleJoin(active)}
              />
            )}

            <div>
              <h2 className="mb-3 text-lg font-bold text-surface-800 dark:text-surface-100">
                Upcoming Meetings
              </h2>
              <UpcomingMeetingsList
                meetings={upcoming}
                onMeetingClick={(m) => navigate(`/meetings/${m._id}`)}
                onConfirm={handleConfirm}
                onJoin={handleJoin}
              />
            </div>
          </div>

          <div className="space-y-6">
            <NextMeetingsPanel
              meeting={nextMeeting || null}
              onCancel={handleCancel}
              onJoin={handleJoin}
            />

            <MeetingMembersList
              meetings={meetings}
              onMemberClick={(userId) => navigate(`/meetings/members?highlight=${userId}`)}
            />
          </div>
        </div>
      </div>

      <CreateMeetingModal open={isCreateModalOpen} onClose={closeCreateModal} />
    </div>
  );
}
