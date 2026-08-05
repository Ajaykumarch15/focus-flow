import type { Mood } from '../types';

// ── S2-T3: Focus completion prompt helpers (ECIS §B.3 · DCX §17:30) ───────────
// Pure, side-effect free helpers for the optional completion prompt that closes
// the focus loop: task → done → one lightweight reflection (went well / slowed
// you / learned) plus a completed item on the linked work log. The prompt is
// optional — the helper set never touches the network or the clock, so tests
// stay deterministic. Composition feeds addJournal; the completed item title
// feeds workLogs.addCompleted.

export interface ReflectionDraft {
  wentWell: string;
  slowedDown: string;
  learned: string;
}

export type JournalReflectionEntry = Omit<JournalEntryLike, 'id' | 'createdAt' | 'updatedAt'>;

type JournalEntryLike = {
  id: string;
  taskId: string;
  content: string;
  mood: Mood;
  focusRating: number;
  createdAt: number;
  updatedAt: number;
};

const SECTION_LABELS: Array<[keyof ReflectionDraft, string]> = [
  ['wentWell', 'What went well'],
  ['slowedDown', 'What slowed you down'],
  ['learned', 'What you learned'],
];

export function isReflectionEmpty(draft: ReflectionDraft): boolean {
  return draft.wentWell.trim() === '' && draft.slowedDown.trim() === '' && draft.learned.trim() === '';
}

export function composeReflection(draft: ReflectionDraft): string {
  const sections = SECTION_LABELS
    .map(([key, label]) => {
      const value = draft[key].trim();
      return value === '' ? null : `${label}: ${value}`;
    })
    .filter((section): section is string => section !== null);
  return sections.join('\n');
}

export function buildJournalEntry(
  draft: ReflectionDraft,
  taskId: string,
  mood: Mood,
  focusRating: number,
): JournalReflectionEntry {
  return {
    taskId,
    content: composeReflection(draft),
    mood,
    focusRating,
  };
}

export function buildCompletedItemTitle(taskTitle: string, trackedLabel?: string): string {
  const title = taskTitle.trim();
  if (trackedLabel && trackedLabel.trim() !== '') {
    return `${title} (${trackedLabel.trim()})`;
  }
  return title;
}
