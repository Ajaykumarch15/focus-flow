import { useState, useEffect, useRef } from 'react';

export function useMeetingTimer(startTime: string, date: string, isActive: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isActive) {
      setElapsed(0);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const calculateElapsed = () => {
      const now = new Date();
      const [hours, minutes] = startTime.split(':').map(Number);
      const meetingStart = new Date(date);
      meetingStart.setHours(hours, minutes, 0, 0);

      const diff = Math.max(0, now.getTime() - meetingStart.getTime());
      setElapsed(Math.floor(diff / 1000));
    };

    calculateElapsed();
    intervalRef.current = setInterval(calculateElapsed, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [startTime, date, isActive]);

  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;

  const formatted = hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return { elapsed, formatted, hours, minutes, seconds };
}
