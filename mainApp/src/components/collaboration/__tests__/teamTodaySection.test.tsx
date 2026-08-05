import { describe, it, expect, vi } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import axe from 'axe-core';
import { TeamTodaySection } from '../TeamTodaySection';
import type { NowContext } from '../../../lib/nowSelectors';
import type { TeamTodayView } from '../../../lib/missionControlSelectors';

const emptyView: TeamTodayView = { working: [], inProgress: [] };

const running: NowContext = {
  state: 'personal',
  taskId: 't-1',
  title: 'Build the dashboard',
  completed: false,
  sessionState: 'running',
  workspace: null,
  workspaceId: null,
  project: null,
  sprint: null,
  feature: null,
  branch: 'feat/dashboard',
  subtasksDone: 0,
  subtasksTotal: 0,
};

const paused: NowContext = { ...running, sessionState: 'paused' };

const populatedView: TeamTodayView = {
  working: [
    { memberId: 'm-1', memberName: 'Ada', focusTask: 'Ship the dashboard', focusTimeMs: 1_800_000 },
    { memberId: 'm-2', memberName: 'Grace', focusTask: null, focusTimeMs: null },
  ],
  inProgress: [
    {
      taskId: 't-1', title: 'Build the dashboard', priority: 'urgent',
      assigneeId: 'm-1', assigneeName: 'Ada', assignedToMe: true, branch: 'feat/dashboard', updatedAt: 1,
    },
    {
      taskId: 't-2', title: 'Refactor timer engine', priority: 'medium',
      assigneeId: null, assigneeName: null, assignedToMe: false, branch: null, updatedAt: 2,
    },
  ],
};

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

const baseProps = {
  loading: false,
  error: null,
  timerLabel: '01:23:45',
  todayLabel: '4.5h',
  goalPct: 56,
  accent: '#0ea5e9',
  workspaceName: 'FocusFlow',
  dateLabel: 'Wednesday, August 5',
  onResume: vi.fn(),
  onPause: vi.fn(),
  onOpenFocus: vi.fn(),
  onStartToday: vi.fn(),
  onOpenTask: vi.fn(),
};

describe('TeamTodaySection (S3-T4)', () => {
  it('renders a skeleton while loading with no content yet', () => {
    const { container, root } = render(
      <TeamTodaySection {...baseProps} loading running={null} view={emptyView} />,
    );
    expect(container.querySelector('.skeleton')).not.toBeNull();
    expect(container.textContent).not.toContain('Nothing running');
    act(() => root.unmount());
  });

  it('shows an honest error when there is nothing to display', () => {
    const { container, root } = render(
      <TeamTodaySection {...baseProps} error="API unavailable" running={null} view={emptyView} />,
    );
    expect(container.textContent).toContain('API unavailable');
    act(() => root.unmount());
  });

  it('shows the honest empty state when nothing is running and the team is idle', () => {
    const { container, root } = render(
      <TeamTodaySection {...baseProps} running={null} view={emptyView} />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('Team Today');
    expect(text).toContain('Nothing running right now.');
    expect(text).toContain('Start something');
    expect(text).toContain('No one is in focus right now.');
    expect(text).toContain('Nothing in progress right now.');
    expect(text).not.toContain('Pause');
    const buttons = Array.from(container.querySelectorAll('button'));
    expect(buttons.find((b) => b.textContent?.includes('Resume'))).toBeUndefined();
    act(() => root.unmount());
  });

  it('leads with the running timer, clock, branch and a Pause control', () => {
    const { container, root } = render(
      <TeamTodaySection {...baseProps} running={running} view={emptyView} />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('Build the dashboard');
    expect(text).toContain('01:23:45');
    expect(text).toContain('feat/dashboard');
    expect(text).toContain('Pause');
    expect(text).toContain('Open Focus');
    expect(text).not.toContain('Resume');
    act(() => root.unmount());
  });

  it('offers one-tap Resume when the session is paused', () => {
    const { container, root } = render(
      <TeamTodaySection {...baseProps} running={paused} view={emptyView} />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('paused');
    expect(text).toContain('Resume');
    expect(text).not.toContain('Pause');
    act(() => root.unmount());
  });

  it('renders the team today lists: who is working and what is in progress', () => {
    const { container, root } = render(
      <TeamTodaySection {...baseProps} running={null} view={populatedView} />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('Working Now');
    expect(text).toContain('Ada');
    expect(text).toContain('Grace');
    expect(text).toContain('In Progress');
    expect(text).toContain('Build the dashboard');
    expect(text).toContain('Refactor timer engine');
    expect(text).toContain('Yours');
    expect(text).toContain('Unassigned');
    expect(text).toContain('30m');
    act(() => root.unmount());
  });

  it('renders — for today focus when the daily goal is unset', () => {
    const { container, root } = render(
      <TeamTodaySection {...baseProps} todayLabel={null} goalPct={null} running={null} view={emptyView} />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('—');
    expect(text).toContain('Set a daily goal in Settings');
    act(() => root.unmount());
  });

  it('fires the resume action from a paused session', () => {
    const onResume = vi.fn();
    const { container, root } = render(
      <TeamTodaySection {...baseProps} onResume={onResume} running={paused} view={emptyView} />,
    );
    const resumeButton = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Resume'));
    expect(resumeButton).toBeTruthy();
    act(() => { resumeButton!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(onResume).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
  });

  it('fires onOpenTask from an in-progress row', () => {
    const onOpenTask = vi.fn();
    const { container, root } = render(
      <TeamTodaySection {...baseProps} onOpenTask={onOpenTask} running={null} view={populatedView} />,
    );
    const row = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Refactor timer engine'));
    expect(row).toBeTruthy();
    act(() => { row!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(onOpenTask).toHaveBeenCalledWith('t-2');
    act(() => root.unmount());
  });

  it('has no critical/serious axe violations on a populated section', async () => {
    const { container, root } = render(
      <TeamTodaySection {...baseProps} running={running} view={populatedView} />,
    );
    const violations = await scan(container);
    expect(violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`)).toEqual([]);
    act(() => root.unmount());
  });
});
