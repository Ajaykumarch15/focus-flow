import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'ff_work_hours';

interface WorkHours {
  startHour: number;
  endHour: number;
}

const DEFAULT_WORK_HOURS: WorkHours = { startHour: 8, endHour: 20 };

function loadWorkHours(): WorkHours {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed.startHour === 'number' && typeof parsed.endHour === 'number') {
        return parsed;
      }
    }
  } catch {}
  return DEFAULT_WORK_HOURS;
}

function saveWorkHours(hours: WorkHours): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(hours));
}

export function useWorkHours() {
  const [workHours, setWorkHoursState] = useState<WorkHours>(loadWorkHours);

  useEffect(() => {
    setWorkHoursState(loadWorkHours());
  }, []);

  const setWorkHours = useCallback((startHour: number, endHour: number) => {
    const clamped = {
      startHour: Math.max(0, Math.min(23, startHour)),
      endHour: Math.max(1, Math.min(24, endHour)),
    };
    if (clamped.startHour >= clamped.endHour) return;
    setWorkHoursState(clamped);
    saveWorkHours(clamped);
  }, []);

  const totalWorkingMinutes = (workHours.endHour - workHours.startHour) * 60;
  const startMinutes = workHours.startHour * 60;
  const endMinutes = workHours.endHour * 60;

  return {
    workHours,
    setWorkHours,
    totalWorkingMinutes,
    startMinutes,
    endMinutes,
  };
}
