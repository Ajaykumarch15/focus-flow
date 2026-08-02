import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { AutoSaveEditor, AutoProEditor, AUTOSAVE_DEBOUNCE_MS } from '../proEditor';

function render(node: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(node); });
  return { container, root };
}

function setInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  act(() => {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('AutoSaveEditor (single debounce source)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('exports a single debounce constant', () => {
    expect(AUTOSAVE_DEBOUNCE_MS).toBeTypeOf('number');
    expect(AUTOSAVE_DEBOUNCE_MS).toBeGreaterThan(0);
  });

  it('saves after the single debounce constant and marks saved', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <AutoSaveEditor value="hello" onSave={onSave}>
        {({ value, onChange }) => (
          <input value={value} onChange={e => onChange(e.target.value)} />
        )}
      </AutoSaveEditor>,
    );

    setInputValue(container.querySelector('input') as HTMLInputElement, 'hello world');
    expect(onSave).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('hello world');
  });

  it('skips saving when value is unchanged', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <AutoSaveEditor value="same" onSave={onSave}>
        {({ value, onChange }) => (
          <input value={value} onChange={e => onChange(e.target.value)} />
        )}
      </AutoSaveEditor>,
    );

    await act(async () => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS * 2);
    });
    expect(onSave).not.toHaveBeenCalled();
  });

  it('AutoProEditor uses the same single debounce constant', async () => {
    const updateFn = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<AutoProEditor logId="l1" field="problem" value="a" updateFn={updateFn} />);

    const sourceBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Source')!;
    act(() => { sourceBtn.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

    const ta = container.querySelector('textarea') as HTMLTextAreaElement;
    setInputValue(ta, 'ab');

    await act(async () => {
      vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
    });
    expect(updateFn).toHaveBeenCalledTimes(1);
    expect(updateFn).toHaveBeenCalledWith('l1', 'problem', 'ab');
  });
});
