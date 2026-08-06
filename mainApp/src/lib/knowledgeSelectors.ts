import type { KnowledgeDoc } from '../types/collaboration';
import type { WorkLog, DecisionItem, WorkLink } from '../store/useWorkLogStore';
import type { JournalEntry } from '../types';

// ── S3-T2: pure Knowledge selector (ECIS §B.5 · DCX "What do we already know?") ──
// The Knowledge surface is a read-only projection of knowledge the developer
// has ALREADY captured: workspace knowledge docs, work-log decisions, work-log
// lessons-learned, and work-log saved links. Every group is derived from real
// store state — no AI summaries, no invented decisions, no fabricated context.
//   - docs      → the store's KnowledgeDoc[] (team/personal docs)
//   - decisions → every DecisionItem across work logs, newest first
//   - lessons   → non-blank problemFlow.lessonsLearned, newest first
//   - links     → every saved WorkLink across work logs
//   - journalCount → real personal journal entries (cross-layer context; the
//     future AI hook (§B.5) answers natural-language Q&A over journals + docs +
//     work logs, so the surface already tracks how much personal context exists)
// Pure: same inputs always produce the same view; no Date.now(), no sorting by
// wall clock, no side effects. `filterKnowledge` is the single search contract,
// so the search box never re-implements matching logic.

export interface KnowledgeDecision {
  id: string;
  logId: string;
  logTitle: string;
  title: string;
  decision: string;
  rationale: string;
  timestamp: number;
}

export interface KnowledgeLesson {
  id: string;
  logId: string;
  logTitle: string;
  lesson: string;
  timestamp: number;
}

export interface KnowledgeLink {
  id: string;
  logId: string;
  logTitle: string;
  label: string;
  url: string;
  category: string;
}

export interface KnowledgeView {
  docs: KnowledgeDoc[];
  decisions: KnowledgeDecision[];
  lessons: KnowledgeLesson[];
  links: KnowledgeLink[];
  journalCount: number;
  total: number;
}

function logTimestamp(log: WorkLog): number {
  return Date.parse(log.updatedAt) || Date.parse(log.createdAt) || 0;
}

export function selectKnowledge(docs: KnowledgeDoc[], workLogs: WorkLog[], journals: JournalEntry[]): KnowledgeView {
  const docItems: KnowledgeDoc[] = [...docs].sort((a, b) => {
    const t = (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '');
    return t !== 0 ? t : (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
  });

  const decisions: KnowledgeDecision[] = workLogs
    .flatMap((log) =>
      (log.decisions ?? []).map((d: DecisionItem) => ({
        id: `${log._id}:${d._id}`,
        logId: log._id,
        logTitle: log.title,
        title: d.title,
        decision: d.decision,
        rationale: d.rationale,
        timestamp: d.timestamp,
      })),
    )
    .sort((a, b) => b.timestamp - a.timestamp);

  const lessons: KnowledgeLesson[] = workLogs
    .filter((log) => (log.problemFlow?.lessonsLearned ?? '').trim() !== '')
    .map((log) => ({
      id: log._id,
      logId: log._id,
      logTitle: log.title,
      lesson: log.problemFlow.lessonsLearned,
      timestamp: logTimestamp(log),
    }))
    .sort((a, b) => b.timestamp - a.timestamp);

  const links: KnowledgeLink[] = workLogs
    .flatMap((log) =>
      (log.links ?? []).map((link: WorkLink) => ({
        id: `${log._id}:${link._id}`,
        logId: log._id,
        logTitle: log.title,
        label: link.label,
        url: link.url,
        category: link.category,
        _sort: logTimestamp(log),
      })),
    )
    .sort((a, b) => b._sort - a._sort || a.label.localeCompare(b.label))
    .map(({ _sort, ...item }) => item);

  const total = docItems.length + decisions.length + lessons.length + links.length;

  return {
    docs: docItems,
    decisions,
    lessons,
    links,
    journalCount: journals.length,
    total,
  };
}

function has(text: string, q: string): boolean {
  return text.toLowerCase().includes(q);
}

export function filterKnowledge(view: KnowledgeView, query: string): KnowledgeView {
  const q = query.trim().toLowerCase();
  if (!q) return view;

  const docs = view.docs.filter(
    (d) =>
      has(d.title, q) ||
      has(d.category, q) ||
      has(d.content, q) ||
      d.tags.some((t) => has(t, q)),
  );

  const decisions = view.decisions.filter(
    (d) =>
      has(d.title, q) ||
      has(d.decision, q) ||
      has(d.rationale, q) ||
      has(d.logTitle, q),
  );

  const lessons = view.lessons.filter((l) => has(l.lesson, q) || has(l.logTitle, q));

  const links = view.links.filter(
    (l) =>
      has(l.label, q) ||
      has(l.url, q) ||
      has(l.category, q) ||
      has(l.logTitle, q),
  );

  return {
    ...view,
    docs,
    decisions,
    lessons,
    links,
    total: docs.length + decisions.length + lessons.length + links.length,
  };
}
