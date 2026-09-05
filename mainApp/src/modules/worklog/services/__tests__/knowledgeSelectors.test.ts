import { describe, it, expect } from 'vitest';
import { selectKnowledge, filterKnowledge, type KnowledgeView } from '../knowledgeSelectors';
import type { KnowledgeDoc } from '@collab/types/collaboration';
import type { WorkLog } from '@worklog/services/useWorkLogStore';
import type { JournalEntry } from '@shared/types';

// ── Factories (honest, minimal) ───────────────────────────────────────────────

function mkDoc(id: string, overrides: Partial<KnowledgeDoc> = {}): KnowledgeDoc {
  return {
    id,
    workspaceId: 'ws-1',
    title: `Doc ${id}`,
    category: 'Architecture',
    content: 'plain markdown body',
    authorId: 'u-1',
    version: 1,
    tags: [],
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  };
}

function mkLog(id: string, overrides: Partial<WorkLog> = {}): WorkLog {
  return {
    _id: id,
    title: `Log ${id}`,
    status: 'in-progress',
    isActive: true,
    updatedAt: '2026-01-05T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    problemFlow: {
      problem: '',
      investigation: '',
      rootCause: '',
      solution: '',
      lessonsLearned: '',
    },
    decisions: [],
    links: [],
    blockerList: [],
    workEntries: [],
    timelineEntries: [],
    completedItems: [],
    progressSnapshots: [],
    attachments: [],
    gitRef: { repository: '', branch: '', commitIds: [], prNumber: '', issueNumber: '' },
    tomorrowPlan: { topPriority: '', unfinishedItems: [], attentionRequired: '' },
    reflection: { wentWell: '', slowedDown: '', learned: '', improvement: '', rating: 0 },
    moodMetrics: { energy: 0, focus: 0, stress: 0, confidence: 0, motivation: 0 },
    mood: 3,
    tags: [],
    totalActiveMs: 0,
    ...overrides,
  } as WorkLog;
}

function mkJournal(id: string): JournalEntry {
  return { id, taskId: 't-1', content: 'reflection', mood: 4, focusRating: 3, createdAt: Date.now(), updatedAt: Date.now() };
}

// ── selectKnowledge ───────────────────────────────────────────────────────────

describe('selectKnowledge (S3-T2 grouping)', () => {
  it('groups docs, decisions, lessons, and links from real data', () => {
    const docs = [mkDoc('d-1', { category: 'API Documentation' })];
    const logs = [
      mkLog('l-1', {
        title: 'Ship API client',
        decisions: [
          { _id: 'dec-1', title: 'Use fetch', context: '', decision: 'native fetch', alternatives: '', rationale: 'no deps', timestamp: 300 },
        ],
        problemFlow: { problem: '', investigation: '', rootCause: '', solution: '', lessonsLearned: 'Types save time' },
        links: [{ _id: 'ln-1', label: 'PR #7', url: 'https://example.com/pr7', category: 'GitHub' }],
      }),
    ];
    const journals = [mkJournal('j-1'), mkJournal('j-2')];

    const view = selectKnowledge(docs, logs, journals);

    expect(view.docs).toHaveLength(1);
    expect(view.docs[0]).toMatchObject({ id: 'd-1', title: 'Doc d-1', category: 'API Documentation' });

    expect(view.decisions).toHaveLength(1);
    expect(view.decisions[0]).toMatchObject({
      id: 'l-1:dec-1',
      logId: 'l-1',
      logTitle: 'Ship API client',
      title: 'Use fetch',
      decision: 'native fetch',
      rationale: 'no deps',
      timestamp: 300,
    });

    expect(view.lessons).toHaveLength(1);
    expect(view.lessons[0]).toMatchObject({ id: 'l-1', logTitle: 'Ship API client', lesson: 'Types save time' });

    expect(view.links).toHaveLength(1);
    expect(view.links[0]).toMatchObject({ id: 'l-1:ln-1', label: 'PR #7', url: 'https://example.com/pr7', category: 'GitHub' });

    expect(view.journalCount).toBe(2);
    expect(view.total).toBe(4);
  });

  it('skips blank lessons so only real captured lessons surface', () => {
    const logs = [
      mkLog('l-1', { problemFlow: { problem: '', investigation: '', rootCause: '', solution: '', lessonsLearned: '   ' } }),
      mkLog('l-2', { problemFlow: { problem: '', investigation: '', rootCause: '', solution: '', lessonsLearned: 'Redo it once, not twice' } }),
      mkLog('l-3'),
    ];
    const view = selectKnowledge([], logs, []);
    expect(view.lessons).toHaveLength(1);
    expect(view.lessons[0].logId).toBe('l-2');
  });

  it('sorts decisions newest-first across every log', () => {
    const logs = [
      mkLog('l-1', { decisions: [{ _id: 'd1', title: 'old', context: '', decision: '', alternatives: '', rationale: '', timestamp: 100 }] }),
      mkLog('l-2', { decisions: [{ _id: 'd2', title: 'new', context: '', decision: '', alternatives: '', rationale: '', timestamp: 900 }] }),
      mkLog('l-3', { decisions: [{ _id: 'd3', title: 'mid', context: '', decision: '', alternatives: '', rationale: '', timestamp: 500 }] }),
    ];
    const view = selectKnowledge([], logs, []);
    expect(view.decisions.map((d) => d.title)).toEqual(['new', 'mid', 'old']);
  });

  it('sorts docs by updatedAt descending', () => {
    const docs = [
      mkDoc('a', { updatedAt: '2026-01-01' }),
      mkDoc('b', { updatedAt: '2026-03-01' }),
      mkDoc('c', { updatedAt: '2026-02-01' }),
    ];
    const view = selectKnowledge(docs, [], []);
    expect(view.docs.map((d) => d.id)).toEqual(['b', 'c', 'a']);
  });

  it('flattens links across logs and sorts by log recency', () => {
    const logs = [
      mkLog('old', {
        updatedAt: '2026-01-01T00:00:00.000Z',
        links: [{ _id: 'l1', label: 'a-pr', url: 'https://a', category: 'General' }],
      }),
      mkLog('new', {
        updatedAt: '2026-02-01T00:00:00.000Z',
        links: [{ _id: 'l2', label: 'b-pr', url: 'https://b', category: 'GitHub' }],
      }),
    ];
    const view = selectKnowledge([], logs, []);
    expect(view.links.map((l) => l.logId)).toEqual(['new', 'old']);
  });

  it('returns an honest empty view when nothing is captured', () => {
    const view = selectKnowledge([], [], []);
    expect(view.docs).toEqual([]);
    expect(view.decisions).toEqual([]);
    expect(view.lessons).toEqual([]);
    expect(view.links).toEqual([]);
    expect(view.journalCount).toBe(0);
    expect(view.total).toBe(0);
  });
});

// ── filterKnowledge ───────────────────────────────────────────────────────────

describe('filterKnowledge (S3-T2 search)', () => {
  function populatedView(): KnowledgeView {
    return selectKnowledge(
      [
        mkDoc('d-1', { title: 'Auth flow', category: 'Architecture', content: 'JWT refresh', tags: ['auth'] }),
        mkDoc('d-2', { title: 'Billing', category: 'Meeting Notes', content: 'pricing tiers', tags: [] }),
      ],
      [
        mkLog('l-1', {
          title: 'Ship webhooks',
          decisions: [{ _id: 'dec-1', title: 'Retry policy', context: '', decision: 'exponential backoff', alternatives: '', rationale: 'resilience', timestamp: 1 }],
          problemFlow: { problem: '', investigation: '', rootCause: '', solution: '', lessonsLearned: 'Instrument everything' },
          links: [{ _id: 'ln-1', label: 'PR #1', url: 'https://github.com/x', category: 'GitHub' }],
        }),
      ],
      [],
    );
  }

  it('returns the same view for a blank query', () => {
    const view = populatedView();
    const filtered = filterKnowledge(view, '   ');
    expect(filtered).toBe(view);
  });

  it('matches docs by title, content, and tags (case-insensitive)', () => {
    const view = populatedView();
    expect(filterKnowledge(view, 'auth flow').docs.map((d) => d.id)).toEqual(['d-1']);
    expect(filterKnowledge(view, 'jwt').docs.map((d) => d.id)).toEqual(['d-1']);
    expect(filterKnowledge(view, 'pricing').docs.map((d) => d.id)).toEqual(['d-2']);
    expect(filterKnowledge(view, 'JWT').docs.map((d) => d.id)).toEqual(['d-1']);
  });

  it('matches decisions by title, decision, rationale, and log title', () => {
    const view = populatedView();
    expect(filterKnowledge(view, 'retry').decisions).toHaveLength(1);
    expect(filterKnowledge(view, 'backoff').decisions).toHaveLength(1);
    expect(filterKnowledge(view, 'resilience').decisions).toHaveLength(1);
    expect(filterKnowledge(view, 'webhooks').decisions).toHaveLength(1);
  });

  it('matches lessons and links by their own fields', () => {
    const view = populatedView();
    expect(filterKnowledge(view, 'instrument').lessons).toHaveLength(1);
    expect(filterKnowledge(view, 'github').links).toHaveLength(1);
    expect(filterKnowledge(view, 'PR #1').links).toHaveLength(1);
  });

  it('filters all groups simultaneously and recomputes total', () => {
    const view = populatedView();
    const filtered = filterKnowledge(view, 'ship');
    expect(filtered.docs).toEqual([]); // no doc mentions "ship" — honest
    expect(filtered.decisions.map((d) => d.title)).toEqual(['Retry policy']);
    expect(filtered.lessons.map((l) => l.lesson)).toEqual(['Instrument everything']);
    expect(filtered.links.map((l) => l.label)).toEqual(['PR #1']);
    expect(filtered.total).toBe(3);
  });

  it('returns empty groups when nothing matches', () => {
    const filtered = filterKnowledge(populatedView(), 'zzzz-not-there');
    expect(filtered.total).toBe(0);
    expect(filtered.docs).toEqual([]);
    expect(filtered.decisions).toEqual([]);
    expect(filtered.lessons).toEqual([]);
    expect(filtered.links).toEqual([]);
  });

  it('preserves journalCount through filtering', () => {
    const view = selectKnowledge([mkDoc('d-1')], [], [mkJournal('j-1'), mkJournal('j-2')]);
    const filtered = filterKnowledge(view, 'no match');
    expect(filtered.journalCount).toBe(2);
  });
});
