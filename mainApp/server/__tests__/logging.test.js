// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'node:http';
import { Writable } from 'node:stream';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const { configureLogger, requestLogger, redactUrl } = require('../utils/logger');
const errorHandler = require('../middleware/errorHandler');

const OBJECT_ID = '507f1f77bcf86cd799439011';
const EMAIL = 'leak@example.com';
const SHARE_TOKEN = 's3cr3tShareTokenValue';

function makeSink() {
  const lines = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      lines.push(chunk.toString());
      cb();
    },
  });
  return { lines, stream };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('IES-P0-20 · redactUrl', () => {
  it('redacts 24-hex ObjectIds in URL paths', () => {
    expect(redactUrl(`/api/tasks/${OBJECT_ID}`)).toContain('[REDACTED]');
    expect(redactUrl(`/api/tasks/${OBJECT_ID}`)).not.toContain(OBJECT_ID);
  });

  it('redacts report share tokens', () => {
    expect(redactUrl(`/api/reports/share/token/${SHARE_TOKEN}`)).toBe('/api/reports/share/token/[REDACTED]');
    expect(redactUrl(`/api/reports/share/${SHARE_TOKEN}/revoke`)).toBe('/api/reports/share/[REDACTED]/revoke');
  });

  it('redacts emails in query strings', () => {
    expect(redactUrl(`/q?email=${EMAIL}`)).not.toContain(EMAIL);
  });
});

describe('IES-P0-20 · structured request logging', () => {
  let server;
  let baseUrl;
  let sink;

  beforeAll(async () => {
    sink = makeSink();
    configureLogger({ destination: sink.stream, level: 'info' });

    const app = express();
    app.use(requestLogger);
    app.get('/api/tasks/:id', (_req, res) => res.json({ ok: true }));
    app.get('/boom', (_req, _res, next) => next(new Error(`boom for ${EMAIL}`)));
    app.use(errorHandler);

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('logs request id, status, duration, and a redacted URL', async () => {
    const res = await fetch(`${baseUrl}/api/tasks/${OBJECT_ID}`);
    expect(res.status).toBe(200);
    await sleep(150);

    const requestLine = sink.lines.map((l) => JSON.parse(l)).find((l) => l.msg === 'request completed');
    expect(requestLine).toBeTruthy();
    expect(requestLine.req.id).toBeTruthy();
    expect(requestLine.res.statusCode).toBe(200);
    expect(typeof requestLine.durationMs).toBe('number');
    expect(requestLine.req.url).toContain('[REDACTED]');
    expect(requestLine.req.url).not.toContain(OBJECT_ID);
  });

  it('does not leak emails through the error path', async () => {
    const res = await fetch(`${baseUrl}/boom`);
    expect(res.status).toBe(500);
    await sleep(150);

    const all = sink.lines.join('\n');
    expect(all).not.toContain(EMAIL);
    expect(all).toContain('request failed');
  });
});
