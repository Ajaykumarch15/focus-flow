// @vitest-environment node
// EEP2-P5.4.2: the sprint board timer must be able to start on a workspace
// task — not just on tasks the caller owns. POST /api/sessions gates a collab
// card by workspace membership (sessions + the worklog rows they write stay
// user-scoped). Covered: member starts 201, non-member 403, neither-owned-nor-
// workspace task 404, and the existing own-task path is unchanged.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');
const Task = require('../models/Task');
const WorkLog = require('../models/WorkLog');
const Activity = require('../models/Activity');
const Workspace = require('../models/Workspace');
const sessionsRouter = require('../routes/sessions');

const OWNER_ID = '5f00000000000000000000aa';
const CALLER_ID = '5f00000000000000000000ab';
const WS_ID = '5f00000000000000000000ac';
const TASK_ID = '5f00000000000000000000ad';

describe('POST /api/sessions · workspace task start (EEP2-P5.4.2)', () => {
  let server;
  let baseUrl;
  let callerUser;

  function signToken() {
    return jwt.sign({ id: CALLER_ID }, process.env.JWT_SECRET, { expiresIn: '1h' });
  }

  function startPost() {
    return fetch(`${baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${signToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: TASK_ID }),
    });
  }

  beforeEach(() => {
    // Clear call history only — implementations set in beforeAll (User.findById,
    // Activity.create, WorkLog.find) and per-test keep working.
    vi.clearAllMocks();
  });

  beforeAll(async () => {
    process.env.JWT_SECRET = 'p5-4-2-test-secret-at-least-32-chars-long';
    callerUser = {
      _id: CALLER_ID,
      name: 'Member',
      email: 'member@example.com',
      settings: {},
      streak: {},
    };

    vi.spyOn(User, 'findById').mockImplementation(() => ({
      select: () => Promise.resolve(callerUser),
    }));
    vi.spyOn(Activity, 'create').mockImplementation(() => Promise.resolve());
    vi.spyOn(WorkLog, 'find').mockResolvedValue([]);

    const app = express();
    app.use(express.json());
    app.use('/api/sessions', sessionsRouter);
    app.use((err, req, res, next) => {
      res.status(500).json({ message: err.message, stack: err.stack });
    });
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await new Promise((resolve) => server.close(resolve));
  });

  it('starts a session on a workspace task the caller is a member of', async () => {
    const collabTask = { _id: TASK_ID, userId: OWNER_ID, title: 'Shared board task', workspaceRef: WS_ID };
    // The owner query misses (caller is not the task's userId); the workspace
    // lookup hits, then the membership gate passes.
    vi.spyOn(Task, 'findOne').mockImplementation(async (filter) =>
      filter.userId ? null : filter.workspaceRef ? collabTask : null
    );
    vi.spyOn(Workspace, 'findById').mockImplementation(() => ({
      select: async () => ({ members: [{ userId: CALLER_ID, role: 'Developer' }] }),
    }));
    vi.spyOn(Session, 'findOne').mockResolvedValue(null);
    vi.spyOn(Session, 'find').mockResolvedValue([]);
    vi.spyOn(Session, 'create').mockImplementation(async (doc) => ({ _id: 'sess-collab', ...doc }));
    vi.spyOn(Task, 'findByIdAndUpdate').mockResolvedValue({});

    const res = await startPost();
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.taskId).toBe(TASK_ID);
    expect(Session.create).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: TASK_ID, userId: CALLER_ID, isActive: true })
    );
  });

  it('rejects a workspace task when the caller is not a member', async () => {
    const collabTask = { _id: TASK_ID, userId: OWNER_ID, title: 'Shared board task', workspaceRef: WS_ID };
    vi.spyOn(Task, 'findOne').mockImplementation(async (filter) =>
      filter.userId ? null : filter.workspaceRef ? collabTask : null
    );
    vi.spyOn(Workspace, 'findById').mockImplementation(() => ({
      select: async () => ({ members: [] }),
    }));
    const create = vi.spyOn(Session, 'create').mockImplementation(async () => ({}));

    const res = await startPost();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.message).toContain('not a member');
    expect(create).not.toHaveBeenCalled();
  });

  it('treats a task that is neither owned nor workspace-scoped as not found', async () => {
    vi.spyOn(Task, 'findOne').mockResolvedValue(null);
    const create = vi.spyOn(Session, 'create').mockImplementation(async () => ({}));

    const res = await startPost();
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.message).toContain('Task not found');
    expect(create).not.toHaveBeenCalled();
  });

  it('still allows the caller to start a session on their own task', async () => {
    const ownTask = { _id: TASK_ID, userId: CALLER_ID, title: 'My task' };
    vi.spyOn(Task, 'findOne').mockImplementation(async (filter) =>
      filter.userId ? ownTask : null
    );
    vi.spyOn(Session, 'findOne').mockResolvedValue(null);
    vi.spyOn(Session, 'find').mockResolvedValue([]);
    vi.spyOn(Session, 'create').mockImplementation(async (doc) => ({ _id: 'sess-own', ...doc }));
    vi.spyOn(Task, 'findByIdAndUpdate').mockResolvedValue({});

    const res = await startPost();
    expect(res.status).toBe(201);
  });
});
