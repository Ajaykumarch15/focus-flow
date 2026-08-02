import { toast } from '../store/useToastStore';

export interface RunMutationOptions {
  errorTitle?: string;
  onError?: (err: unknown) => void;
}

/**
 * Runs an optimistic mutation.
 *
 * `apply()` mutates local state synchronously and may return a `rollback()`
 * that undoes it. If `request()` rejects, the rollback runs and an error toast
 * is shown. The promise never rejects (no unhandled rejections).
 */
export async function runMutation<T>(
  apply: () => void | (() => void),
  request: () => Promise<T>,
  options: RunMutationOptions = {},
): Promise<T | undefined> {
  const rollback = apply();
  try {
    return await request();
  } catch (err: any) {
    if (typeof rollback === 'function') {
      try {
        rollback();
      } catch {
        /* ignore rollback errors */
      }
    }
    if (options.onError) {
      options.onError(err);
    } else {
      toast.error(options.errorTitle || 'Action failed', err?.message || 'Something went wrong');
    }
    return undefined;
  }
}
