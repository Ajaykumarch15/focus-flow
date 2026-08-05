import { describe, it, expect, vi } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';
import { WorkLogMasterDetail } from '../WorkLogMasterDetail';
import { mapLog } from '../../../lib/dataMapper';
import type { WorkLog } from '../../../store/useWorkLogStore';

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

async function scan(container: HTMLElement) {
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false } },
  });
  return results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
}

function mkLog(id: string, title: string, isActive = true): WorkLog {
  return mapLog({
    _id: id,
    title,
    isActive,
    status: isActive ? 'in-progress' : 'done',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  });
}

const logs = [
  mkLog('a', 'Log A'),
  mkLog('b', 'Log B'),
  mkLog('c', 'Log C', false),
];

describe('WorkLogMasterDetail (S3-T1 merged surface)', () => {
  it('renders the master rail of every log with the selected detail below', () => {
    const { container, root } = render(<WorkLogMasterDetail logs={logs} selectedId="b" onSelect={vi.fn()} onBack={vi.fn()} />);
    const text = container.textContent ?? '';
    expect(text).toContain('All Work Logs');
    expect(text).toContain('Log A');
    expect(text).toContain('Log B');
    expect(text).toContain('Log C');
    expect(text).toContain('3 total');
    expect(text).toContain('Where I stopped'); // detail panel for Log B is inline
    act(() => root.unmount());
  });

  it('marks the selected log in the rail', () => {
    const { container, root } = render(<WorkLogMasterDetail logs={logs} selectedId="b" onSelect={vi.fn()} onBack={vi.fn()} />);
    const selectedChip = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Log B') && b.getAttribute('aria-current') === 'page');
    expect(selectedChip).toBeTruthy();
    act(() => root.unmount());
  });

  it('switching logs calls onSelect with the clicked id', () => {
    const onSelect = vi.fn();
    const { container, root } = render(<WorkLogMasterDetail logs={logs} selectedId="b" onSelect={onSelect} onBack={vi.fn()} />);
    act(() => buttonByText(container, 'Log C')!.click());
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('c');
    act(() => root.unmount());
  });

  it('filters the master rail without leaving the selected detail', () => {
    const { container, root } = render(<WorkLogMasterDetail logs={logs} selectedId="b" onSelect={vi.fn()} onBack={vi.fn()} />);
    const input = container.querySelector('[aria-label="Filter work logs"]') as HTMLInputElement;
    const proto = window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
    act(() => {
      setter.call(input, 'Log C');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const text = container.textContent ?? '';
    expect(text).toContain('Log C');
    expect(text).not.toContain('Log A');
    expect(text).toContain('Where I stopped'); // detail stays on Log B
    act(() => root.unmount());
  });

  it('shows a not-found state with a back action when the id does not exist', () => {
    const { container, root } = render(<WorkLogMasterDetail logs={logs} selectedId="missing" onSelect={vi.fn()} onBack={vi.fn()} />);
    expect(container.textContent).toContain('Work log not found');
    act(() => root.unmount());
  });

  it('calls onBack from the back button', () => {
    const onBack = vi.fn();
    const { container, root } = render(<WorkLogMasterDetail logs={logs} selectedId="b" onSelect={vi.fn()} onBack={onBack} />);
    act(() => buttonByText(container, 'Back to Work Logs')!.click());
    expect(onBack).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
  });

  it('has no critical/serious axe violations on the merged surface', async () => {
    const { container, root } = render(<WorkLogMasterDetail logs={logs} selectedId="b" onSelect={vi.fn()} onBack={vi.fn()} />);
    expect(await scan(container)).toEqual([]);
    act(() => root.unmount());
  });
});
