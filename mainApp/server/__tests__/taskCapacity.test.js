// @vitest-environment node
// EEP2-P4.2.2 · capacity guard on task create/estimate inside a Sprint (DDS §10).
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const Task = require('../models/Task');
const Sprint = require('../models/Sprint');
const Feature = require('../models/Feature');
const Project = require('../models/Project');
const Workspace = require('../models/Workspace');
const User = require('../models/User');
const Activity = require('../models/Activity');
const taskRouter = require('../routes/tasks');

const SECRET = 'p4-2-2-task-capacity-test-secret-32chars';
const OWNER_ID = '5f0000000000000000000c01';
const WS_ID = '5f0000000000000000000c10';
const PROJECT_ID = '5f0000000000000000000c11';
const SPRINT_ID = '5f0000000000000000000c12';
const TASK_ID = '5f0000000000000000000c13';

const signToken = (id) => jwt.sign({ id, tv: 0 }, SECRET, { expiresIn: '30d' });
const cookie = (id) => `ff_session=${signToken(id)}`;

let server;
let baseUrl;

function mockUser() {
  return vi.spyOn(User, 'findById').mockImplementation(() => ({
    select: () => Promise.resolve({ _id: OWNER_ID, name: 'User', email: 'user@focusflow.io', role: 'user', tokenVersion: 0, deletedAt: null }),
  }));
}

function mockWorkspace() {
  return vi.spyOn(Workspace, 'findById').mockImplementation(() => ({
    select: () => Promise.resolve({ _id: WS_ID, members: [{ userId: OWNER_ID, role: 'Owner' }] }),
  }));
}

function mockScope(sprintOver = {}) {
  vi.spyOn(Project, 'findById').mockResolvedValue({ _id: PROJECT_ID, workspaceRef: WS_ID });
  vi.spyOn(Sprint, 'findById').mockResolvedValue({ _id: SPRINT_ID, projectRef: PROJECT_ID, ...sprintOver });
}

beforeAll(async () => {
  process.env.JWT_SECRET = SECRET;
  const app = express();
  app.use(express.json());
  app.use('/api/tasks', taskRouter);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterEach(() => vi.restoreAllMocks());

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('EEP2-P4.2.2 · POST /api/tasks capacity guard', () => {
  it('creates a sprint task within capacity', async () => {
    mockUser();
    mockWorkspace();
    mockScope({ capacityHours: 10 });
    vi.spyOn(Feature, 'find').mockImplementation(() => ({ select: () => Promise.resolve([]) }));
    vi.spyOn(Task, 'find').mockImplementation(() => ({ select: () => Promise.resolve([{ _id: '5f0000000000000000000c20', estimatedHours: 4 }]) }));
    const create = vi.spyOn(Task, 'create').mockImplementation(async (data) => ({ _id: TASK_ID, ...data }));
    vi.spyOn(Activity, 'create').mockResolvedValue(undefined);

    const res = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(OWNER_ID) },
      body: JSON.stringify({
        title: 'Write docs',
        description: '',
        priority: 'medium',
        status: 'todo',
        category: 'Work',
        deadline: '2026-01-01',
        color: '#0ea5e9',
        tags: [],
        subtasks: [],
        workspaceId: WS_ID,
        sprintId: SPRINT_ID,
        estimatedHours: 4,
      }),
    });

    expect(res.status).toBe(201);
    expect(create.mock.calls[0][0]).toMatchObject({ sprintRef: SPRINT_ID, projectRef: PROJECT_ID, workspaceRef: WS_ID });
  });

  it('rejects creating a sprint task that exceeds capacity with 409', async () => {
    mockUser();
    mockWorkspace();
    mockScope({ capacityHours: 5 });
    vi.spyOn(Feature, 'find').mockImplementation(() => ({ select: () => Promise.resolve([]) }));
    vi.spyOn(Task, 'find').mockImplementation(() => ({ select: () => Promise.resolve([{ _id: '5f0000000000000000000c20', estimatedHours: 4 }]) }));
    const create = vi.spyOn(Task, 'create');

    const res = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(OWNER_ID) },
      body: JSON.stringify({
        title: 'Write docs',
        description: '',
        priority: 'medium',
        status: 'todo',
        category: 'Work',
        deadline: '2026-01-01',
        color: '#0ea5e9',
        tags: [],
        subtasks: [],
        workspaceId: WS_ID,
        sprintId: SPRINT_ID,
        estimatedHours: 4,
      }),
    });

    expect(res.status).toBe(409);
    expect(create).not.toHaveBeenCalled();
  });
});

describe('EEP2-P4.2.2 · PATCH /api/tasks/:id capacity guard', () => {
  const existingTask = { _id: TASK_ID, workspaceRef: WS_ID, sprintRef: SPRINT_ID, estimatedHours: 2 };

  it('accepts an estimate change that stays within capacity', async () => {
    mockUser();
    mockWorkspace();
    vi.spyOn(Task, 'findOne').mockImplementation(() => ({ select: () => Promise.resolve(existingTask) }));
    vi.spyOn(Sprint, 'findById').mockResolvedValue({ _id: SPRINT_ID, projectRef: PROJECT_ID, capacityHours: 6 });
    vi.spyOn(Feature, 'find').mockImplementation(() => ({ select: () => Promise.resolve([]) }));
    vi.spyOn(Task, 'find').mockImplementation(() => ({ select: () => Promise.resolve([{ _id: '5f0000000000000000000c20', estimatedHours: 3 }]) }));
    const findOneAndUpdate = vi.spyOn(Task, 'findOneAndUpdate').mockResolvedValue({ ...existingTask, estimatedHours: 3 });

    const res = await fetch(`${baseUrl}/api/tasks/${TASK_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(OWNER_ID) },
      body: JSON.stringify({ estimatedHours: 3 }),
    });

    expect(res.status).toBe(200);
    expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
  });

  it('rejects an estimate change that exceeds capacity with 409', async () => {
    mockUser();
    mockWorkspace();
    vi.spyOn(Task, 'findOne').mockImplementation(() => ({ select: () => Promise.resolve(existingTask) }));
    vi.spyOn(Sprint, 'findById').mockResolvedValue({ _id: SPRINT_ID, projectRef: PROJECT_ID, capacityHours: 6 });
    vi.spyOn(Feature, 'find').mockImplementation(() => ({ select: () => Promise.resolve([]) }));
    vi.spyOn(Task, 'find').mockImplementation(() => ({ select: () => Promise.resolve([{ _id: '5f0000000000000000000c20', estimatedHours: 3 }]) }));
    const findOneAndUpdate = vi.spyOn(Task, 'findOneAndUpdate');

    const res = await fetch(`${baseUrl}/api/tasks/${TASK_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(OWNER_ID) },
      body: JSON.stringify({ estimatedHours: 4 }),
    });

    expect(res.status).toBe(409);
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });
});
