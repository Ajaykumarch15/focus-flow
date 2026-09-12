import { useRoadmapStore } from './useRoadmapStore';
import { isToday } from '@shared/utils/time';

export interface TodayMilestone {
  _id: string;
  title: string;
  description: string;
  roadmapId: string;
  phaseId: string;
  targetDate?: string;
  status: 'todo' | 'in-progress' | 'completed';
  totalTasks: number;
  completedTasks: number;
  progress: number;
  roadmapTitle: string;
  roadmapColor: string;
}

/**
 * Fetches all active roadmaps, loads their details,
 * and returns milestones whose targetDate is today.
 */
export async function fetchMilestonesDueToday(): Promise<TodayMilestone[]> {
  const { roadmaps, loadRoadmaps, getRoadmap } = useRoadmapStore.getState();

  // Ensure roadmap list is loaded
  if (roadmaps.length === 0) {
    await loadRoadmaps();
  }

  const activeRoadmaps = useRoadmapStore.getState().roadmaps.filter(
    r => r.status === 'active' || r.status === 'planning'
  );

  if (activeRoadmaps.length === 0) return [];

  const todayMilestones: TodayMilestone[] = [];

  // Fetch details for each active roadmap (typically 1-3)
  const details = await Promise.all(
    activeRoadmaps.map(rm => getRoadmap(rm._id))
  );

  for (let i = 0; i < details.length; i++) {
    const detail = details[i];
    if (!detail) continue;

    const roadmap = activeRoadmaps[i];

    for (const ms of detail.milestones) {
      if (
        ms.targetDate &&
        isToday(ms.targetDate) &&
        ms.status !== 'completed'
      ) {
        todayMilestones.push({
          _id: ms._id,
          title: ms.title,
          description: ms.description,
          roadmapId: ms.roadmapId,
          phaseId: ms.phaseId,
          targetDate: ms.targetDate,
          status: ms.status,
          totalTasks: ms.totalTasks,
          completedTasks: ms.completedTasks,
          progress: ms.progress,
          roadmapTitle: roadmap.title,
          roadmapColor: roadmap.color,
        });
      }
    }
  }

  return todayMilestones;
}
