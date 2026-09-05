import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runMutation } from '../mutation';
import { useToastStore } from '@shared/services/useToastStore';

describe('runMutation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useToastStore.getState().clearAll();
  });

  afterEach(() => {
    useToastStore.getState().clearAll();
    vi.useRealTimers();
  });

  it('keeps optimistic state on success', async () => {
    let state = { items: ['a'] };
    const result = await runMutation(
      () => {
        state = { items: ['a', 'b'] };
        return () => { state = { items: ['a'] }; };
      },
      async () => 'ok',
    );
    expect(result).toBe('ok');
    expect(state.items).toEqual(['a', 'b']);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('rolls state back and toasts on failure', async () => {
    let state = { items: ['a'] };
    const result = await runMutation(
      () => {
        state = { items: ['a', 'b'] };
        return () => { state = { items: ['a'] }; };
      },
      async () => { throw new Error('boom'); },
      { errorTitle: 'Nope' },
    );
    expect(result).toBeUndefined();
    expect(state.items).toEqual(['a']);
    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].type).toBe('error');
    expect(toasts[0].title).toBe('Nope');
  });

  it('does not rethrow on failure (no unhandled rejections)', async () => {
    const promise = runMutation(
      () => () => {},
      async () => { throw new Error('x'); },
    );
    await expect(promise).resolves.toBeUndefined();
  });

  it('uses onError callback instead of toast when provided', async () => {
    const onError = vi.fn();
    await runMutation(
      () => () => {},
      async () => { throw new Error('x'); },
      { onError },
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});
