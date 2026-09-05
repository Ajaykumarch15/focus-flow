import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';
import { AdminAudit } from '../AdminAudit';
import { useAuthStore } from '@shared/services/useAuthStore';

// S4-T3: the Audit page composes the three monitoring surfaces. The admin api
// layer is stubbed so every tab renders deterministic empty states — tests
// never hit the network.
const apiMock = vi.hoisted(() => ({
  admin: {
    getStats: vi.fn(async () => ({}) as any),
    getSystemAnalytics: vi.fn(async () => ({}) as any),
    getActivity: vi.fn(async () => ({ items: [] }) as any),
    listUsers: vi.fn(async () => ({ items: [] }) as any),
    getUserAnalytics: vi.fn(async () => ({}) as any),
  },
  teams: {
    list: vi.fn(async () => [] as any[]),
  },
}));

vi.mock('@shared/utils/api', () => ({ api: apiMock }));

function render(node: ReactNode, initialPath = '/admin/audit') {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(<MemoryRouter initialEntries={[initialPath]}>{node}</MemoryRouter>); });
  return { container, root };
}

async function scan(container: HTMLElement) {
  const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
  return results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
}

describe('AdminAudit (S4-T3)', () => {
  const originalAuth = useAuthStore.getState();
  const originalMockState = {
    getStats: apiMock.admin.getStats.getMockImplementation(),
    getSystemAnalytics: apiMock.admin.getSystemAnalytics.getMockImplementation(),
    getActivity: apiMock.admin.getActivity.getMockImplementation(),
    listUsers: apiMock.admin.listUsers.getMockImplementation(),
    list: apiMock.teams.list.getMockImplementation(),
  };

  beforeEach(() => {
    useAuthStore.setState({ user: { _id: 'u-1', name: 'Admin', email: 'a@focusflow.io', role: 'admin' } as any });
    apiMock.admin.getStats.mockResolvedValue({});
    apiMock.admin.getSystemAnalytics.mockResolvedValue({});
    apiMock.admin.getActivity.mockResolvedValue({ items: [] });
    apiMock.admin.listUsers.mockResolvedValue({ items: [] });
    apiMock.teams.list.mockResolvedValue([]);
  });

  afterEach(() => {
    useAuthStore.setState(originalAuth);
    apiMock.admin.getStats.mockImplementation(originalMockState.getStats as any);
    apiMock.admin.getSystemAnalytics.mockImplementation(originalMockState.getSystemAnalytics as any);
    apiMock.admin.getActivity.mockImplementation(originalMockState.getActivity as any);
    apiMock.admin.listUsers.mockImplementation(originalMockState.listUsers as any);
    apiMock.teams.list.mockImplementation(originalMockState.list as any);
  });

  it('renders the Audit header with three view tabs', () => {
    const { container, root } = render(<AdminAudit />);
    const text = container.textContent ?? '';
    expect(text).toContain('Audit');
    expect(text).toContain('Overview');
    expect(text).toContain('Analytics');
    expect(text).toContain('Activity');
    act(() => root.unmount());
  });

  it('switches views when a tab is selected', () => {
    const { container, root } = render(<AdminAudit />);
    const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
    const analyticsTab = tabs.find((t) => t.textContent?.includes('Analytics'));
    act(() => { analyticsTab!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(analyticsTab?.getAttribute('aria-selected')).toBe('true');
    act(() => root.unmount());
  });

  it('deep-links to the activity view via the query string', () => {
    const { container, root } = render(<AdminAudit />, '/admin/audit?view=activity');
    const text = container.textContent ?? '';
    expect(text).toContain('Audit');
    const activityTab = Array.from(container.querySelectorAll('[role="tab"]')).find((t) => t.textContent?.includes('Activity'));
    expect(activityTab?.getAttribute('aria-selected')).toBe('true');
    act(() => root.unmount());
  });

  it('has no critical/serious axe violations on the default overview tab', async () => {
    const { container, root } = render(<AdminAudit />);
    const violations = await scan(container);
    expect(violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`)).toEqual([]);
    act(() => root.unmount());
  });
});
