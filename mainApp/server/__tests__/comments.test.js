// @vitest-environment node
// EEP2-P5.3.1 · Comments API — persisted comment threads on a polymorphic
// targetRef (task/worklog/project/doc). Covers the persisted CRUD surface, the
// { targetRef } thread index read path (newest-first keyset page + nested
// replies), targetRef validation/membership gating, and reply-thread integrity.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const Comment = require('../models/Comment');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const Task = require('../models/Task');
const Activity = require('../models/Activity');
const commentRouter = require('../routes/comments');

const SECRET = 'p5-3-comments-test-secret-at-least-32';
const USER_ID = '5f0000000000000000000a01'; // caller (workspace member / personal owner)
const OTHER_ID = '5f0000000000000000000a02';
const WS_ID = '5f0000000000000000000c10';
const TASK_ID = '5f0000000000000000000c13';
const COMMENT_ID = '5f0000000000000000000d01';
const OTHER_COMMENT_ID = '5f0000000000000000000d02';
const REPLY_ID = '5f0000000000000000000d03';

const signToken = (id) => jwt.sign({ id, tv: 0 }, SECRET, { expiresIn: '30d' });
const cookie = (id) => `ff_session=${signToken(id)}`;

let server;
let baseUrl;

function mockUser(overrides = {}) {
  return vi.spyOn(User, 'findById').mockImplementation(() => ({
    select: () => Promise.resolve({
      _id: USER_ID, name: 'Comment Gates', email: 'cg@focusflow.io', role: 'user', avatar: '', tokenVersion: 0, deletedAt: null,
      ...overrides,
    }),
  }));
}

function mockWorkspace(members = [{ userId: USER_ID, role: 'Owner' }]) {
  return vi.spyOn(Workspace, 'findById').mockImplementation(() => ({
    select: () => Promise.resolve({ _id: WS_ID, members }),
  }));
}

// Workspace task visible to the caller (membership verified against Workspace).
function mockWorkspaceTask() {
  return vi.spyOn(Task, 'findById').mockResolvedValue({ _id: TASK_ID, workspaceRef: WS_ID });
}

function commentDoc(id, extra = {}) {
  return {
    _id: { toString: () => id },
    workspaceRef: WS_ID,
    targetType: 'task',
    targetRef: TASK_ID,
    parentId: null,
    authorId: USER_ID,
    authorName: 'Comment Gates',
    authorAvatar: '',
    content: 'Look at this.',
    reactions: {},
    isResolved: false,
    createdAt: new Date('2026-01-05T10:00:00.000Z'),
    save: vi.fn(),
    ...extra,
  };
}

// Comment.find is hit twice in GET: the keyset root query (chained
// .sort().limit(), awaited by paginateCursor) and the replies fetch
// (.sort(), awaited directly). Route on the filter shape.
function mockCommentFind({ roots = [], replies = [] } = {}) {
  return vi.spyOn(Comment, 'find').mockImplementation((filter) => {
    const isRepliesFetch = filter && filter.parentId && typeof filter.parentId === 'object' && '$in' in filter.parentId;
    if (isRepliesFetch) return { sort: () => Promise.resolve(replies) };
    return { sort: () => ({ limit: () => Promise.resolve(roots) }) };
  });
}

beforeAll(async () => {
  process.env.JWT_SECRET = SECRET;
  const app = express();
  app.use(express.json());
  app.use('/api/comments', commentRouter);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterEach(() => vi.restoreAllMocks());

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('EEP2-P5.3.1 · GET /api/comments — persisted thread page', () => {
  it('lists root comments newest-first with nested replies (keyset page)', async () => {
    mockUser();
    mockWorkspace();
    mockWorkspaceTask();
    const root = commentDoc(COMMENT_ID, {
      createdAt: new Date('2026-01-06T10:00:00.000Z'),
      reactions: { '👍': [USER_ID] },
    });
    mockCommentFind({
      roots: [root],
      replies: [commentDoc(REPLY_ID, { parentId: COMMENT_ID, content: 'Agreed', createdAt: new Date('2026-01-06T11:00:00.000Z') })],
    });

    const res = await fetch(`${baseUrl}/api/comments?targetType=task&targetRef=${TASK_ID}`, {
      headers: { Cookie: cookie(USER_ID) },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ id: COMMENT_ID, targetType: 'task', targetRef: TASK_ID, content: 'Look at this.' });
    expect(body.items[0].author).toEqual({ id: USER_ID, name: 'Comment Gates' });
    expect(body.items[0].reactions).toEqual({ '👍': [USER_ID] });
    expect(body.items[0].replies).toHaveLength(1);
    expect(body.items[0].replies[0].content).toBe('Agreed');
    expect(body.hasMore).toBe(false);
    expect(body.nextCursor).toBeNull();
  });

  it('keyset-paginates with limit=1 (hasMore + nextCursor)', async () => {
    mockUser();
    mockWorkspace();
    mockWorkspaceTask();
    mockCommentFind({
      roots: [
        commentDoc(COMMENT_ID, { createdAt: new Date('2026-01-06T10:00:00.000Z') }),
        commentDoc(OTHER_COMMENT_ID, { createdAt: new Date('2026-01-05T10:00:00.000Z') }),
      ],
    });

    const res = await fetch(`${baseUrl}/api/comments?targetType=task&targetRef=${TASK_ID}&limit=1`, {
      headers: { Cookie: cookie(USER_ID) },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.hasMore).toBe(true);
    expect(body.nextCursor).toBeTruthy();
  });

  it('rejects an invalid cursor', async () => {
    mockUser();
    mockWorkspace();
    mockWorkspaceTask();

    const res = await fetch(`${baseUrl}/api/comments?targetType=task&targetRef=${TASK_ID}&cursor=not-a-cursor`, {
      headers: { Cookie: cookie(USER_ID) },
    });
    expect(res.status).toBe(400);
  });

  it('gates a task in a workspace the caller is not a member of', async () => {
    mockUser();
    mockWorkspace([{ userId: OTHER_ID, role: 'Owner' }]);
    mockWorkspaceTask();

    const res = await fetch(`${baseUrl}/api/comments?targetType=task&targetRef=${TASK_ID}`, {
      headers: { Cookie: cookie(USER_ID) },
    });
    expect(res.status).toBe(403);
  });

  it('404s an unknown target', async () => {
    mockUser();
    vi.spyOn(Task, 'findById').mockResolvedValue(null);

    const res = await fetch(`${baseUrl}/api/comments?targetType=task&targetRef=${TASK_ID}`, {
      headers: { Cookie: cookie(USER_ID) },
    });
    expect(res.status).toBe(404);
  });
});

describe('EEP2-P5.3.1 · POST /api/comments — persisted create', () => {
  it('creates a comment on a workspace task the caller can see', async () => {
    mockUser();
    mockWorkspace();
    mockWorkspaceTask();
    const created = commentDoc(COMMENT_ID, { content: 'Hello team', reactions: {} });
    vi.spyOn(Comment, 'create').mockResolvedValue(created);
    vi.spyOn(Activity, 'create').mockResolvedValue({});

    const res = await fetch(`${baseUrl}/api/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify({ targetType: 'task', targetRef: TASK_ID, content: 'Hello team' }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ id: COMMENT_ID, content: 'Hello team', targetRef: TASK_ID });
    expect(Comment.create).toHaveBeenCalledWith(expect.objectContaining({
      targetType: 'task', targetRef: TASK_ID, workspaceRef: WS_ID, authorId: USER_ID, content: 'Hello team', parentId: null,
    }));
  });

  it('rejects a reply whose parent belongs to a different thread', async () => {
    mockUser();
    mockWorkspace();
    mockWorkspaceTask();
    vi.spyOn(Comment, 'create').mockResolvedValue(commentDoc(COMMENT_ID));
    vi.spyOn(Comment, 'findById').mockResolvedValue(commentDoc(OTHER_COMMENT_ID, { targetRef: OTHER_ID, content: 'other thread' }));

    const res = await fetch(`${baseUrl}/api/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify({ targetType: 'task', targetRef: TASK_ID, content: 'reply', parentId: OTHER_COMMENT_ID }),
    });

    expect(res.status).toBe(400);
    expect(Comment.create).not.toHaveBeenCalled();
  });

  it('validates the target before persisting (workspace member gate)', async () => {
    mockUser();
    mockWorkspace([{ userId: OTHER_ID, role: 'Owner' }]);
    mockWorkspaceTask();
    vi.spyOn(Comment, 'create').mockResolvedValue(commentDoc(COMMENT_ID));

    const res = await fetch(`${baseUrl}/api/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify({ targetType: 'task', targetRef: TASK_ID, content: 'nope' }),
    });

    expect(res.status).toBe(403);
    expect(Comment.create).not.toHaveBeenCalled();
  });
});

describe('EEP2-P5.3.1 · PATCH/DELETE — reactions, resolve, delete', () => {
  it('toggles the caller reaction on a comment', async () => {
    mockUser();
    mockWorkspace();
    mockWorkspaceTask();
    const doc = commentDoc(COMMENT_ID, { reactions: {} });
    vi.spyOn(Comment, 'findById').mockResolvedValue(doc);

    const res = await fetch(`${baseUrl}/api/comments/${COMMENT_ID}/reactions`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify({ emoji: '👍' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reactions['👍']).toEqual([USER_ID]);
    expect(doc.save).toHaveBeenCalled();
  });

  it('resolves a thread', async () => {
    mockUser();
    mockWorkspace();
    mockWorkspaceTask();
    const doc = commentDoc(COMMENT_ID, { isResolved: false });
    vi.spyOn(Comment, 'findById').mockResolvedValue(doc);

    const res = await fetch(`${baseUrl}/api/comments/${COMMENT_ID}/resolve`, {
      method: 'PATCH',
      headers: { Cookie: cookie(USER_ID) },
    });

    expect(res.status).toBe(200);
    expect((await res.json()).isResolved).toBe(true);
  });

  it('lets the author delete a comment and cascade its replies', async () => {
    mockUser();
    mockWorkspace();
    mockWorkspaceTask();
    vi.spyOn(Comment, 'findById').mockResolvedValue(commentDoc(COMMENT_ID));
    const deleteMany = vi.spyOn(Comment, 'deleteMany').mockResolvedValue({ deletedCount: 2 });

    const res = await fetch(`${baseUrl}/api/comments/${COMMENT_ID}`, {
      method: 'DELETE',
      headers: { Cookie: cookie(USER_ID) },
    });

    expect(res.status).toBe(200);
    expect(deleteMany).toHaveBeenCalledTimes(1);
    const args = deleteMany.mock.calls[0][0];
    expect(String(args.$or[0]._id)).toBe(COMMENT_ID);
    expect(String(args.$or[1].parentId)).toBe(COMMENT_ID);
  });

  it('blocks a non-author non-editor from deleting a workspace comment', async () => {
    mockUser({ _id: OTHER_ID, name: 'Other', email: 'o@f.io', role: 'user', avatar: '', tokenVersion: 0, deletedAt: null });
    mockWorkspace([{ userId: OTHER_ID, role: 'Viewer' }]);
    mockWorkspaceTask();
    vi.spyOn(Comment, 'findById').mockResolvedValue(commentDoc(COMMENT_ID, { authorId: USER_ID }));
    vi.spyOn(Comment, 'deleteMany').mockResolvedValue({ deletedCount: 1 });

    const res = await fetch(`${baseUrl}/api/comments/${COMMENT_ID}`, {
      method: 'DELETE',
      headers: { Cookie: cookie(OTHER_ID) },
    });

    expect(res.status).toBe(403);
    expect(Comment.deleteMany).not.toHaveBeenCalled();
  });
});
