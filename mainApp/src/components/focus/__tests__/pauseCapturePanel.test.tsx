import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import axe from 'axe-core';
import { PauseCapturePanel } from '../PauseCapturePanel';
import { useWorkLogStore } from '../../../store/useWorkLogStore';

const addBlocker = vi.hoisted(() => vi.fn(async () => {}));
const addDecision = vi.hoisted(() => vi.fn(async () => {}));

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

function render(node: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<MemoryRouter initialEntries={['/focus']}>{node}<LocationProbe /></MemoryRouter>);
  });
  return { container, root };
}

function inputByLabel(container: HTMLElement, label: string): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null {
  return container.querySelector(`[aria-label="${label}"]`);
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

function selectByLabel(container: HTMLElement, label: string): HTMLSelectElement | null {
  return container.querySelector(`[aria-label="${label}"]`) as HTMLSelectElement | null;
}

function buttonByText(container: HTMLElement, text: string): HTMLButtonElement | null {
  return Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes(text)) ?? null;
}

async function scan(container: HTMLElement) {
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false } },
  });
  return results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
}

describe('PauseCapturePanel (S2-T2)', () => {
  beforeEach(() => {
    addBlocker.mockReset();
    addBlocker.mockResolvedValue(undefined);
    addDecision.mockReset();
    addDecision.mockResolvedValue(undefined);
    useWorkLogStore.setState({ addBlocker, addDecision });
  });

  it('renders nothing while the session is running', () => {
    const { container, root } = render(<PauseCapturePanel paused={false} workLogId="log-1" workLogTitle="AI copilot log" />);
    expect(container.textContent).not.toContain('Paused');
    expect(container.textContent).not.toContain('Record Blocker');
    act(() => root.unmount());
  });

  it('shows an honest hint when paused with no linked work log', () => {
    const { container, root } = render(<PauseCapturePanel paused workLogId={null} workLogTitle={null} />);
    const text = container.textContent ?? '';
    expect(text).toContain('Link a work log');
    expect(text).toContain('Open Work Logs');
    expect(text).not.toContain('Record Blocker');
    act(() => root.unmount());
  });

  it('navigates to the work logs page from the no-work-log hint', () => {
    const { container, root } = render(<PauseCapturePanel paused workLogId={null} workLogTitle={null} />);
    act(() => buttonByText(container, 'Open Work Logs')!.click());
    expect(container.querySelector('[data-testid="location"]')?.textContent).toBe('/worklog/logs');
    act(() => root.unmount());
  });

  it('records a blocker through the linked work log', async () => {
    const { container, root } = render(<PauseCapturePanel paused workLogId="log-1" workLogTitle="AI copilot log" />);
    const title = inputByLabel(container, 'Blocker title') as HTMLInputElement;
    setInput(title, '  Blocked on model API rate limits  ');
    const severity = selectByLabel(container, 'Blocker severity')!;
    act(() => {
      severity.value = 'critical';
      severity.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const notes = inputByLabel(container, 'Blocker details') as HTMLTextAreaElement;
    setInput(notes, ' 429s on the embeddings endpoint ');
    act(() => buttonByText(container, 'Record Blocker')!.click());
    await act(async () => {});

    expect(addBlocker).toHaveBeenCalledTimes(1);
    expect(addBlocker).toHaveBeenCalledWith('log-1', {
      title: 'Blocked on model API rate limits',
      severity: 'critical',
      status: 'open',
      notes: '429s on the embeddings endpoint',
    });
    act(() => root.unmount());
  });

  it('logs a decision through the linked work log', async () => {
    const { container, root } = render(<PauseCapturePanel paused workLogId="log-1" workLogTitle="AI copilot log" />);
    act(() => buttonByText(container, 'Decision')!.click());

    setInput(inputByLabel(container, 'Decision title') as HTMLInputElement, '  Use Zustand  ');
    setInput(inputByLabel(container, 'Decision context') as HTMLTextAreaElement, ' state sharing ');
    setInput(inputByLabel(container, 'Chosen decision') as HTMLTextAreaElement, ' zustand ');
    setInput(inputByLabel(container, 'Decision rationale') as HTMLTextAreaElement, ' minimal ');
    setInput(inputByLabel(container, 'Alternatives considered') as HTMLTextAreaElement, ' redux ');
    act(() => buttonByText(container, 'Log Decision')!.click());
    await act(async () => {});

    expect(addDecision).toHaveBeenCalledTimes(1);
    expect(addDecision).toHaveBeenCalledWith('log-1', {
      title: 'Use Zustand',
      context: 'state sharing',
      decision: 'zustand',
      rationale: 'minimal',
      alternatives: 'redux',
    });
    act(() => root.unmount());
  });

  it('dismisses the prompt and can be reopened', () => {
    const { container, root } = render(<PauseCapturePanel paused workLogId="log-1" workLogTitle="AI copilot log" />);
    act(() => container.querySelector('[aria-label="Dismiss capture prompt"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(container.textContent).toContain('Capture blocker or decision');
    expect(container.textContent).not.toContain('Record Blocker');
    act(() => buttonByText(container, 'Capture blocker or decision')!.click());
    expect(container.textContent).toContain('Record Blocker');
    act(() => root.unmount());
  });

  it('shows success feedback after a capture', async () => {
    const { container, root } = render(<PauseCapturePanel paused workLogId="log-1" workLogTitle="AI copilot log" />);
    setInput(inputByLabel(container, 'Blocker title') as HTMLInputElement, 'Waiting on review');
    act(() => buttonByText(container, 'Record Blocker')!.click());
    await act(async () => {});
    expect(container.textContent).toContain('Blocker recorded');
    expect(container.textContent).toContain('AI copilot log');
    act(() => root.unmount());
  });

  it('shows an inline error and keeps the draft when the store action rejects', async () => {
    addBlocker.mockRejectedValue(new Error('network'));
    const { container, root } = render(<PauseCapturePanel paused workLogId="log-1" workLogTitle="AI copilot log" />);
    setInput(inputByLabel(container, 'Blocker title') as HTMLInputElement, 'Blocked on CI');
    act(() => buttonByText(container, 'Record Blocker')!.click());
    await act(async () => {});
    const text = container.textContent ?? '';
    expect(text).toContain('Could not record the blocker');
    expect((inputByLabel(container, 'Blocker title') as HTMLInputElement).value).toBe('Blocked on CI');
    act(() => root.unmount());
  });

  it('resets the form after a successful blocker capture so another can be logged', async () => {
    const { container, root } = render(<PauseCapturePanel paused workLogId="log-1" workLogTitle="AI copilot log" />);
    setInput(inputByLabel(container, 'Blocker title') as HTMLInputElement, 'First blocker');
    act(() => buttonByText(container, 'Record Blocker')!.click());
    await act(async () => {});
    expect((inputByLabel(container, 'Blocker title') as HTMLInputElement).value).toBe('');
    expect(buttonByText(container, 'Record Blocker')?.disabled).toBe(true);
    act(() => root.unmount());
  });

  it('has no critical/serious axe violations on the expanded capture panel', async () => {
    const { container, root } = render(<PauseCapturePanel paused workLogId="log-1" workLogTitle="AI copilot log" />);
    expect(await scan(container)).toEqual([]);
    act(() => root.unmount());
  });
});
