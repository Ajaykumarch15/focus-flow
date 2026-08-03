// @vitest-environment node
// IES-P2-05 · Notifications backend — user-scoped list (keyset-paginated),
// unread-count badge, mark-one-read (owner-only), and mark-all-read. The
// notifications themselves are created by workspaces.js (invite/role/remove);
// this surface only reads + marks.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Notification = require('../models/Notification');
const notificationRouter = require('../routes/notifications');

const SECRET = 'p2-05-test-notifications-32char';
const OWNER_ID = '5f0000000000000000000c01';
const OTHER_ID = '5f0000000000000000000c02';
const NOTIF_ID = '5f0000000000000000000d01';
const NOTIF_ID_2 = '5f0000000000000000000d02';
const WS_ID = '5f0000000000000000000c10';

const signToken = (id = OWNER_ID) => jwt.sign({ id, tv: 0 }, SECRET, { expiresIn: '30d' });
const cookie = (id = OWNER_ID) => `ff_session=${signToken(id)}`;

let server;
let baseUrl;

function user(id) {
  return { _id: id, name: 'User', email: 'user@focusflow.io', role: 'user', tokenVersion: 0, deletedAt: null };
}

function mockUser(u) {
  return vi.spyOn(User, 'findById').mockImplementation(() => ({ select: () => Promise.resolve(u) }));
}

function notifDoc({ id = NOTIF_ID, read = false, type = 'invited', title = 'You were invited to Acme', userId = OWNER_ID } = {}) {
  return {
    _id: id,
    userId,
    workspaceRef: WS_ID,
    actor: { id: OTHER_ID, name: 'Other User', email: 'other@focusflow.io', avatar: '' },
    type,
    title,
    body: 'Other User added you to the workspace.',
    targetUrl: `/w/${WS_ID}/overview`,
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    read,
  };
}

// paginateCursor chain: find(...).sort(...).limit(...)
function mockFind(list) {
  return vi.spyOn(Notification, 'find').mockReturnValue({
    sort: () => ({ limit: () => Promise.resolve(list) }),
  });
}

beforeAll(async () => {
  process.env.JWT_SECRET = SECRET;
  process.env.CLIENT_URL = 'http://localhost:5173';

  const app = express();
  app.use(express.json());
  app.use('/api/notifications', notificationRouter);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('IES-P2-05 · auth required', () => {
  it('rejects an anonymous GET / with 401', async () => {
    const res = await fetch(`${baseUrl}/api/notifications`);
    expect(res.status).toBe(401);
  });

  it('rejects an anonymous PATCH /read-all with 401', async () => {
    const res = await fetch(`${baseUrl}/api/notifications/read-all`, { method: 'PATCH' });
    expect(res.status).toBe(401);
  });
});

describe('IES-P2-05 · GET / lists the caller’s notifications newest-first', () => {
  it('returns the paginated NotificationItem contract', async () => {
    mockUser(user(OWNER_ID));
    mockFind([notifDoc({ read: false }), notifDoc({ id: NOTIF_ID_2, read: true })]);

    const res = await fetch(`${baseUrl}/api/notifications`, { headers: { Cookie: cookie() } });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.hasMore).toBe(false);
    expect(body.nextCursor).toBe(null);
    expect(body.items).toHaveLength(2);

    const [first] = body.items;
    expect(first.id).toBe(NOTIF_ID);
    expect(first.recipientId).toBe(OWNER_ID);
    expect(first.workspaceId).toBe(WS_ID);
    expect(first.type).toBe('invited');
    expect(first.title).toBe('You were invited to Acme');
    expect(first.read).toBe(false);
    expect(first.actor).toEqual(expect.objectContaining({ id: OTHER_ID, name: 'Other User' }));
    expect(new Date(first.createdAt).getTime()).toBe(new Date('2026-08-01T10:00:00.000Z').getTime());
  });

  it('filters to unread only when unreadOnly=true', async () => {
    mockUser(user(OWNER_ID));
    let capturedQuery;
    vi.spyOn(Notification, 'find').mockImplementation((query) => {
      capturedQuery = query;
      return { sort: () => ({ limit: () => Promise.resolve([]) }) };
    });

    const res = await fetch(`${baseUrl}/api/notifications?unreadOnly=true`, { headers: { Cookie: cookie() } });
    expect(res.status).toBe(200);
    expect(capturedQuery.read).toBe(false);
    expect(capturedQuery.userId).toBe(OWNER_ID);
  });

  it('rejects an invalid limit with 400', async () => {
    mockUser(user(OWNER_ID));
    const res = await fetch(`${baseUrl}/api/notifications?limit=5000`, { headers: { Cookie: cookie() } });
    expect(res.status).toBe(400);
  });
});

describe('IES-P2-05 · GET /unread-count', () => {
  it('returns the unread badge count for the caller only', async () => {
    mockUser(user(OWNER_ID));
    const spy = vi.spyOn(Notification, 'countDocuments').mockResolvedValue(3);

    const res = await fetch(`${baseUrl}/api/notifications/unread-count`, { headers: { Cookie: cookie() } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ count: 3 });
    expect(spy).toHaveBeenCalledWith({ userId: OWNER_ID, read: false });
  });
});

describe('IES-P2-05 · PATCH /read-all', () => {
  it('marks only the caller’s notifications read', async () => {
    mockUser(user(OWNER_ID));
    const spy = vi.spyOn(Notification, 'updateMany').mockResolvedValue({ modifiedCount: 2 });

    const res = await fetch(`${baseUrl}/api/notifications/read-all`, {
      method: 'PATCH',
      headers: { Cookie: cookie() },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ updated: 2 });
    expect(spy).toHaveBeenCalledWith(
      { userId: OWNER_ID, read: false },
      { $set: { read: true } }
    );
  });
});

describe('IES-P2-05 · PATCH /:id/read — owner-only single mark', () => {
  it('scopes the update to the caller’s own notification', async () => {
    mockUser(user(OWNER_ID));
    let capturedFilter;
    vi.spyOn(Notification, 'findOneAndUpdate').mockImplementation((filter) => {
      capturedFilter = filter;
      return Promise.resolve(notifDoc({ read: true }));
    });

    const res = await fetch(`${baseUrl}/api/notifications/${NOTIF_ID}/read`, {
      method: 'PATCH',
      headers: { Cookie: cookie() },
    });
    expect(res.status).toBe(200);
    expect(capturedFilter).toEqual({ _id: NOTIF_ID, userId: OWNER_ID });
    const body = await res.json();
    expect(body.id).toBe(NOTIF_ID);
    expect(body.read).toBe(true);
  });

  it('404s when the notification is not owned by the caller', async () => {
    mockUser(user(OWNER_ID));
    vi.spyOn(Notification, 'findOneAndUpdate').mockResolvedValue(null);

    const res = await fetch(`${baseUrl}/api/notifications/${NOTIF_ID}/read`, {
      method: 'PATCH',
      headers: { Cookie: cookie() },
    });
    expect(res.status).toBe(404);
  });

  it('rejects a malformed notification id with 400', async () => {
    mockUser(user(OWNER_ID));
    const res = await fetch(`${baseUrl}/api/notifications/not-an-id/read`, {
      method: 'PATCH',
      headers: { Cookie: cookie() },
    });
    expect(res.status).toBe(400);
  });
});
