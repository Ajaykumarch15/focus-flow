import { describe, it, expect } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import axe from 'axe-core';
import { Login } from '../pages/Login';
import { Register } from '../pages/Register';
import { GlobalHeader } from '../components/ui/GlobalHeader';

function render(node: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<MemoryRouter initialEntries={['/']}>{node}</MemoryRouter>);
  });
  return { container, root };
}

async function scan(container: HTMLElement) {
  const results = await axe.run(container, {
    rules: {
      'color-contrast': { enabled: false }, // headless DOM cannot compute rendered colors
    },
  });
  return results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
}

function describeViolations(violations: axe.Result[]) {
  return violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`).join('\n');
}

describe('IES-P0-36 · axe scan of primary surfaces', () => {
  it('Login has no critical/serious violations', async () => {
    const { container, root } = render(<Login />);
    const violations = await scan(container);
    expect(violations, describeViolations(violations)).toEqual([]);
    act(() => root.unmount());
  });

  it('Register has no critical/serious violations', async () => {
    const { container, root } = render(<Register />);
    const violations = await scan(container);
    expect(violations, describeViolations(violations)).toEqual([]);
    act(() => root.unmount());
  });

  it('GlobalHeader has no critical/serious violations', async () => {
    const { container, root } = render(<GlobalHeader />);
    const violations = await scan(container);
    expect(violations, describeViolations(violations)).toEqual([]);
    act(() => root.unmount());
  });
});
