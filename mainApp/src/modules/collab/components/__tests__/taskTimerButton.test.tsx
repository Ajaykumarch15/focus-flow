import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import axe from 'axe-core';
import { TaskTimerButton } from '../TaskTimerButton';

// EEP2-P5.4.2 (s1/s3): the board card timer. Start/stop/pause/resume are the
// global store timer actions (the same engine the sidebar uses); the button is
// only the collab card's hookup. `baseMs` becomes the resume base so a card
// with logged time says "Resume" and continues its clock.
const startTimer = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const stopTimer = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const pauseTimer = vi.hoisted(() => vi.fn());
const resumeTimer = vi.hoisted(() => vi.fn());
const timerMock = vi.hoisted(() => ({
  activeTaskId: null as string | null,
  activeTimerState: 'idle' as 'idle' | 'running' | 'paused',
  display: '0s',
}));

vi.mock('@worklog/services/useStore', () => ({
  useStore: () => ({ startTimer, stopTimer, pauseTimer, resumeTimer }),
}));

vi.mock('@shared/hooks/useActiveTimer', () => ({
  useActiveTimer: () => timerMock,
}));

async function render(node: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(node); });
  return { container, root };
}

async function scan(container: HTMLElement) {
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  return results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
}

describe('TaskTimerButton (EEP2-P5.4.2)', () => {
  beforeEach(() => {
    startTimer.mockClear();
    stopTimer.mockClear();
    pauseTimer.mockClear();
    resumeTimer.mockClear();
    timerMock.activeTaskId = null;
    timerMock.activeTimerState = 'idle';
    timerMock.display = '0s';
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('renders Start when the timer is idle and the task has no logged time', async () => {
    const { container, root } = await render(<TaskTimerButton taskId="t-1" title="Wire the API" />);
    expect(container.querySelector('[aria-label="Start timer for Wire the API"]')).toBeTruthy();
    expect(container.textContent).not.toContain('Resume');
    act(() => root.unmount());
  });

  it('calls startTimer with the resume base when the task already has time', async () => {
    const { container, root } = await render(<TaskTimerButton taskId="t-1" title="Wire the API" baseMs={3_600_000} />);
    expect(container.querySelector('[aria-label="Start timer for Wire the API"]')).toBeTruthy();
    const start = container.querySelector<HTMLButtonElement>('[aria-label="Start timer for Wire the API"]')!;
    act(() => start.click());
    expect(startTimer).toHaveBeenCalledWith('t-1', 3_600_000);
    act(() => root.unmount());
  });

  it('shows Pause + Stop while running on the same task', async () => {
    timerMock.activeTaskId = 't-1';
    timerMock.activeTimerState = 'running';
    timerMock.display = '12:34';
    const { container, root } = await render(<TaskTimerButton taskId="t-1" title="Wire the API" />);
    expect(container.textContent).toContain('12:34');
    const pause = container.querySelector<HTMLButtonElement>('[aria-label="Pause timer for Wire the API"]')!;
    const stop = container.querySelector<HTMLButtonElement>('[aria-label="Stop timer for Wire the API"]')!;
    expect(pause).toBeTruthy();
    expect(stop).toBeTruthy();
    expect(container.querySelector('[aria-label="Start timer for Wire the API"]')).toBeNull();
    act(() => pause.click());
    expect(pauseTimer).toHaveBeenCalledWith('t-1');
    act(() => stop.click());
    expect(stopTimer).toHaveBeenCalledWith('t-1');
    act(() => root.unmount());
  });

  it('shows Resume while paused and calls resumeTimer', async () => {
    timerMock.activeTaskId = 't-1';
    timerMock.activeTimerState = 'paused';
    timerMock.display = '5:00';
    const { container, root } = await render(<TaskTimerButton taskId="t-1" title="Wire the API" />);
    const resume = container.querySelector<HTMLButtonElement>('[aria-label="Resume timer for Wire the API"]')!;
    expect(resume).toBeTruthy();
    expect(container.querySelector('[aria-label="Start timer for Wire the API"]')).toBeNull();
    act(() => resume.click());
    expect(resumeTimer).toHaveBeenCalledWith('t-1');
    act(() => root.unmount());
  });

  it('shows the idle dash when another task is being timed', async () => {
    timerMock.activeTaskId = 't-2';
    timerMock.activeTimerState = 'running';
    const { container, root } = await render(<TaskTimerButton taskId="t-1" title="Wire the API" />);
    expect(container.querySelector('[aria-label="Start timer for Wire the API"]')).toBeTruthy();
    expect(container.querySelector('[aria-label="Stop timer for Wire the API"]')).toBeNull();
    act(() => root.unmount());
  });

  it('has no critical/serious axe violations', async () => {
    const { container, root } = await render(<TaskTimerButton taskId="t-1" title="Wire the API" />);
    const violations = await scan(container);
    expect(violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`)).toEqual([]);
    act(() => root.unmount());
  });
});
