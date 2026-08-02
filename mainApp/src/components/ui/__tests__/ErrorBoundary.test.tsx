import { describe, it, expect, vi, afterEach } from 'vitest';
import React, { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from '../ErrorBoundary';

// IES-P0-24: ErrorBoundary must render a recovery fallback instead of a blank page.

function render(ui: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(ui));
  return {
    container,
    async unmount() {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

function Thrower({ message = 'kaboom' }: { message?: string }): ReactNode {
  throw new Error(message);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ErrorBoundary (IES-P0-24)', () => {
  it('renders children normally when nothing throws', () => {
    const { container, unmount } = render(<ErrorBoundary><div>ok</div></ErrorBoundary>);
    expect(container.textContent).toBe('ok');
    unmount();
  });

  it('renders the fallback when a child throws', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container, unmount } = render(
      <ErrorBoundary fallback={<div data-testid="fallback">Oops</div>}>
        <Thrower />
      </ErrorBoundary>,
    );
    expect(container.textContent).toContain('Oops');
    expect(container.querySelector('[data-testid="fallback"]')).toBeTruthy();
    unmount();
    errorSpy.mockRestore();
  });

  it('reset re-renders children once they stop throwing', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let shouldThrow = true;
    function Flaky() {
      if (shouldThrow) throw new Error('flaky');
      return <div>recovered</div>;
    }
    const fallback = ({ reset }: { reset: () => void }) => (
      <button type="button" onClick={reset}>Try again</button>
    );

    const { container, unmount } = render(
      <ErrorBoundary fallback={fallback}><Flaky /></ErrorBoundary>,
    );
    expect(container.textContent).toBe('Try again');

    shouldThrow = false;
    await act(async () => {
      (container.querySelector('button') as HTMLButtonElement).click();
    });
    expect(container.textContent).toBe('recovered');
    unmount();
    errorSpy.mockRestore();
  });

  it('default fallback exposes error message and a reload button', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container, unmount } = render(
      <ErrorBoundary><Thrower message="page exploded" /></ErrorBoundary>,
    );
    expect(container.textContent).toContain('page exploded');
    const buttons = Array.from(container.querySelectorAll('button')).map((b) => b.textContent);
    expect(buttons).toEqual(expect.arrayContaining(['Try again', 'Reload app']));
    unmount();
    errorSpy.mockRestore();
  });
});
