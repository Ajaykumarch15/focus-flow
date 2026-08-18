export interface HeatmapDay {
  date: string;
  value: number;
}

export function calculateStreak(dailyHours: Record<string, number>): { current: number; activeDays: string[] } {
  const dates = Object.keys(dailyHours).filter(d => dailyHours[d] > 0).sort().reverse();
  if (dates.length === 0) return { current: 0, activeDays: [] };

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let checkDate = new Date(today);

  for (let i = 0; i < 365; i++) {
    const key = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
    if (dailyHours[key] && dailyHours[key] > 0) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (i === 0) {
      checkDate.setDate(checkDate.getDate() - 1);
      continue;
    } else {
      break;
    }
  }

  return { current: streak, activeDays: dates.slice(0, 7) };
}

export function buildHeatmapData(dailyHours: Record<string, number>, days: number): HeatmapDay[] {
  const result: HeatmapDay[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    result.push({ date: key, value: dailyHours[key] || 0 });
  }

  return result;
}

export function getHeatmapLevel(value: number, max: number): number {
  if (max === 0 || value === 0) return 0;
  const ratio = value / max;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

export function calculateGoalAchievement(totalMs: number, goalMs: number, days: number): { percentage: number; daysMet: number; totalDays: number } {
  if (goalMs <= 0) return { percentage: 0, daysMet: 0, totalDays: days };
  const percentage = Math.min(100, Math.round((totalMs / goalMs) * 100));
  return { percentage, daysMet: Math.round((totalMs / goalMs)), totalDays: days };
}

export function calculatePeriodComparison(currentMs: number, previousMs: number): { diff: number; pct: number; direction: 'up' | 'down' | 'flat' } {
  const diff = currentMs - previousMs;
  const pct = previousMs > 0 ? ((diff / previousMs) * 100) : (currentMs > 0 ? 100 : 0);
  return {
    diff,
    pct: Math.round(pct * 10) / 10,
    direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat',
  };
}

export function generateInsights(data: {
  totalMs: number;
  prevTotalMs: number;
  sessionsCount: number;
  tasksCompleted: number;
  avgSessionMs: number;
  goalMs: number;
  activeDays: number;
  totalDays: number;
}): string[] {
  const insights: string[] = [];

  if (data.prevTotalMs > 0) {
    const change = ((data.totalMs - data.prevTotalMs) / data.prevTotalMs) * 100;
    if (Math.abs(change) > 5) {
      insights.push(
        `Your focus time ${change > 0 ? 'increased' : 'decreased'} ${Math.abs(change).toFixed(0)}% compared to the previous period.`
      );
    }
  }

  if (data.avgSessionMs > 0) {
    const mins = Math.round(data.avgSessionMs / 60000);
    insights.push(`Your average focus session was ${mins} minutes.`);
  }

  if (data.goalMs > 0 && data.totalMs > 0) {
    const goalPct = Math.round((data.totalMs / data.goalMs) * 100);
    insights.push(`You achieved ${goalPct}% of your focus goal.`);
  }

  if (data.activeDays > 0 && data.totalDays > 0) {
    insights.push(`You were active on ${data.activeDays} of ${data.totalDays} days.`);
  }

  if (data.tasksCompleted > 0) {
    insights.push(`You completed ${data.tasksCompleted} task${data.tasksCompleted > 1 ? 's' : ''}.`);
  }

  return insights;
}
