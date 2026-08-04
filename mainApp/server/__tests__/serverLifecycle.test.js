// @vitest-environment node
import { describe, it, expect, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const mongoose = require('mongoose');
const { connectWithRetry, createShutdownHandler, startServer } = require('../utils/serverLifecycle');

const silentLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  fatal: vi.fn(),
};

function mockProcessExit() {
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
  return exitSpy;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('IES-P0-18 · connectWithRetry', () => {
  it('retries with backoff then succeeds', async () => {
    const connect = vi
      .spyOn(mongoose, 'connect')
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce();

    await connectWithRetry('mongodb://x', { maxRetries: 5, baseDelayMs: 1, logger: silentLogger });

    expect(connect).toHaveBeenCalledTimes(3);
  });

  it('gives up and exits with code 1 after the retry budget', async () => {
    vi.spyOn(mongoose, 'connect').mockRejectedValue(new Error('ECONNREFUSED'));
    const exit = mockProcessExit();

    await connectWithRetry('mongodb://x', { maxRetries: 2, baseDelayMs: 1, logger: silentLogger });

    expect(exit).toHaveBeenCalledWith(1);
    const exhausted = silentLogger.error.mock.calls.find((call) =>
      call.some((arg) => typeof arg === 'string' && arg.includes('retries exhausted'))
    );
    expect(exhausted).toBeTruthy();
  });
});

describe('IES-P0-18 · graceful shutdown', () => {
  it('closes the server, disconnects mongoose, and exits 0', async () => {
    const disconnect = vi.spyOn(mongoose, 'disconnect').mockResolvedValue(undefined);
    const close = vi.fn((cb) => cb());
    const exit = mockProcessExit();

    const shutdown = createShutdownHandler({ server: { close }, timeoutMs: 5000, logger: silentLogger });
    await shutdown('SIGTERM');

    expect(close).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('force-exits if the server refuses to drain', async () => {
    vi.spyOn(mongoose, 'disconnect').mockResolvedValue(undefined);
    const exit = mockProcessExit();
    // A close that never calls its callback.
    const close = vi.fn(() => {});

    const shutdown = createShutdownHandler({ server: { close }, timeoutMs: 50, logger: silentLogger });
    shutdown('SIGINT');
    await new Promise((resolve) => setTimeout(resolve, 120));

    expect(exit).toHaveBeenCalledWith(1);
  });

  it('is a no-op while a shutdown is already in flight', async () => {
    vi.spyOn(mongoose, 'disconnect').mockResolvedValue(undefined);
    const exit = mockProcessExit();
    const close = vi.fn((cb) => setTimeout(cb, 20));

    const shutdown = createShutdownHandler({ server: { close }, timeoutMs: 5000, logger: silentLogger });
    const first = shutdown('SIGTERM');
    const second = shutdown('SIGINT');
    await Promise.all([first, second]);

    expect(close).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });
});

describe('IES-P0-18 · startServer', () => {
  it('resolves with the server once it is listening', async () => {
    const fakeServer = { address: () => ({ port: 1234 }), once: vi.fn() };
    const app = {
      listen: vi.fn((port, cb) => {
        expect(port).toBe(5001);
        setImmediate(cb);
        return fakeServer;
      }),
    };

    const server = await startServer(app, 5001, { logger: silentLogger });
    expect(server).toBe(fakeServer);
  });
});
