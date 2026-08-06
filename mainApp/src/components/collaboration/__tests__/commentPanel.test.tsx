import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import axe from 'axe-core';
import { CommentPanel } from '../CommentPanel';
import { useCollaborationStore } from '../../../store/useCollaborationStore';
import { useAuthStore } from '../../../store/useAuthStore';
import type { DiscussionComment } from '../../../types/collaboration';

// EEP2-P5.3.1 (s2): the panel lists a target's persisted comment threads (roots +
// nested replies) and writes through the store actions — loadDiscussions /
// addComment / addReaction / resolveThread / deleteComment — which are
// optimistic + server-backed. The UI surface is unchanged from the mock era.
function render(node: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(node); });
  return { container, root };
}

async function scan(container: HTMLElement) {
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  return results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
}

const comment = (overrides: Partial<DiscussionComment>): DiscussionComment => ({
  id: 'c-1',
  workspaceId: 'ws-1',
  targetType: 'task',
  targetId: 't-1',
  author: { id: 'u-1', name: 'Ajay' },
  content: 'Wire the API first.',
  createdAt: '2026-01-05T10:00:00.000Z',
  reactions: {},
  replies: [],
  isResolved: false,
  ...overrides,
});

describe('CommentPanel (EEP2-P5.3.1)', () => {
  const originalStore = useCollaborationStore.getState();
  const originalAuth = useAuthStore.getState();
  const spies = {
    loadDiscussions: vi.fn().mockResolvedValue(undefined),
    addComment: vi.fn().mockResolvedValue(undefined),
    addReaction: vi.fn().mockResolvedValue(undefined),
    resolveThread: vi.fn().mockResolvedValue(undefined),
    deleteComment: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    Object.values(spies).forEach((s) => s.mockClear());
    useAuthStore.setState({ user: { _id: 'u-1', name: 'Ajay', email: 'a@f.io', role: 'user', settings: {} } });
    useCollaborationStore.setState({
      discussions: [],
      discussionsLoading: false,
      discussionsHasMore: false,
      discussionsNextCursor: null,
      discussionsError: false,
      ...spies,
    });
  });

  afterEach(() => {
    useCollaborationStore.setState(originalStore);
    useAuthStore.setState(originalAuth);
  });

  it('loads the target thread on mount', () => {
    const { container, root } = render(<CommentPanel targetType="task" targetId="t-1" />);
    expect(spies.loadDiscussions).toHaveBeenCalledWith('task', 't-1');
    act(() => root.unmount());
    expect(container).toBeTruthy();
  });

  it('lists comments with author, timestamp, reactions and nested replies', () => {
    useCollaborationStore.setState({
      discussions: [
        comment({
          reactions: { '👍': ['u-1', 'u-2'] },
          replies: [comment({ id: 'c-2', author: { id: 'u-2', name: 'Bo' }, content: 'Agreed.', targetId: 't-1' })],
        }),
      ],
    });
    const { container, root } = render(<CommentPanel targetType="task" targetId="t-1" />);
    const text = container.textContent ?? '';
    expect(text).toContain('Wire the API first.');
    expect(text).toContain('Agreed.');
    expect(text).toContain('Bo:');
    expect(text).toContain('2');
    act(() => root.unmount());
  });

  it('shows an honest empty state when there are no comments', () => {
    const { container, root } = render(<CommentPanel targetType="task" targetId="t-1" />);
    expect(container.textContent).toContain('No comments yet.');
    act(() => root.unmount());
  });

  it('posts a comment through the store and clears the input', async () => {
    const { container, root } = render(<CommentPanel targetType="task" targetId="t-1" />);
    const textarea = container.querySelector<HTMLTextAreaElement>('textarea');
    expect(textarea).toBeTruthy();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!.set!;
    await act(async () => {
      setter.call(textarea, 'New comment');
      textarea!.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('form button')!.click();
    });
    expect(spies.addComment).toHaveBeenCalledWith('task', 't-1', 'New comment');
    expect(container.querySelector<HTMLTextAreaElement>('textarea')!.value).toBe('');
    act(() => root.unmount());
  });

  it('toggles a reaction through the store', async () => {
    useCollaborationStore.setState({ discussions: [comment({})] });
    const { container, root } = render(<CommentPanel targetType="task" targetId="t-1" />);
    const reaction = [...container.querySelectorAll('button')].find((b) => b.textContent?.startsWith('🚀'));
    await act(async () => { reaction!.click(); });
    expect(spies.addReaction).toHaveBeenCalledWith('c-1', '🚀');
    act(() => root.unmount());
  });

  it('resolves a thread through the store', async () => {
    useCollaborationStore.setState({ discussions: [comment({})] });
    const { container, root } = render(<CommentPanel targetType="task" targetId="t-1" />);
    const resolve = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Resolve'));
    await act(async () => { resolve!.click(); });
    expect(spies.resolveThread).toHaveBeenCalledWith('c-1');
    act(() => root.unmount());
  });

  it('deletes an own comment through the store', async () => {
    useCollaborationStore.setState({ discussions: [comment({})] });
    const { container, root } = render(<CommentPanel targetType="task" targetId="t-1" />);
    const del = container.querySelector<HTMLButtonElement>('[title="Delete comment"]');
    await act(async () => { del!.click(); });
    expect(spies.deleteComment).toHaveBeenCalledWith('c-1');
    act(() => root.unmount());
  });

  it('hides the delete button for comments owned by someone else', () => {
    useCollaborationStore.setState({ discussions: [comment({ author: { id: 'u-2', name: 'Bo' } })] });
    const { container, root } = render(<CommentPanel targetType="task" targetId="t-1" />);
    expect(container.querySelector('[title="Delete comment"]')).toBeNull();
    act(() => root.unmount());
  });

  it('shows a retry affordance when the load fails', () => {
    useCollaborationStore.setState({ discussions: [], discussionsError: true, discussionsLoading: false });
    const { container, root } = render(<CommentPanel targetType="task" targetId="t-1" />);
    expect(container.textContent).toContain("Couldn't load discussions.");
    const retry = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Retry'));
    act(() => { retry!.click(); });
    expect(spies.loadDiscussions).toHaveBeenCalledWith('task', 't-1');
    act(() => root.unmount());
  });

  it('has no critical/serious axe violations', async () => {
    useCollaborationStore.setState({ discussions: [comment({ reactions: { '👍': ['u-1'] } })] });
    const { container, root } = render(<CommentPanel targetType="task" targetId="t-1" />);
    const violations = await scan(container);
    expect(violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`)).toEqual([]);
    act(() => root.unmount());
  });
});
