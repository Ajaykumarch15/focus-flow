import { describe, it, expect } from 'vitest';
import { api } from '../api';

describe('collaboration API client (IES-P2-05/06)', () => {
  it('exposes the real, user-scoped notifications surface', () => {
    expect(typeof api.notifications.list).toBe('function');
    expect(typeof api.notifications.unreadCount).toBe('function');
    expect(typeof api.notifications.markRead).toBe('function');
    expect(typeof api.notifications.markAllRead).toBe('function');
  });

  it('exposes the real global + workspace search surface', () => {
    expect(typeof api.search.run).toBe('function');
  });

  it('still exposes the real workspace activity feed', () => {
    expect(typeof api.workspaces.activity).toBe('function');
  });
});
