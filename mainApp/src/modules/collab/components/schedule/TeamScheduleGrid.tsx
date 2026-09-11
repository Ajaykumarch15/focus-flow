import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Avatar } from '@shared/components/ui/Avatar';
import { START_HOUR, END_HOUR, HOUR_HEIGHT } from '@worklog/types/calendar';
import { timeToMinutes } from '@worklog/services/scheduleAnalytics';
import { getRoleDisplayName } from '@collab/utils/roleDisplay';
import type { ScheduleItem } from '@shared/types';
import type { WorkspaceMember } from '@collab/types/collaboration';

interface MemberSchedule {
  member: WorkspaceMember;
  schedules: ScheduleItem[];
}

interface TeamScheduleGridProps {
  members: WorkspaceMember[];
  schedules: ScheduleItem[];
  onSlotClick: (memberId: string, date: string, startTime: string) => void;
  onScheduleClick: (schedule: ScheduleItem) => void;
  selectedDate: string;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-sky-500/20 border-sky-500/30 text-sky-300',
  'in-progress': 'bg-amber-500/20 border-amber-500/30 text-amber-300',
  completed: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300',
  missed: 'bg-red-500/20 border-red-500/30 text-red-300',
  cancelled: 'bg-surface-700/30 border-surface-600/30 text-surface-400',
};

function getMemberUserId(member: WorkspaceMember): string {
  return member.id;
}

export function TeamScheduleGrid({
  members,
  schedules,
  onSlotClick,
  onScheduleClick,
  selectedDate,
}: TeamScheduleGridProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const totalHeight = (END_HOUR - START_HOUR + 1) * HOUR_HEIGHT;

  const currentTimeTop = useMemo(() => {
    const d = new Date(now);
    const mins = d.getHours() * 60 + d.getMinutes();
    if (mins < START_HOUR * 60 || mins > END_HOUR * 60) return null;
    return (mins - START_HOUR * 60) * (HOUR_HEIGHT / 60);
  }, [now]);

  const todayDateStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const memberSchedules = useMemo<MemberSchedule[]>(() => {
    return members.map((member) => {
      const userId = getMemberUserId(member);
      const memberSch = schedules.filter((s) => {
        const schedUserId = typeof s.userId === 'object' ? s.userId._id?.toString() : s.userId?.toString();
        return schedUserId === userId && s.date === selectedDate && s.status !== 'cancelled';
      });
      return { member, schedules: memberSch };
    });
  }, [members, schedules, selectedDate]);

  const handleSlotClick = useCallback(
    (memberId: string, hour: number) => {
      const startTime = `${String(hour).padStart(2, '0')}:00`;
      onSlotClick(memberId, selectedDate, startTime);
    },
    [onSlotClick, selectedDate],
  );

  const isToday = selectedDate === todayDateStr;

  if (members.length === 0) {
    return (
      <div className="border border-dashed border-surface-700 rounded-2xl bg-surface-900/60 p-12 text-center">
        <p className="text-sm text-surface-400">No team members to display.</p>
      </div>
    );
  }

  return (
    <div className="border border-surface-800/60 rounded-2xl bg-surface-900 overflow-hidden">
      {/* Member headers */}
      <div className="flex border-b border-surface-800/60 sticky top-0 z-10 bg-surface-900">
        <div className="w-16 shrink-0 border-r border-surface-800/60" />
        {memberSchedules.map(({ member }) => (
          <div
            key={getMemberUserId(member)}
            className="flex-1 min-w-[120px] border-r border-surface-800/40 last:border-r-0 px-3 py-2.5 flex items-center gap-2"
          >
            <Avatar
              src={member.avatar}
              name={member.name}
              size="sm"
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-surface-100 truncate">{member.name}</p>
              <p className="text-[10px] text-surface-500 truncate">{getRoleDisplayName(member.role)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Grid body */}
      <div className="flex overflow-y-auto" style={{ maxHeight: 640 }}>
        {/* Time axis */}
        <div className="w-16 shrink-0 border-r border-surface-800/60">
          {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i).map((hour) => (
            <div
              key={hour}
              className="border-t border-surface-800/40 flex items-start justify-end pr-2 pt-1"
              style={{ height: HOUR_HEIGHT }}
            >
              <span className="text-[10px] font-medium text-surface-500">
                {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
              </span>
            </div>
          ))}
        </div>

        {/* Member columns */}
        <div className="flex-1 grid relative" style={{ gridTemplateColumns: `repeat(${members.length}, minmax(120px, 1fr))` }}>
          {/* Hour grid lines */}
          {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i).map((hour) => (
            <div
              key={hour}
              className="absolute left-0 right-0 border-t border-surface-800/40"
              style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
            />
          ))}

          {/* Member columns with schedules */}
          {memberSchedules.map(({ member, schedules: memberSch }) => {
            const memberId = getMemberUserId(member);
            return (
              <div
                key={memberId}
                className="relative border-r border-surface-800/40 last:border-r-0"
                style={{ height: totalHeight }}
              >
                {/* Hour click zones */}
                {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i).map((hour) => (
                  <div
                    key={hour}
                    role="button"
                    tabIndex={0}
                    aria-label={`Schedule at ${hour}:00 for ${member.name}`}
                    className="absolute left-0 right-0 cursor-pointer hover:bg-brand-500/5 transition-colors"
                    style={{ top: (hour - START_HOUR) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                    onClick={() => handleSlotClick(memberId, hour)}
                  />
                ))}

                {/* Schedule cards */}
                {memberSch.map((schedule) => {
                  const startMins = timeToMinutes(schedule.startTime);
                  const endMins = timeToMinutes(schedule.endTime);
                  const top = (startMins - START_HOUR * 60) * (HOUR_HEIGHT / 60);
                  const height = Math.max((endMins - startMins) * (HOUR_HEIGHT / 60), 24);
                  const taskTitle =
                    typeof schedule.taskId === 'object' && schedule.taskId !== null
                      ? (schedule.taskId as any).title
                      : 'Task';
                  const colorClass = STATUS_COLORS[schedule.status] || STATUS_COLORS.scheduled;

                  return (
                    <motion.button
                      key={schedule._id}
                      type="button"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onScheduleClick(schedule);
                      }}
                      className={`absolute left-0.5 right-0.5 rounded-lg border px-2 py-1 text-left cursor-pointer overflow-hidden hover:brightness-110 transition-all ${colorClass}`}
                      style={{ top, height: Math.max(height, 28) }}
                    >
                      <p className="text-[10px] font-semibold leading-tight truncate">{taskTitle}</p>
                      {height > 32 && (
                        <p className="text-[9px] opacity-70 mt-0.5">
                          {schedule.startTime} - {schedule.endTime}
                        </p>
                      )}
                    </motion.button>
                  );
                })}

                {/* Current time indicator */}
                {isToday && currentTimeTop !== null && (
                  <div
                    className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                    style={{ top: currentTimeTop }}
                  >
                    <div className="w-2 h-2 rounded-full bg-brand-500 -ml-1 shrink-0" />
                    <div className="flex-1 h-[2px] bg-brand-500" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
