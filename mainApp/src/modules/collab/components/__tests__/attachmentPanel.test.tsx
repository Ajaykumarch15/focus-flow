import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import axe from 'axe-core';
import { AttachmentPanel } from '../AttachmentPanel';
import { useCollaborationStore } from '@collab/services/useCollaborationStore';
import { useAuthStore } from '@shared/services/useAuthStore';
import type { TaskAttachment } from '@collab/types/collaboration';

// EEP2-P5.3.2 (s3): the panel lists a target's persisted attachments and writes
// through the store actions — loadAttachments / uploadAttachment /
// deleteAttachment — which are optimistic + server-backed.
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

const attachment = (overrides: Partial<TaskAttachment>): TaskAttachment => ({
  id: 'a-1',
  workspaceId: 'ws-1',
  targetType: 'task',
  targetId: 't-1',
  name: 'Auth flow diagram',
  type: 'image',
  url: 'https://files.example.com/auth.png',
  sizeBytes: 2048,
  description: 'Sequence of the OAuth flow.',
  uploadedBy: { id: 'u-1', name: 'Ajay' },
  createdAt: '2026-01-05T10:00:00.000Z',
  ...overrides,
});

describe('AttachmentPanel (EEP2-P5.3.2)', () => {
  const originalStore = useCollaborationStore.getState();
  const originalAuth = useAuthStore.getState();
  const spies = {
    loadAttachments: vi.fn().mockResolvedValue(undefined),
    uploadAttachment: vi.fn().mockResolvedValue(undefined),
    deleteAttachment: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    Object.values(spies).forEach((s) => s.mockClear());
    useAuthStore.setState({ user: { _id: 'u-1', name: 'Ajay', email: 'a@f.io', role: 'user', settings: {} } });
    useCollaborationStore.setState({
      attachments: [],
      attachmentsLoading: false,
      attachmentsHasMore: false,
      attachmentsNextCursor: null,
      attachmentsError: false,
      ...spies,
    });
  });

  afterEach(() => {
    useCollaborationStore.setState(originalStore);
    useAuthStore.setState(originalAuth);
  });

  it('loads the target attachments on mount', () => {
    const { container, root } = render(<AttachmentPanel targetType="task" targetId="t-1" />);
    expect(spies.loadAttachments).toHaveBeenCalledWith('task', 't-1');
    act(() => root.unmount());
    expect(container).toBeTruthy();
  });

  it('lists attachments with name, type, size and uploader', () => {
    useCollaborationStore.setState({ attachments: [attachment({})] });
    const { container, root } = render(<AttachmentPanel targetType="task" targetId="t-1" />);
    const text = container.textContent ?? '';
    expect(text).toContain('Auth flow diagram');
    expect(text).toContain('IMAGE');
    expect(text).toContain('2 KB');
    expect(text).toContain('Ajay');
    expect(text).toContain('Sequence of the OAuth flow.');
    act(() => root.unmount());
  });

  it('shows an honest empty state when there are no attachments', () => {
    const { container, root } = render(<AttachmentPanel targetType="task" targetId="t-1" />);
    expect(container.textContent).toContain('No attachments yet.');
    act(() => root.unmount());
  });

  it('adds an attachment through the store and clears the inputs', async () => {
    const { container, root } = render(<AttachmentPanel targetType="task" targetId="t-1" />);
    const inputs = container.querySelectorAll<HTMLInputElement>('input');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => {
      setter.call(inputs[0], 'Diagram');
      inputs[0]!.dispatchEvent(new Event('input', { bubbles: true }));
      setter.call(inputs[1], 'https://files.example.com/d.png');
      inputs[1]!.dispatchEvent(new Event('input', { bubbles: true }));
      setter.call(inputs[2], 'design context');
      inputs[2]!.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('form button[aria-label="Add attachment"]')!.click();
    });
    expect(spies.uploadAttachment).toHaveBeenCalledWith('task', 't-1', {
      name: 'Diagram', url: 'https://files.example.com/d.png', description: 'design context',
    });
    expect(container.querySelectorAll<HTMLInputElement>('input')[0].value).toBe('');
    expect(container.querySelectorAll<HTMLInputElement>('input')[1].value).toBe('');
    expect(container.querySelectorAll<HTMLInputElement>('input')[2].value).toBe('');
    act(() => root.unmount());
  });

  it('deletes an own attachment through the store', async () => {
    useCollaborationStore.setState({ attachments: [attachment({})] });
    const { container, root } = render(<AttachmentPanel targetType="task" targetId="t-1" />);
    const del = container.querySelector<HTMLButtonElement>('[aria-label="Delete attachment Auth flow diagram"]');
    await act(async () => { del!.click(); });
    expect(spies.deleteAttachment).toHaveBeenCalledWith('a-1');
    act(() => root.unmount());
  });

  it('hides the delete button for attachments uploaded by someone else', () => {
    useCollaborationStore.setState({ attachments: [attachment({ uploadedBy: { id: 'u-2', name: 'Bo' } })] });
    const { container, root } = render(<AttachmentPanel targetType="task" targetId="t-1" />);
    expect(container.querySelector('[aria-label*="Delete attachment"]')).toBeNull();
    act(() => root.unmount());
  });

  it('shows a retry affordance when the load fails', () => {
    useCollaborationStore.setState({ attachments: [], attachmentsError: true, attachmentsLoading: false });
    const { container, root } = render(<AttachmentPanel targetType="task" targetId="t-1" />);
    expect(container.textContent).toContain("Couldn't load attachments.");
    const retry = [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('Retry'));
    act(() => { retry!.click(); });
    expect(spies.loadAttachments).toHaveBeenCalledWith('task', 't-1');
    act(() => root.unmount());
  });

  it('has no critical/serious axe violations', async () => {
    useCollaborationStore.setState({ attachments: [attachment({})] });
    const { container, root } = render(<AttachmentPanel targetType="task" targetId="t-1" />);
    const violations = await scan(container);
    expect(violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`)).toEqual([]);
    act(() => root.unmount());
  });
});
