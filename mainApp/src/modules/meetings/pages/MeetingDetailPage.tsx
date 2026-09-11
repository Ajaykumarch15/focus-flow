import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMeetingStore } from '../services/useMeetingStore';
import { MeetingDetailPanel } from '../components/MeetingDetailPanel';
import { Spinner } from '@shared/components/ui/Spinner';

export function MeetingDetailPage() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();
  const { selectedMeeting, loading, fetchMeeting } = useMeetingStore();

  useEffect(() => {
    if (meetingId) {
      fetchMeeting(meetingId);
    }
  }, [meetingId, fetchMeeting]);

  if (loading && !selectedMeeting) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  if (!selectedMeeting) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        <p className="text-sm text-surface-400">Meeting not found</p>
        <button
          onClick={() => navigate('/meetings')}
          className="text-sm font-semibold text-brand-500 hover:underline"
        >
          Back to meetings
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-surface-50 dark:bg-surface-950">
      <MeetingDetailPanel
        meeting={selectedMeeting}
        onClose={() => navigate(-1)}
      />
    </div>
  );
}
