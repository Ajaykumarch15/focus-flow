import { describe, it, expect } from 'vitest';
import { api } from '../api';

describe('reports API client — legacy share removed (IES-P0-02)', () => {
  it('no longer exposes the unauthenticated share method', () => {
    expect((api.reports as Record<string, unknown>).share).toBeUndefined();
  });

  it('still exposes the token-gated share flow', () => {
    expect(typeof api.reports.createShare).toBe('function');
    expect(typeof api.reports.revokeShare).toBe('function');
    expect(typeof api.reports.shareToken).toBe('function');
  });
});
