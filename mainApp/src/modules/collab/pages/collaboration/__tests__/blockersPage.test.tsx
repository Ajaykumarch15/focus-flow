import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import axe from 'axe-core';
import { BlockersPage } from '../BlockersPage';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import type { CentralBlocker } from '@collab/types/collaboration';

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

const blocker = (overrides: Partial<CentralBlocker>): CentralBlocker => ({
  id: 'b-1',
  workspaceId: 'ws-1',
  title: 'Deploy pipeline is down',
  severity: 'critical',
  ownerId: 'm-1',
  reporterId: 'm-2',
  status: 'open',
  impactDescription: 'Blocks the weekly release.',
  createdAt: '2026-01-01',
  ...overrides,
});

describe('BlockersPage (S4-T1)', () => {
  const originalStore = useCollaborationStore.getState();
  const resolveBlockerSpy = vi.fn();

  beforeEach(() => {
    resolveBlockerSpy.mockClear();
    useCollaborationStore.setState({
      activeWorkspaceId: 'ws-1',
      blockers: [
        blocker({}),
        blocker({ id: 'b-2', title: 'Missing env vars', severity: 'high', status: 'resolved' }),
      ],
      resolveBlocker: resolveBlockerSpy,
    });
  });

  afterEach(() => {
    useCollaborationStore.setState(originalStore);
  });

  it('renders the resolution board with every blocker in the workspace', () => {
    const { container, root } = render(<BlockersPage />);
    const text = container.textContent ?? '';
    expect(text).toContain('Blocker Resolution Board');
    expect(text).toContain('Deploy pipeline is down');
    expect(text).toContain('Missing env vars');
    expect(text).toContain('critical');
    expect(text).toContain('Resolved');
    act(() => root.unmount());
  });

  it('resolves an open blocker from the board', () => {
    const { container, root } = render(<BlockersPage />);
    const buttons = Array.from(container.querySelectorAll('button'));
    const resolve = buttons.find((b) => b.textContent?.includes('Resolve Blocker'));
    expect(resolve).toBeTruthy();
    act(() => { resolve!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(resolveBlockerSpy).toHaveBeenCalledWith('b-1');
    act(() => root.unmount());
  });

  it('opens the Report Blocker modal', () => {
    const { container, root } = render(<BlockersPage />);
    const button = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Report Blocker'));
    expect(button).toBeTruthy();
    act(() => { button!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(container.textContent).toContain('Report Blocker');
    act(() => root.unmount());
  });

  it('renders the honest empty state when nothing is blocking', () => {
    useCollaborationStore.setState({ blockers: [] });
    const { container, root } = render(<BlockersPage />);
    const text = container.textContent ?? '';
    expect(text).toContain('No blockers reported');
    expect(text).toContain('The pipeline is clear');
    act(() => root.unmount());
  });

  it('has no critical/serious axe violations on a populated board', async () => {
    const { container, root } = render(<BlockersPage />);
    const violations = await scan(container);
    expect(violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`)).toEqual([]);
    act(() => root.unmount());
  });
});
