// @vitest-environment node
// EEP2-P5.3.2 · Attachments API — persisted file attachments on a polymorphic
// targetRef (task/worklog/project/doc). Covers the persisted CRUD surface, the
// { targetRef } index read path (newest-first keyset page), targetRef
// validation/membership gating, the size caps (per-file + per-target), and the
// uploader/editor delete gate.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const Attachment = require('../models/Attachment');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const Task = require('../models/Task');
const Activity = require('../models/Activity');
const attachmentRouter = require('../routes/attachments');

const {
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_ATTACHMENTS_PER_TARGET,
} = require('../models/Attachment');

const SECRET = 'p5-3-attachments-test-secret-at-least-32';
const USER_ID = '5f0000000000000000000a01'; // caller (workspace member / uploader)
const OTHER_ID = '5f0000000000000000000a02';
const WS_ID = '5f0000000000000000000c10';
const TASK_ID = '5f0000000000000000000c13';
const ATT_ID = '5f0000000000000000000d21';
const OTHER_ATT_ID = '5f0000000000000000000d22';

const signToken = (id) => jwt.sign({ id, tv: 0 }, SECRET, { expiresIn: '30d' });
const cookie = (id) => `ff_session=${signToken(id)}`;

let server;
let baseUrl;

function mockUser(overrides = {}) {
  return vi.spyOn(User, 'findById').mockImplementation(() => ({
    select: () => Promise.resolve({
      _id: USER_ID, name: 'Attachment Gates', email: 'ag@focusflow.io', role: 'user', avatar: '', tokenVersion: 0, deletedAt: null,
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

function attachmentDoc(id, extra = {}) {
  return {
    _id: { toString: () => id },
    workspaceRef: WS_ID,
    targetType: 'task',
    targetRef: TASK_ID,
    name: 'Design spec',
    type: 'image',
    url: 'https://files.example.com/spec.png',
    sizeBytes: 1024,
    description: '',
    uploadedBy: USER_ID,
    uploaderName: 'Attachment Gates',
    uploaderAvatar: '',
    createdAt: new Date('2026-01-05T10:00:00.000Z'),
    ...extra,
  };
}

function mockAttachmentFind(items = []) {
  return vi.spyOn(Attachment, 'find').mockImplementation(() => ({
    sort: () => ({ limit: () => Promise.resolve(items) }),
  }));
}

beforeAll(async () => {
  process.env.JWT_SECRET = SECRET;
  const app = express();
  app.use(express.json());
  app.use('/api/attachments', attachmentRouter);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterEach(() => vi.restoreAllMocks());

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('EEP2-P5.3.2 · GET /api/attachments — persisted page', () => {
  it('lists the target attachments newest-first (keyset page)', async () => {
    mockUser();
    mockWorkspace();
    mockWorkspaceTask();
    mockAttachmentFind([attachmentDoc(ATT_ID)]);

    const res = await fetch(`${baseUrl}/api/attachments?targetType=task&targetRef=${TASK_ID}`, {
      headers: { Cookie: cookie(USER_ID) },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      id: ATT_ID, targetType: 'task', targetRef: TASK_ID, name: 'Design spec', url: 'https://files.example.com/spec.png', sizeBytes: 1024,
    });
    expect(body.items[0].uploadedBy).toEqual({ id: USER_ID, name: 'Attachment Gates' });
    expect(body.hasMore).toBe(false);
    expect(body.nextCursor).toBeNull();
  });

  it('keyset-paginates with limit=1 (hasMore + nextCursor)', async () => {
    mockUser();
    mockWorkspace();
    mockWorkspaceTask();
    mockAttachmentFind([
      attachmentDoc(ATT_ID, { createdAt: new Date('2026-01-06T10:00:00.000Z') }),
      attachmentDoc(OTHER_ATT_ID, { createdAt: new Date('2026-01-05T10:00:00.000Z') }),
    ]);

    const res = await fetch(`${baseUrl}/api/attachments?targetType=task&targetRef=${TASK_ID}&limit=1`, {
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

    const res = await fetch(`${baseUrl}/api/attachments?targetType=task&targetRef=${TASK_ID}&cursor=not-a-cursor`, {
      headers: { Cookie: cookie(USER_ID) },
    });
    expect(res.status).toBe(400);
  });

  it('gates a task in a workspace the caller is not a member of', async () => {
    mockUser();
    mockWorkspace([{ userId: OTHER_ID, role: 'Owner' }]);
    mockWorkspaceTask();

    const res = await fetch(`${baseUrl}/api/attachments?targetType=task&targetRef=${TASK_ID}`, {
      headers: { Cookie: cookie(USER_ID) },
    });
    expect(res.status).toBe(403);
  });

  it('404s an unknown target', async () => {
    mockUser();
    vi.spyOn(Task, 'findById').mockResolvedValue(null);

    const res = await fetch(`${baseUrl}/api/attachments?targetType=task&targetRef=${TASK_ID}`, {
      headers: { Cookie: cookie(USER_ID) },
    });
    expect(res.status).toBe(404);
  });
});

describe('EEP2-P5.3.2 · POST /api/attachments — persisted create + caps', () => {
  it('creates an attachment on a workspace task the caller can see', async () => {
    mockUser();
    mockWorkspace();
    mockWorkspaceTask();
    vi.spyOn(Attachment, 'countDocuments').mockResolvedValue(0);
    const created = attachmentDoc(ATT_ID, { name: 'Spec' });
    vi.spyOn(Attachment, 'create').mockResolvedValue(created);
    vi.spyOn(Activity, 'create').mockResolvedValue({});

    const res = await fetch(`${baseUrl}/api/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify({ targetType: 'task', targetRef: TASK_ID, name: 'Spec', url: 'https://files.example.com/spec.png', sizeBytes: 1024 }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({ id: ATT_ID, name: 'Spec', targetRef: TASK_ID });
    expect(Attachment.create).toHaveBeenCalledWith(expect.objectContaining({
      targetType: 'task', targetRef: TASK_ID, workspaceRef: WS_ID, uploadedBy: USER_ID, name: 'Spec', type: 'file',
    }));
  });

  it('rejects a file larger than the size cap', async () => {
    mockUser();
    mockWorkspace();
    mockWorkspaceTask();
    vi.spyOn(Attachment, 'create').mockResolvedValue(attachmentDoc(ATT_ID));

    const res = await fetch(`${baseUrl}/api/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify({ targetType: 'task', targetRef: TASK_ID, name: 'huge', url: 'https://files.example.com/huge.bin', sizeBytes: MAX_ATTACHMENT_SIZE_BYTES + 1 }),
    });

    expect(res.status).toBe(400);
    expect(Attachment.create).not.toHaveBeenCalled();
  });

  it('rejects once a target has hit the per-target cap', async () => {
    mockUser();
    mockWorkspace();
    mockWorkspaceTask();
    vi.spyOn(Attachment, 'countDocuments').mockResolvedValue(MAX_ATTACHMENTS_PER_TARGET);
    vi.spyOn(Attachment, 'create').mockResolvedValue(attachmentDoc(ATT_ID));

    const res = await fetch(`${baseUrl}/api/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify({ targetType: 'task', targetRef: TASK_ID, name: 'x', url: 'https://files.example.com/x' }),
    });

    expect(res.status).toBe(400);
    expect(Attachment.create).not.toHaveBeenCalled();
  });

  it('validates the target before persisting (workspace member gate)', async () => {
    mockUser();
    mockWorkspace([{ userId: OTHER_ID, role: 'Owner' }]);
    mockWorkspaceTask();
    vi.spyOn(Attachment, 'create').mockResolvedValue(attachmentDoc(ATT_ID));

    const res = await fetch(`${baseUrl}/api/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify({ targetType: 'task', targetRef: TASK_ID, name: 'x', url: 'https://files.example.com/x' }),
    });

    expect(res.status).toBe(403);
    expect(Attachment.create).not.toHaveBeenCalled();
  });
});

describe('EEP2-P5.3.2 · DELETE /api/attachments/:id — uploader gate', () => {
  it('lets the uploader delete an attachment', async () => {
    mockUser();
    mockWorkspace();
    mockWorkspaceTask();
    vi.spyOn(Attachment, 'findById').mockResolvedValue(attachmentDoc(ATT_ID));
    const deleteOne = vi.spyOn(Attachment, 'deleteOne').mockResolvedValue({ deletedCount: 1 });

    const res = await fetch(`${baseUrl}/api/attachments/${ATT_ID}`, {
      method: 'DELETE',
      headers: { Cookie: cookie(USER_ID) },
    });

    expect(res.status).toBe(200);
    expect(deleteOne).toHaveBeenCalledTimes(1);
    expect(String(deleteOne.mock.calls[0][0]._id)).toBe(ATT_ID);
  });

  it('blocks a non-uploader non-editor from deleting a workspace attachment', async () => {
    mockUser({ _id: OTHER_ID, name: 'Other', email: 'o@f.io', role: 'user', avatar: '', tokenVersion: 0, deletedAt: null });
    mockWorkspace([{ userId: OTHER_ID, role: 'Viewer' }]);
    mockWorkspaceTask();
    vi.spyOn(Attachment, 'findById').mockResolvedValue(attachmentDoc(ATT_ID, { uploadedBy: USER_ID }));
    vi.spyOn(Attachment, 'deleteOne').mockResolvedValue({ deletedCount: 1 });

    const res = await fetch(`${baseUrl}/api/attachments/${ATT_ID}`, {
      method: 'DELETE',
      headers: { Cookie: cookie(OTHER_ID) },
    });

    expect(res.status).toBe(403);
    expect(Attachment.deleteOne).not.toHaveBeenCalled();
  });

  it('404s an unknown attachment', async () => {
    mockUser();
    vi.spyOn(Attachment, 'findById').mockResolvedValue(null);

    const res = await fetch(`${baseUrl}/api/attachments/${ATT_ID}`, {
      method: 'DELETE',
      headers: { Cookie: cookie(USER_ID) },
    });

    expect(res.status).toBe(404);
  });
});
