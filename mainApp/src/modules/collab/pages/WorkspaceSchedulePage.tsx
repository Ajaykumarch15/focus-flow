import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Users,
  CalendarDays,
  List,
} from 'lucide-react';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { useWorkspaceScheduleStore } from '@collab/services/useWorkspaceScheduleStore';
import { useScheduleStore } from '@worklog/services/useScheduleStore';
import { useWorkspaceId } from '@collab/hooks/useWorkspaceId';
import { cn } from '@shared/utils/cn';
import { Button } from '@shared/components/ui/Button';
import { Spinner } from '@shared/components/ui/Spinner';
import { TeamScheduleGrid } from '@collab/components/schedule/TeamScheduleGrid';
import { ScheduleMemberFilter } from '@collab/components/schedule/ScheduleMemberFilter';
import { ScheduleModal } from '@personal/components/schedule/ScheduleModal';
import { getTodayDateString } from '@collab/services/useWorkspaceScheduleStore';
import type { ScheduleItem } from '@shared/types';

const fadeUp = { hidden: { opacity: 0, y: -6 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } };

function shiftDate(dateStr: string, offsetDays: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function getWeekDates(dateStr: string): string[] {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    return `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}-${String(dd.getDate()).padStart(2, '0')}`;
  });
}

export function WorkspaceSchedulePage() {
  const workspaceId = useWorkspaceId();
  const {
    members,
    projects,
    loadMembers,
    loadProjects,
  } = useCollaborationStore();

  const {
    schedules,
    selectedDate,
    viewMode,
    selectedUserIds,
    loading,
    fetchTeamSchedules,
    setSelectedDate,
    setViewMode,
    setSelectedUserIds,
  } = useWorkspaceScheduleStore();

  const { isModalOpen, closeModal } = useScheduleStore();
  const openModal = useScheduleStore((s) => s.openModal);

  const [projectFilter, setProjectFilter] = useState<string>('all');

  useEffect(() => {
    if (!workspaceId) return;
    loadMembers(workspaceId);
    loadProjects(workspaceId);
  }, [workspaceId, loadMembers, loadProjects]);

  useEffect(() => {
    if (!workspaceId) return;
    if (viewMode === 'day') {
      fetchTeamSchedules(workspaceId, selectedDate);
    } else {
      const weekDates = getWeekDates(selectedDate);
      fetchTeamSchedules(workspaceId, undefined, weekDates[0], weekDates[6]);
    }
  }, [workspaceId, selectedDate, viewMode, fetchTeamSchedules]);

  const displayMembers = useMemo(() => {
    let filtered = members;
    if (projectFilter !== 'all') {
      const project = projects.find((p) => p.id === projectFilter);
      if (project) {
        const memberIds = new Set(project.members.map((m) => m.userId));
        filtered = members.filter((m) => memberIds.has(m.id));
      }
    }
    if (selectedUserIds.length > 0) {
      filtered = filtered.filter((m) => selectedUserIds.includes(m.id));
    }
    return filtered;
  }, [members, projects, projectFilter, selectedUserIds]);

  const dateLabel = useMemo(() => {
    if (viewMode === 'day') return formatDateLabel(selectedDate);
    const weekDates = getWeekDates(selectedDate);
    return `${formatDateLabel(weekDates[0])} — ${formatDateLabel(weekDates[6])}`;
  }, [selectedDate, viewMode]);

  const handlePrev = useCallback(() => {
    setSelectedDate(shiftDate(selectedDate, viewMode === 'day' ? -1 : -7));
  }, [selectedDate, viewMode, setSelectedDate]);

  const handleNext = useCallback(() => {
    setSelectedDate(shiftDate(selectedDate, viewMode === 'day' ? 1 : 7));
  }, [selectedDate, viewMode, setSelectedDate]);

  const handleToday = useCallback(() => {
    setSelectedDate(getTodayDateString());
  }, [setSelectedDate]);

  const handleSlotClick = useCallback((_memberId: string, _date: string, _startTime: string) => {
    openModal();
  }, [openModal]);

  const handleScheduleClick = useCallback((schedule: ScheduleItem) => {
    const taskId = typeof schedule.taskId === 'string' ? schedule.taskId : schedule.taskId?.id;
    openModal(taskId || undefined, schedule);
  }, [openModal]);

  return (
    <div className="min-h-screen bg-surface-950 relative overflow-x-hidden overflow-y-auto">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-500/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-cyan-500/8 rounded-full blur-3xl pointer-events-none" />

      <header className="sticky top-0 z-20 bg-surface-950/80 backdrop-blur-xl border-b border-surface-800/60">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl overflow-hidden shadow-md shadow-brand-500/10">
              <img src="/darkicon.png" alt="FocusFlow" className="w-full h-full object-cover dark:hidden" />
              <img src="/darkicon.png" alt="FocusFlow" className="w-full h-full object-cover hidden dark:block" />
            </div>
            <div>
              <h1 className="font-display font-bold text-sm leading-none text-surface-50">Team Schedule</h1>
              <p className="text-[10px] text-surface-400 mt-0.5">See who's working on what, when</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-900 border border-surface-800 text-xs">
              <Users size={12} className="text-sky-400" />
              <span className="text-surface-300 font-medium">{displayMembers.length} members</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 relative z-10">
        <div className="space-y-5">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div>
              <h2 className="text-2xl font-display font-extrabold text-surface-50 tracking-tight">
                Schedule
              </h2>
              <p className="text-sm text-surface-400 mt-0.5">{dateLabel}</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.05 }}
            className="flex flex-col sm:flex-row items-start sm:items-center gap-3"
          >
            <div className="flex items-center gap-1.5">
              <Button variant="secondary" size="sm" onClick={handlePrev}>
                <ChevronLeft size={14} />
              </Button>
              <Button variant="secondary" size="sm" onClick={handleToday}>
                Today
              </Button>
              <Button variant="secondary" size="sm" onClick={handleNext}>
                <ChevronRight size={14} />
              </Button>
            </div>

            <div className="flex gap-1 rounded-lg bg-surface-100 p-1 dark:bg-surface-800">
              {(['day', 'week'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                    viewMode === mode
                      ? 'bg-white text-surface-800 shadow dark:bg-surface-700 dark:text-surface-100'
                      : 'text-surface-400 hover:text-surface-600 dark:hover:text-surface-300',
                  )}
                >
                  {mode === 'day' ? <CalendarDays size={13} /> : <List size={13} />}
                  {mode === 'day' ? 'Day' : 'Week'}
                </button>
              ))}
            </div>

            {projects.length > 0 && (
              <div className="relative">
                <select
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                  className="appearance-none bg-surface-900 border border-surface-800 focus:border-brand-500/50 rounded-xl pl-3 pr-9 py-2.5 text-xs font-medium text-surface-300 outline-none transition-colors cursor-pointer"
                >
                  <option value="all">All Projects</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.1 }}
          >
            <ScheduleMemberFilter
              members={members}
              selectedIds={selectedUserIds}
              onChange={setSelectedUserIds}
            />
          </motion.div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Spinner size={32} />
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.15 }}
            >
              {viewMode === 'day' ? (
                <TeamScheduleGrid
                  members={displayMembers}
                  schedules={schedules}
                  onSlotClick={handleSlotClick}
                  onScheduleClick={handleScheduleClick}
                  selectedDate={selectedDate}
                />
              ) : (
                <div className="space-y-4">
                  {getWeekDates(selectedDate).map((date) => (
                    <div key={date}>
                      <p className="text-xs font-semibold text-surface-300 mb-2">{formatDateLabel(date)}</p>
                      <TeamScheduleGrid
                        members={displayMembers}
                        schedules={schedules}
                        onSlotClick={handleSlotClick}
                        onScheduleClick={handleScheduleClick}
                        selectedDate={date}
                      />
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </main>

      <ScheduleModal isOpen={isModalOpen} onClose={closeModal} />
    </div>
  );
}
