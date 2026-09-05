/**
 * workLogMetrics.ts — Work Log Engineering Metrics & Analytics Calculations
 */

import { WorkLog } from '@worklog/services/useWorkLogStore';
import { formatDuration } from '@shared/utils/time';

export interface CalculatedWorkMetrics {
  totalFocusMs: number;
  formattedTotalFocus: string;
  sessionCount: number;
  averageSessionMs: number;
  formattedAverageSession: string;
  longestSessionMs: number;
  formattedLongestSession: string;
  totalPauseMs: number;
  formattedPauseMs: string;
  completedCount: number;
  totalItemsCount: number;
  completionRatePercent: number;
  timelineCount: number;
  decisionCount: number;
  blockerCount: number;
  openBlockerCount: number;
}

export function calculateWorkLogMetrics(log: WorkLog): CalculatedWorkMetrics {
  const totalFocusMs = log.totalActiveMs || 0;
  const workEntries = log.workEntries || [];

  // Extract sessions count across all daily workEntries
  let sessionCount = 0;
  workEntries.forEach(entry => {
    sessionCount += entry.sessionIds?.length || (entry.activeMs > 0 ? 1 : 0);
  });

  const averageSessionMs = sessionCount > 0 ? Math.round(totalFocusMs / sessionCount) : 0;
  const longestSessionMs = workEntries.reduce((max, entry) => Math.max(max, entry.activeMs || 0), 0);

  // Estimate total pause ms from timeline or reflection metrics
  let totalPauseMs = 0;
  (log.timelineEntries || []).forEach(t => {
    if (t.type === 'timer_pause') totalPauseMs += 300000; // ~5m default estimate if not tracked
  });

  const completedCount = (log.completedItems || []).filter(i => i.done).length;
  const totalItemsCount = (log.completedItems || []).length;
  const completionRatePercent = totalItemsCount > 0 ? Math.round((completedCount / totalItemsCount) * 100) : 100;

  const timelineCount = (log.timelineEntries || []).length;
  const decisionCount = (log.decisions || []).length;
  const blockerCount = (log.blockerList || []).length;
  const openBlockerCount = (log.blockerList || []).filter(b => b.status !== 'resolved').length;

  return {
    totalFocusMs,
    formattedTotalFocus: formatDuration(totalFocusMs),
    sessionCount,
    averageSessionMs,
    formattedAverageSession: formatDuration(averageSessionMs),
    longestSessionMs,
    formattedLongestSession: formatDuration(longestSessionMs),
    totalPauseMs,
    formattedPauseMs: formatDuration(totalPauseMs),
    completedCount,
    totalItemsCount,
    completionRatePercent,
    timelineCount,
    decisionCount,
    blockerCount,
    openBlockerCount,
  };
}
