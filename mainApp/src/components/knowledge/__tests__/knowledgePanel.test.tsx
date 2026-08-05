import { describe, it, expect, vi } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';
import { KnowledgePanel } from '../KnowledgePanel';
import type { KnowledgeDoc } from '../../../types/collaboration';
import type { WorkLog } from '../../../store/useWorkLogStore';
import type { JournalEntry } from '../../../types';

function render(node: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(<MemoryRouter>{node}</MemoryRouter>); });
  return { container, root };
}

function buttonByText(container: HTMLElement, text: string): HTMLButtonElement | null {
  return Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes(text)) ?? null;
}

function searchInput(container: HTMLElement): HTMLInputElement {
  return container.querySelector('[aria-label="Search knowledge"]') as HTMLInputElement;
}

function type(container: HTMLElement, value: string) {
  const input = searchInput(container);
  const proto = window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function scan(container: HTMLElement) {
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false } },
  });
  return results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
}

function mkDoc(id: string, overrides: Partial<KnowledgeDoc> = {}): KnowledgeDoc {
  return {
    id,
    workspaceId: 'ws-1',
    title: `Doc ${id}`,
    category: 'Architecture',
    content: 'plain markdown body',
    authorId: 'u-1',
    version: 1,
    tags: ['backend'],
    createdAt: '2026-01-01',
    updatedAt: '2026-01-02',
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

function populated() {
  const docs = [
    mkDoc('d-1', { title: 'Auth flow', category: 'API Documentation', content: 'JWT refresh', tags: ['auth'] }),
    mkDoc('d-2', { title: 'Billing', category: 'Meeting Notes', content: 'pricing tiers', tags: [] }),
  ];
  const workLogs = [
    mkLog('l-1', {
      title: 'Ship webhooks',
      decisions: [{ _id: 'dec-1', title: 'Retry policy', context: '', decision: 'exponential backoff', alternatives: '', rationale: 'resilience', timestamp: 2000 }],
      problemFlow: { problem: '', investigation: '', rootCause: '', solution: '', lessonsLearned: 'Instrument everything' },
      links: [{ _id: 'ln-1', label: 'PR #1', url: 'https://github.com/x', category: 'GitHub' }],
    }),
  ];
  const journals = [mkJournal('j-1')];
  return { docs, workLogs, journals };
}

describe('KnowledgePanel (S3-T2 surface)', () => {
  it('renders header, real counts, and every knowledge group', () => {
    const { docs, workLogs, journals } = populated();
    const { container, root } = render(<KnowledgePanel docs={docs} workLogs={workLogs} journals={journals} />);
    const text = container.textContent ?? '';
    expect(text).toContain('Knowledge');
    expect(text).toContain('2'); // docs
    expect(text).toContain('1'); // decisions / lessons / links / journals
    expect(text).toContain('Knowledge Docs');
    expect(text).toContain('Auth flow');
    expect(text).toContain('Decision Ledger');
    expect(text).toContain('Retry policy');
    expect(text).toContain('exponential backoff');
    expect(text).toContain('Lessons Learned');
    expect(text).toContain('Instrument everything');
    expect(text).toContain('Saved Links');
    expect(text).toContain('PR #1');
    act(() => root.unmount());
  });

  it('renders the honest empty state when nothing is captured', () => {
    const { container, root } = render(<KnowledgePanel docs={[]} workLogs={[]} journals={[]} />);
    const text = container.textContent ?? '';
    expect(text).toContain('No knowledge captured yet');
    expect(text).toContain('decision or lesson in your work log');
    act(() => root.unmount());
  });

  it('shows the loading skeleton when loading with no data', () => {
    const { container, root } = render(<KnowledgePanel docs={[]} workLogs={[]} journals={[]} loading />);
    expect(container.querySelector('[role="status"]')).toBeTruthy();
    act(() => root.unmount());
  });

  it('renders a retry action on error and calls onRetry', () => {
    const onRetry = vi.fn();
    const { container, root } = render(
      <KnowledgePanel docs={[]} workLogs={[]} journals={[]} error="load failed" onRetry={onRetry} />,
    );
    expect(container.textContent).toContain('Knowledge could not be loaded');
    act(() => buttonByText(container, 'Retry')!.click());
    expect(onRetry).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
  });

  it('filters every group as the user searches', () => {
    const { docs, workLogs, journals } = populated();
    const { container, root } = render(<KnowledgePanel docs={docs} workLogs={workLogs} journals={journals} />);
    type(container, 'auth');
    const text = container.textContent ?? '';
    expect(text).toContain('Auth flow');
    expect(text).not.toContain('Billing');
    expect(text).not.toContain('Retry policy');
    type(container, 'backoff');
    expect(container.textContent ?? '').toContain('Retry policy');
    act(() => root.unmount());
  });

  it('shows the no-matches state and clears search', () => {
    const { docs, workLogs, journals } = populated();
    const { container, root } = render(<KnowledgePanel docs={docs} workLogs={workLogs} journals={journals} />);
    type(container, 'zzz-nothing');
    expect(container.textContent).toContain('No knowledge matches');
    act(() => buttonByText(container, 'Clear search')!.click());
    expect(container.textContent).toContain('Auth flow');
    act(() => root.unmount());
  });

  it('opens the origin work log from a decision', () => {
    const onOpenWorkLog = vi.fn();
    const { docs, workLogs, journals } = populated();
    const { container, root } = render(
      <KnowledgePanel docs={docs} workLogs={workLogs} journals={journals} onOpenWorkLog={onOpenWorkLog} />,
    );
    const open = container.querySelector('[aria-label="Open Retry policy in work log"]');
    expect(open).toBeTruthy();
    act(() => (open as HTMLButtonElement).click());
    expect(onOpenWorkLog).toHaveBeenCalledWith('l-1');
    act(() => root.unmount());
  });

  it('has no critical/serious axe violations on the knowledge surface', async () => {
    const { docs, workLogs, journals } = populated();
    const { container, root } = render(<KnowledgePanel docs={docs} workLogs={workLogs} journals={journals} />);
    expect(await scan(container)).toEqual([]);
    act(() => root.unmount());
  });
});
