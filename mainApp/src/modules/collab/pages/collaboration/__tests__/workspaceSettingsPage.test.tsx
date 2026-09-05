import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';
import { WorkspaceSettingsPage } from '../WorkspaceSettingsPage';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import type { Workspace } from '@collab/types/collaboration';

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

const workspace: Workspace = {
  id: 'ws-1', name: 'Core Platform', type: 'Enterprise', icon: '🏢',
  description: 'Shared engineering workspace.', membersCount: 3, projectsCount: 2,
  createdAt: '2026-01-01',
  settings: {
    allowMemberInvites: true,
    requireReviewForDone: false,
    autoSyncTimerWorkLogs: true,
    defaultVisibility: 'Workspace',
  },
};

describe('WorkspaceSettingsPage (P2 frontend verify)', () => {
  const originalStore = useCollaborationStore.getState();
  const updateWorkspaceSettings = vi.fn();

  beforeEach(() => {
    updateWorkspaceSettings.mockReset();
    useCollaborationStore.setState({
      activeWorkspaceId: 'ws-1',
      workspaces: [workspace],
      updateWorkspaceSettings,
    });
  });

  afterEach(() => {
    useCollaborationStore.setState(originalStore);
  });

  it('renders toggles reflecting the persisted workspace settings', () => {
    const { container, root } = render(<WorkspaceSettingsPage />);
    const checkboxes = Array.from(container.querySelectorAll('input[type="checkbox"]'));
    expect(checkboxes).toHaveLength(3);
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
    expect((checkboxes[1] as HTMLInputElement).checked).toBe(false);
    expect((checkboxes[2] as HTMLInputElement).checked).toBe(true);
    act(() => root.unmount());
    container.remove();
  });

  it('renders the configurable role permission matrix', () => {
    const { container, root } = render(<WorkspaceSettingsPage />);
    const text = container.textContent ?? '';
    expect(text).toContain('Configurable Role Permissions Matrix');
    for (const header of ['Owner', 'Admin', 'Team Leader', 'Developer', 'QA Engineer', 'Viewer']) {
      expect(text).toContain(header);
    }
    act(() => root.unmount());
    container.remove();
  });

  it('persists changes through updateWorkspaceSettings and confirms the save', () => {
    const { container, root } = render(<WorkspaceSettingsPage />);
    const checkboxes = Array.from(container.querySelectorAll('input[type="checkbox"]'));
    act(() => { (checkboxes[1] as HTMLInputElement).click(); });
    act(() => {
      container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    expect(updateWorkspaceSettings).toHaveBeenCalledWith('ws-1', {
      allowMemberInvites: true,
      requireReviewForDone: true,
      autoSyncTimerWorkLogs: true,
    });
    expect(container.textContent).toContain('Settings saved successfully!');
    act(() => root.unmount());
    container.remove();
  });

  it('has no critical/serious axe violations on a populated settings page', async () => {
    const { container, root } = render(<WorkspaceSettingsPage />);
    const violations = await scan(container);
    expect(violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`)).toEqual([]);
    act(() => root.unmount());
    container.remove();
  });
});
