// @vitest-environment node
// EEP2-P5.2.1 · Dependencies API — `dependencies` write on PATCH and on
// workspace create, with the DDS §4.9 same-project scope rule and the cycle
// guard. Personal tasks may only depend on the owner's own personal tasks.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const Task = require('../models/Task');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const Activity = require('../models/Activity');
const taskRouter = require('../routes/tasks');

const SECRET = 'p5-2-deps-test-secret-at-least-32';
const USER_ID = '5f0000000000000000000a01'; // caller (workspace editor / personal owner)
const OTHER_ID = '5f0000000000000000000a02'; // task creator (not the caller)
const WS_ID = '5f0000000000000000000c10';
const PROJ_ID = '5f0000000000000000000c11';
const OTHER_PROJ_ID = '5f0000000000000000000c12';
const TASK_ID = '5f0000000000000000000c13';
const DEP_A_ID = '5f0000000000000000000c15';
const DEP_B_ID = '5f0000000000000000000c16';

const signToken = (id) => jwt.sign({ id, tv: 0 }, SECRET, { expiresIn: '30d' });
const cookie = (id) => `ff_session=${signToken(id)}`;

let server;
let baseUrl;

function mockUser() {
  return vi.spyOn(User, 'findById').mockImplementation(() => ({
    select: () => Promise.resolve({ _id: USER_ID, name: 'Dep Gates', email: 'dg@focusflow.io', role: 'user', tokenVersion: 0, deletedAt: null }),
  }));
}

function mockWorkspace(members = [{ userId: USER_ID, role: 'Owner' }]) {
  return vi.spyOn(Workspace, 'findById').mockImplementation(() => ({
    select: () => Promise.resolve({ _id: WS_ID, members }),
  }));
}

function mockTaskFindOne(existing) {
  return vi.spyOn(Task, 'findOne').mockImplementation(() => ({
    select: () => Promise.resolve(existing),
  }));
}

// The cycle walker uses Task.findById; a default of `{ dependencies: [] }`
// means no candidate reaches the parent (no cycle).
function mockTaskFindById(depsByAnyId = {}) {
  return vi.spyOn(Task, 'findById').mockImplementation((id) => {
    const deps = depsByAnyId[String(id)] ?? [];
    return { select: () => Promise.resolve({ _id: id, dependencies: deps }) };
  });
}

function workspaceTaskBody(extra = {}) {
  return {
    title: 'Wire the API',
    description: '',
    priority: 'medium',
    status: 'todo',
    category: 'Work',
    color: '#0ea5e9',
    tags: [],
    subtasks: [],
    workspaceId: WS_ID,
    ...extra,
  };
}

function personalTaskBody(extra = {}) {
  return {
    title: 'Personal task',
    description: '',
    priority: 'medium',
    status: 'todo',
    category: 'Work',
    color: '#0ea5e9',
    tags: [],
    subtasks: [],
    ...extra,
  };
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

describe('EEP2-P5.2.1 · PATCH /api/tasks/:id dependencies — same-scope + cycle guard', () => {
  it('persists a valid same-project dependency set on a workspace task', async () => {
    mockUser();
    mockWorkspace([{ userId: USER_ID, role: 'Editor' }]);
    mockTaskFindOne({ _id: TASK_ID, workspaceRef: WS_ID, projectRef: PROJ_ID, userId: OTHER_ID });
    vi.spyOn(Task, 'find').mockResolvedValue([{ _id: DEP_A_ID, workspaceRef: WS_ID, projectRef: PROJ_ID }]);
    mockTaskFindById();
    const findOneAndUpdate = vi.spyOn(Task, 'findOneAndUpdate')
      .mockResolvedValue({ _id: TASK_ID, dependencies: [DEP_A_ID] });

    const res = await fetch(`${baseUrl}/api/tasks/${TASK_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify({ dependencies: [DEP_A_ID] }),
    });

    expect(res.status).toBe(200);
    const [filter, update] = findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ _id: TASK_ID });
    expect(update).toEqual({ $set: { dependencies: [DEP_A_ID] } });
  });

  it('dedupes the stored dependency list', async () => {
    mockUser();
    mockWorkspace([{ userId: USER_ID, role: 'Editor' }]);
    mockTaskFindOne({ _id: TASK_ID, workspaceRef: WS_ID, projectRef: PROJ_ID, userId: OTHER_ID });
    vi.spyOn(Task, 'find').mockResolvedValue([{ _id: DEP_A_ID, workspaceRef: WS_ID, projectRef: PROJ_ID }]);
    mockTaskFindById();
    const findOneAndUpdate = vi.spyOn(Task, 'findOneAndUpdate').mockResolvedValue({ _id: TASK_ID });

    const res = await fetch(`${baseUrl}/api/tasks/${TASK_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify({ dependencies: [DEP_A_ID, DEP_A_ID] }),
    });

    expect(res.status).toBe(200);
    const [, update] = findOneAndUpdate.mock.calls[0];
    expect(update).toEqual({ $set: { dependencies: [DEP_A_ID] } });
  });

  it('rejects a dependency from another project with 400', async () => {
    mockUser();
    mockWorkspace([{ userId: USER_ID, role: 'Editor' }]);
    mockTaskFindOne({ _id: TASK_ID, workspaceRef: WS_ID, projectRef: PROJ_ID, userId: OTHER_ID });
    vi.spyOn(Task, 'find').mockResolvedValue([{ _id: DEP_A_ID, workspaceRef: WS_ID, projectRef: OTHER_PROJ_ID }]);
    const findOneAndUpdate = vi.spyOn(Task, 'findOneAndUpdate');

    const res = await fetch(`${baseUrl}/api/tasks/${TASK_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify({ dependencies: [DEP_A_ID] }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toBe('Dependencies must be tasks of the same project');
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects a dependency from another workspace with 400', async () => {
    mockUser();
    mockWorkspace([{ userId: USER_ID, role: 'Editor' }]);
    mockTaskFindOne({ _id: TASK_ID, workspaceRef: WS_ID, userId: OTHER_ID });
    vi.spyOn(Task, 'find').mockResolvedValue([{ _id: DEP_A_ID, workspaceRef: OTHER_PROJ_ID }]);
    const findOneAndUpdate = vi.spyOn(Task, 'findOneAndUpdate');

    const res = await fetch(`${baseUrl}/api/tasks/${TASK_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify({ dependencies: [DEP_A_ID] }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toBe('Dependencies must be tasks in the same workspace');
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects an unknown dependency with 404', async () => {
    mockUser();
    mockWorkspace([{ userId: USER_ID, role: 'Editor' }]);
    mockTaskFindOne({ _id: TASK_ID, workspaceRef: WS_ID, projectRef: PROJ_ID, userId: OTHER_ID });
    vi.spyOn(Task, 'find').mockResolvedValue([]);
    const findOneAndUpdate = vi.spyOn(Task, 'findOneAndUpdate');

    const res = await fetch(`${baseUrl}/api/tasks/${TASK_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify({ dependencies: [DEP_A_ID] }),
    });

    expect(res.status).toBe(404);
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects a self-dependency with 400 (trivial cycle)', async () => {
    mockUser();
    mockWorkspace([{ userId: USER_ID, role: 'Editor' }]);
    mockTaskFindOne({ _id: TASK_ID, workspaceRef: WS_ID, projectRef: PROJ_ID, userId: OTHER_ID });
    vi.spyOn(Task, 'find').mockResolvedValue([{ _id: TASK_ID, workspaceRef: WS_ID, projectRef: PROJ_ID }]);
    const findById = mockTaskFindById();
    const findOneAndUpdate = vi.spyOn(Task, 'findOneAndUpdate');

    const res = await fetch(`${baseUrl}/api/tasks/${TASK_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify({ dependencies: [TASK_ID] }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toBe('This dependency would create a cycle');
    expect(findById).not.toHaveBeenCalled();
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects a two-node cycle (B already depends on A, A now depends on B)', async () => {
    mockUser();
    mockWorkspace([{ userId: USER_ID, role: 'Editor' }]);
    mockTaskFindOne({ _id: TASK_ID, workspaceRef: WS_ID, projectRef: PROJ_ID, userId: OTHER_ID });
    vi.spyOn(Task, 'find').mockResolvedValue([{ _id: DEP_A_ID, workspaceRef: WS_ID, projectRef: PROJ_ID }]);
    // DEP_A depends on TASK_ID → adding TASK_ID → DEP_A closes the loop.
    mockTaskFindById({ [DEP_A_ID]: [TASK_ID] });
    const findOneAndUpdate = vi.spyOn(Task, 'findOneAndUpdate');

    const res = await fetch(`${baseUrl}/api/tasks/${TASK_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify({ dependencies: [DEP_A_ID] }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toBe('This dependency would create a cycle');
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects a three-node cycle (TASK → A → B → TASK)', async () => {
    mockUser();
    mockWorkspace([{ userId: USER_ID, role: 'Editor' }]);
    mockTaskFindOne({ _id: TASK_ID, workspaceRef: WS_ID, projectRef: PROJ_ID, userId: OTHER_ID });
    vi.spyOn(Task, 'find').mockResolvedValue([{ _id: DEP_A_ID, workspaceRef: WS_ID, projectRef: PROJ_ID }]);
    // A depends on B; B depends on TASK → A's transitive deps reach TASK.
    mockTaskFindById({
      [DEP_A_ID]: [DEP_B_ID],
      [DEP_B_ID]: [TASK_ID],
    });
    const findOneAndUpdate = vi.spyOn(Task, 'findOneAndUpdate');

    const res = await fetch(`${baseUrl}/api/tasks/${TASK_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify({ dependencies: [DEP_A_ID] }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toBe('This dependency would create a cycle');
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('clears the dependency list with an empty array', async () => {
    mockUser();
    mockWorkspace([{ userId: USER_ID, role: 'Editor' }]);
    mockTaskFindOne({ _id: TASK_ID, workspaceRef: WS_ID, projectRef: PROJ_ID, userId: OTHER_ID });
    const find = vi.spyOn(Task, 'find');
    const findOneAndUpdate = vi.spyOn(Task, 'findOneAndUpdate').mockResolvedValue({ _id: TASK_ID, dependencies: [] });

    const res = await fetch(`${baseUrl}/api/tasks/${TASK_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify({ dependencies: [] }),
    });

    expect(res.status).toBe(200);
    const [, update] = findOneAndUpdate.mock.calls[0];
    expect(update).toEqual({ $set: { dependencies: [] } });
    expect(find).not.toHaveBeenCalled();
  });

  it('lets a personal task owner depend on their own task', async () => {
    mockUser();
    mockTaskFindOne({ _id: TASK_ID, userId: USER_ID });
    vi.spyOn(Task, 'find').mockResolvedValue([{ _id: DEP_A_ID, userId: USER_ID }]);
    mockTaskFindById();
    const findOneAndUpdate = vi.spyOn(Task, 'findOneAndUpdate')
      .mockResolvedValue({ _id: TASK_ID, dependencies: [DEP_A_ID] });

    const res = await fetch(`${baseUrl}/api/tasks/${TASK_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify({ dependencies: [DEP_A_ID] }),
    });

    expect(res.status).toBe(200);
    const [, update] = findOneAndUpdate.mock.calls[0];
    expect(update).toEqual({ $set: { dependencies: [DEP_A_ID] } });
  });

  it('rejects a personal task depending on another user task with 400', async () => {
    mockUser();
    mockTaskFindOne({ _id: TASK_ID, userId: USER_ID });
    vi.spyOn(Task, 'find').mockResolvedValue([{ _id: DEP_A_ID, userId: OTHER_ID }]);
    const findOneAndUpdate = vi.spyOn(Task, 'findOneAndUpdate');

    const res = await fetch(`${baseUrl}/api/tasks/${TASK_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify({ dependencies: [DEP_A_ID] }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toBe('You can only depend on your own tasks');
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('blocks a Viewer from setting dependencies with 403 before any dep lookup', async () => {
    mockUser();
    mockWorkspace([{ userId: USER_ID, role: 'Viewer' }]);
    mockTaskFindOne({ _id: TASK_ID, workspaceRef: WS_ID, projectRef: PROJ_ID, userId: OTHER_ID });
    const find = vi.spyOn(Task, 'find');
    const findOneAndUpdate = vi.spyOn(Task, 'findOneAndUpdate');

    const res = await fetch(`${baseUrl}/api/tasks/${TASK_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify({ dependencies: [DEP_A_ID] }),
    });

    expect(res.status).toBe(403);
    expect(find).not.toHaveBeenCalled();
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('EEP2-P5.2.1 · workspace create dependencies — same-scope only', () => {
  it('accepts a same-scope dependency on workspace create', async () => {
    mockUser();
    mockWorkspace([{ userId: USER_ID, role: 'Owner' }]);
    vi.spyOn(Task, 'find').mockResolvedValue([{ _id: DEP_A_ID, workspaceRef: WS_ID }]);
    const create = vi.spyOn(Task, 'create').mockResolvedValue({ _id: TASK_ID });
    vi.spyOn(Activity, 'create').mockResolvedValue(undefined);

    const res = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify(workspaceTaskBody({ dependencies: [DEP_A_ID] })),
    });

    expect(res.status).toBe(201);
    expect(create.mock.calls[0][0]).toMatchObject({ dependencies: [DEP_A_ID] });
  });

  it('rejects a cross-project dependency on workspace create with 400', async () => {
    mockUser();
    mockWorkspace([{ userId: USER_ID, role: 'Owner' }]);
    vi.spyOn(Task, 'find').mockResolvedValue([{ _id: DEP_A_ID, workspaceRef: WS_ID, projectRef: OTHER_PROJ_ID }]);
    const create = vi.spyOn(Task, 'create');

    const res = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify(workspaceTaskBody({ dependencies: [DEP_A_ID] })),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toBe('Dependencies must be tasks of the same project');
    expect(create).not.toHaveBeenCalled();
  });

  it('leaves the personal create path unaffected', async () => {
    mockUser();
    const find = vi.spyOn(Task, 'find');
    const create = vi.spyOn(Task, 'create').mockResolvedValue({ _id: TASK_ID });
    vi.spyOn(Activity, 'create').mockResolvedValue(undefined);

    const res = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify(personalTaskBody()),
    });

    expect(res.status).toBe(201);
    expect(find).not.toHaveBeenCalled();
    expect(create.mock.calls[0][0].dependencies).toBeUndefined();
  });
});
