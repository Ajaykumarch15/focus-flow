// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const { createSecurityHeaders } = require('../middleware/securityHeaders');

const INDEX_HTML = path.join(__dirname, '..', '..', 'index.html');

let server;
let baseUrl;

beforeAll(async () => {
  const app = express();
  app.use(createSecurityHeaders());
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use((_req, res) => res.status(404).json({ message: 'not found' }));
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

afterAll(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

describe('IES-P0-11 · security headers', () => {
  it('sends a strict Content-Security-Policy header', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    const csp = res.headers.get('content-security-policy');
    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com");
    expect(csp).toContain("font-src 'self' https://fonts.gstatic.com");
    expect(csp).toContain("img-src 'self' data: blob: https:");
    expect(csp).toContain("connect-src 'self' ws://localhost:5173 http://localhost:5001");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it('sends nosniff, referrer-policy, HSTS and framing headers', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    expect(res.headers.get('strict-transport-security')).toContain('max-age=');
    expect(res.headers.get('x-frame-options')).toBeTruthy();
  });

  it('applies the CSP header to 404 responses as well', async () => {
    const res = await fetch(`${baseUrl}/no-such-route`);
    expect(res.status).toBe(404);
    expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
  });

  it('index.html ships a matching CSP meta backstop', () => {
    const html = fs.readFileSync(INDEX_HTML, 'utf8');
    const meta = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/);
    expect(meta).toBeTruthy();
    const content = meta[1];
    expect(content).toContain("default-src 'self'");
    expect(content).toContain("script-src 'self'");
    expect(content).toContain("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com");
    expect(content).toContain("font-src 'self' https://fonts.gstatic.com");
    expect(content).toContain("frame-ancestors 'none'");
    expect(content).toContain("connect-src 'self' ws://localhost:5173 http://localhost:5001");
    expect(content).toContain("object-src 'none'");
  });

  it('index.html ships a no-referrer meta policy', () => {
    const html = fs.readFileSync(INDEX_HTML, 'utf8');
    expect(html).toContain('<meta name="referrer" content="no-referrer"');
  });
});
