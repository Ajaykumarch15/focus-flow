// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const mongoose = require('mongoose');
const { healthRoutes, metricsMiddleware, metrics, readinessState } = require('../middleware/health');

let server;
let baseUrl;

// Shadow mongoose.connection.readyState with an own property so we can simulate
// connected / disconnected states without a real DB.
function setReadyState(state) {
  Object.defineProperty(mongoose.connection, 'readyState', {
    configurable: true,
    get: () => state,
  });
}

function resetReadyState() {
  delete mongoose.connection.readyState;
}

function buildApp() {
  const app = express();
  app.use('/api', metricsMiddleware);
  app.use('/api', healthRoutes());
  return app;
}

beforeAll(async () => {
  setReadyState(1);
  server = http.createServer(buildApp());
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterEach(() => {
  resetReadyState();
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('IES-P0-19 · liveness / readiness', () => {
  it('/api/health reports ok with DB state and uptime', async () => {
    setReadyState(1);
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.db.connected).toBe(true);
    expect(typeof body.uptime).toBe('number');
    expect(typeof body.memory).toBe('object');
    expect(body.time).toBeTruthy();
  });

  it('/api/health/ready returns 200 when the DB is connected', async () => {
    setReadyState(1);
    const res = await fetch(`${baseUrl}/api/health/ready`);
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe('ready');
  });

  it('/api/health/ready returns 503 when the DB is down', async () => {
    setReadyState(0);
    const res = await fetch(`${baseUrl}/api/health/ready`);
    expect(res.status).toBe(503);
    expect((await res.json()).status).toBe('not_ready');
  });

  it('readinessState mirrors mongoose connection state', () => {
    setReadyState(2);
    expect(readinessState()).toBe(2);
  });
});

describe('IES-P0-19 · metrics', () => {
  it('counts requests by method and status', async () => {
    setReadyState(1);
    const before = metrics.requests.total;

    await fetch(`${baseUrl}/api/health`);
    await fetch(`${baseUrl}/api/health`);
    await fetch(`${baseUrl}/api/nope`);

    expect(metrics.requests.total).toBe(before + 3);
    expect(metrics.requests.byMethod.GET).toBeGreaterThanOrEqual(3);
    expect(metrics.requests.byStatus['404']).toBeGreaterThanOrEqual(1);
    expect(metrics.requests.byStatus['200']).toBeGreaterThanOrEqual(2);

    const res = await fetch(`${baseUrl}/api/metrics`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requests.total).toBe(metrics.requests.total);
    expect(body.startedAt).toBeTruthy();
  });
});
