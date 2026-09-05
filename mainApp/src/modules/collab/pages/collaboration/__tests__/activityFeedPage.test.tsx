import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';
import { ActivityFeedPage } from '../ActivityFeedPage';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import type { WorkspaceActivity } from '@collab/types/collaboration';

function render(node: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(<MemoryRouter>{node}</MemoryRouter>); });
  return { container, root };
}

async function scan(container: HTMLElement) {
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  return results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
}

const activity = (action: string, details: Record<string, unknown> = {}): WorkspaceActivity => ({
  id: `a-${action}`,
  workspaceId: 'ws-1',
  actor: { id: 'u-1', name: 'Ada Lovelace', email: 'ada@focusflow.io' },
  action,
  details,
  timestamp: '2026-01-01T00:00:00.000Z',
});

describe('ActivityFeedPage (IES-P2-04)', () => {
  const originalStore = useCollaborationStore.getState();
  const loadWorkspaceActivity = vi.fn();

  beforeEach(() => {
    loadWorkspaceActivity.mockReset();
    useCollaborationStore.setState({
      activeWorkspaceId: 'ws-1',
      activities: [activity('project.updated', { projectName: 'Ship it' })],
      activityLoading: false,
      activityHasMore: true,
      activityNextCursor: 'cursor-2',
      loadWorkspaceActivity,
    });
  });

  afterEach(() => {
    useCollaborationStore.setState(originalStore);
  });

  it('loads the feed for the active workspace on mount', () => {
    const { container, root } = render(<ActivityFeedPage />);
    expect(loadWorkspaceActivity).toHaveBeenCalledWith('ws-1');
    act(() => root.unmount());
    container.remove();
  });

  it('renders actor, action label and persisted detail for project.updated', () => {
    const { container, root } = render(<ActivityFeedPage />);
    const text = container.textContent ?? '';
    expect(text).toContain('Ada Lovelace');
    expect(text).toContain('updated a project');
    expect(text).toContain('Project: Ship it');
    act(() => root.unmount());
    container.remove();
  });

  it('renders an honest empty state when there is no activity', () => {
    useCollaborationStore.setState({ activities: [], activityHasMore: false });
    const { container, root } = render(<ActivityFeedPage />);
    expect(container.textContent).toContain('No activity yet.');
    act(() => root.unmount());
    container.remove();
  });

  it('loads the next page with the keyset cursor when Load more is pressed', () => {
    const { container, root } = render(<ActivityFeedPage />);
    const button = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Load more activity'));
    expect(button).toBeTruthy();
    act(() => { button!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(loadWorkspaceActivity).toHaveBeenLastCalledWith('ws-1', { cursor: 'cursor-2', append: true });
    act(() => root.unmount());
    container.remove();
  });

  it('has no critical/serious axe violations on a populated feed', async () => {
    const { container, root } = render(<ActivityFeedPage />);
    const violations = await scan(container);
    expect(violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`)).toEqual([]);
    act(() => root.unmount());
    container.remove();
  });
});
