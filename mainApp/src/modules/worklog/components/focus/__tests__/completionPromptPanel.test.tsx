import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';
import { CompletionPromptPanel } from '../CompletionPromptPanel';
import { useStore } from '@worklog/services/useStore';

const addJournal = vi.hoisted(() => vi.fn(async () => {}));

function render(node: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<MemoryRouter initialEntries={['/focus']}>{node}</MemoryRouter>);
  });
  return { container, root };
}

function inputByLabel(container: HTMLElement, label: string): HTMLTextAreaElement | null {
  return container.querySelector(`[aria-label="${label}"]`);
}

function buttonByText(container: HTMLElement, text: string): HTMLButtonElement | null {
  return Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes(text)) ?? null;
}

function buttonByAriaLabel(container: HTMLElement, label: string): HTMLButtonElement | null {
  return container.querySelector(`[aria-label="${label}"]`);
}

function setTextarea(el: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function scan(container: HTMLElement) {
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false } },
  });
  return results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
}

describe('CompletionPromptPanel (S2-T3)', () => {
  beforeEach(() => {
    addJournal.mockReset();
    addJournal.mockResolvedValue(undefined);
    useStore.setState({ addJournal });
  });

  it('renders nothing while the task is still in progress', () => {
    const { container, root } = render(<CompletionPromptPanel completed={false} taskId="t-1" workLogTitle="AI copilot log" />);
    expect(container.textContent).not.toContain('Done');
    expect(container.textContent).not.toContain('Save Reflection');
    act(() => root.unmount());
  });

  it('renders nothing when no task is completed', () => {
    const { container, root } = render(<CompletionPromptPanel completed taskId={null} workLogTitle={null} />);
    expect(container.textContent).not.toContain('Save Reflection');
    act(() => root.unmount());
  });

  it('shows the completion prompt once the task is done', () => {
    const { container, root } = render(<CompletionPromptPanel completed taskId="t-1" workLogTitle="AI copilot log" />);
    const text = container.textContent ?? '';
    expect(text).toContain('Done');
    expect(text).toContain('Optional');
    expect(text).toContain('Save Reflection');
    expect(text).toContain('AI copilot log');
    act(() => root.unmount());
  });

  it('writes a composed journal entry on save', async () => {
    const { container, root } = render(<CompletionPromptPanel completed taskId="t-1" workLogTitle="AI copilot log" />);
    setTextarea(inputByLabel(container, 'What went well')!, '  Shipped the loop  ');
    setTextarea(inputByLabel(container, 'What slowed you down')!, ' tab clutter ');
    setTextarea(inputByLabel(container, 'What did you learn')!, ' reflections stick ');
    act(() => buttonByText(container, 'Save Reflection')!.click());
    await act(async () => {});

    expect(addJournal).toHaveBeenCalledTimes(1);
    expect(addJournal).toHaveBeenCalledWith({
      taskId: 't-1',
      content: 'What went well: Shipped the loop\nWhat slowed you down: tab clutter\nWhat you learned: reflections stick',
      mood: 3,
      focusRating: 3,
    });
    act(() => root.unmount());
  });

  it('applies the chosen mood and focus ratings', async () => {
    const { container, root } = render(<CompletionPromptPanel completed taskId="t-1" workLogTitle={null} />);
    setTextarea(inputByLabel(container, 'What went well')!, 'Great session');
    act(() => buttonByAriaLabel(container, 'Mood: Great (5 of 5)')!.click());
    act(() => buttonByAriaLabel(container, 'Focus: Good (4 of 5)')!.click());
    act(() => buttonByText(container, 'Save Reflection')!.click());
    await act(async () => {});

    expect(addJournal).toHaveBeenCalledWith({
      taskId: 't-1',
      content: 'What went well: Great session',
      mood: 5,
      focusRating: 4,
    });
    act(() => root.unmount());
  });

  it('disables save until at least one reflection field is filled', () => {
    const { container, root } = render(<CompletionPromptPanel completed taskId="t-1" workLogTitle={null} />);
    expect(buttonByText(container, 'Save Reflection')?.disabled).toBe(true);
    setTextarea(inputByLabel(container, 'What went well')!, 'Something went well');
    expect(buttonByText(container, 'Save Reflection')?.disabled).toBe(false);
    act(() => root.unmount());
  });

  it('shows success feedback and resets the form after saving', async () => {
    const { container, root } = render(<CompletionPromptPanel completed taskId="t-1" workLogTitle="AI copilot log" />);
    setTextarea(inputByLabel(container, 'What went well')!, 'Good work');
    act(() => buttonByText(container, 'Save Reflection')!.click());
    await act(async () => {});

    const text = container.textContent ?? '';
    expect(text).toContain('Reflection saved to your journal');
    expect(inputByLabel(container, 'What went well')?.value).toBe('');
    expect(buttonByText(container, 'Save Reflection')?.disabled).toBe(true);
    act(() => root.unmount());
  });

  it('shows an inline error and keeps the draft when the store action rejects', async () => {
    addJournal.mockRejectedValue(new Error('network'));
    const { container, root } = render(<CompletionPromptPanel completed taskId="t-1" workLogTitle={null} />);
    setTextarea(inputByLabel(container, 'What went well')!, 'Worth keeping');
    act(() => buttonByText(container, 'Save Reflection')!.click());
    await act(async () => {});

    expect(container.textContent).toContain('Could not save your reflection');
    expect(inputByLabel(container, 'What went well')?.value).toBe('Worth keeping');
    act(() => root.unmount());
  });

  it('skips the prompt and can be reopened', () => {
    const { container, root } = render(<CompletionPromptPanel completed taskId="t-1" workLogTitle={null} />);
    act(() => buttonByText(container, 'Skip')!.click());
    expect(container.textContent).not.toContain('Save Reflection');
    expect(container.textContent).toContain('Write reflection');
    act(() => buttonByText(container, 'Write reflection')!.click());
    expect(container.textContent).toContain('Save Reflection');
    act(() => root.unmount());
  });

  it('has no critical/serious axe violations on the expanded completion prompt', async () => {
    const { container, root } = render(<CompletionPromptPanel completed taskId="t-1" workLogTitle="AI copilot log" />);
    expect(await scan(container)).toEqual([]);
    act(() => root.unmount());
  });
});
