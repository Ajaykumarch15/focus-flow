import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useToastStore } from '../useToastStore';

describe('useToastStore timer cleanup', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useToastStore.getState().clearAll();
  });

  afterEach(() => {
    useToastStore.getState().clearAll();
    vi.useRealTimers();
  });

  it('dismiss clears its own timeout', () => {
    const { addToast, removeToast } = useToastStore.getState();
    addToast({ type: 'info', title: 't', duration: 5000 });
    const id = useToastStore.getState().toasts[0].id;

    removeToast(id);
    expect(useToastStore.getState().toasts).toHaveLength(0);

    vi.advanceTimersByTime(6000);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('auto-dismiss still fires when not manually dismissed', () => {
    const { addToast } = useToastStore.getState();
    addToast({ type: 'success', title: 't', duration: 3000 });
    expect(useToastStore.getState().toasts).toHaveLength(0 + 1);

    vi.advanceTimersByTime(3001);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('ids do not collide for simultaneous toasts', () => {
    const { addToast, removeToast } = useToastStore.getState();
    addToast({ type: 'info', title: 'a', duration: 10000 });
    addToast({ type: 'info', title: 'b', duration: 10000 });

    const [first, second] = useToastStore.getState().toasts;
    expect(first.id).not.toBe(second.id);

    removeToast(first.id);
    expect(useToastStore.getState().toasts.map((t) => t.id)).toEqual([second.id]);

    vi.advanceTimersByTime(10001);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('no leaked timers remain after manual dismiss', () => {
    const { addToast, removeToast, clearAll } = useToastStore.getState();
    addToast({ type: 'warning', title: 't', duration: 8000 });
    const id = useToastStore.getState().toasts[0].id;
    removeToast(id);

    expect(vi.getTimerCount()).toBe(0);

    addToast({ type: 'info', title: 'x', duration: 8000 });
    clearAll();
    expect(vi.getTimerCount()).toBe(0);
  });
});
