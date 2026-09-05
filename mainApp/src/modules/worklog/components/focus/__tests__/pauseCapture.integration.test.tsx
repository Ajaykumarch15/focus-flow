import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { PauseCapturePanel } from '../PauseCapturePanel';
import { useWorkLogStore, type WorkLog } from '@worklog/services/useWorkLogStore';

// S2-T2 integration: the real store actions run against the mocked api layer,
// proving the Focus shell capture posts to workLogs.addBlocker / addDecision and
// the linked work log in the store reflects the new blocker/decision.
const apiMock = vi.hoisted(() => ({
  workLogs: {
    addBlocker: vi.fn(),
    addDecision: vi.fn(),
  },
}));

vi.mock('@shared/utils/api', () => ({ api: apiMock }));

function render(node: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<MemoryRouter initialEntries={['/focus']}>{node}</MemoryRouter>);
  });
  return { container, root };
}

function setInput(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement
    ? window.HTMLTextAreaElement.prototype
    : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function buttonByText(container: HTMLElement, text: string): HTMLButtonElement | null {
  return Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes(text)) ?? null;
}

function mkLog(): WorkLog {
  return {
    _id: 'log-1', title: 'AI copilot log', status: 'in-progress', isActive: true,
    blockerList: [], decisions: [], updatedAt: new Date().toISOString(),
  } as unknown as WorkLog;
}

describe('PauseCapturePanel integration (S2-T2)', () => {
  beforeEach(() => {
    apiMock.workLogs.addBlocker.mockReset();
    apiMock.workLogs.addDecision.mockReset();
    useWorkLogStore.setState({ activeLogs: [mkLog()], closedLogs: [], todayLog: null, selectedLogId: null });
  });

  it('posts a blocker through the store action to workLogs.addBlocker and updates the linked log', async () => {
    apiMock.workLogs.addBlocker.mockResolvedValue({
      _id: 'log-1', title: 'AI copilot log', updatedAt: new Date().toISOString(),
      blockerList: [{ _id: 'blk-1', title: 'Blocked on CI pipeline', severity: 'medium', status: 'open', notes: '', createdAt: Date.now() }],
    });

    const { container, root } = render(<PauseCapturePanel paused workLogId="log-1" workLogTitle="AI copilot log" />);
    setInput(container.querySelector('[aria-label="Blocker title"]') as HTMLInputElement, 'Blocked on CI pipeline');
    act(() => buttonByText(container, 'Record Blocker')!.click());
    await act(async () => {});

    expect(apiMock.workLogs.addBlocker).toHaveBeenCalledTimes(1);
    expect(apiMock.workLogs.addBlocker).toHaveBeenCalledWith(
      'log-1',
      { title: 'Blocked on CI pipeline', severity: 'medium', status: 'open', notes: '' },
    );
    const log = useWorkLogStore.getState().activeLogs.find((l) => l._id === 'log-1');
    expect(log?.blockerList.some((b) => b.title === 'Blocked on CI pipeline')).toBe(true);
    act(() => root.unmount());
  });

  it('posts a decision through the store action to workLogs.addDecision and updates the linked log', async () => {
    apiMock.workLogs.addDecision.mockResolvedValue({
      _id: 'log-1', title: 'AI copilot log', updatedAt: new Date().toISOString(),
      decisions: [{ _id: 'dec-1', title: 'Use server validation', context: '', decision: 'zod on every route', rationale: '', alternatives: '', timestamp: Date.now() }],
    });

    const { container, root } = render(<PauseCapturePanel paused workLogId="log-1" workLogTitle="AI copilot log" />);
    act(() => buttonByText(container, 'Decision')!.click());
    setInput(container.querySelector('[aria-label="Decision title"]') as HTMLInputElement, 'Use server validation');
    setInput(container.querySelector('[aria-label="Chosen decision"]') as HTMLTextAreaElement, 'zod on every route');
    act(() => buttonByText(container, 'Log Decision')!.click());
    await act(async () => {});

    expect(apiMock.workLogs.addDecision).toHaveBeenCalledTimes(1);
    expect(apiMock.workLogs.addDecision).toHaveBeenCalledWith(
      'log-1',
      { title: 'Use server validation', context: '', decision: 'zod on every route', rationale: '', alternatives: '' },
    );
    const log = useWorkLogStore.getState().activeLogs.find((l) => l._id === 'log-1');
    expect(log?.decisions.some((d) => d.title === 'Use server validation')).toBe(true);
    act(() => root.unmount());
  });
});
