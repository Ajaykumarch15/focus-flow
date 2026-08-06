// @vitest-environment node
// EEP2-P5.1.1 · Task model (dependencyRefs/estimateHours vocabulary, DDS §4.9)
// EEP2-P5.1.2 · Task API scope rules, assignee membership, batch reorder
// EEP2-P5.1.3 · Subtask CRUD + toggle with the same scope gate.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const Task = require('../models/Task');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const Session = require('../models/Session');
const Journal = require('../models/Journal');
const WorkLog = require('../models/WorkLog');
const Activity = require('../models/Activity');
const taskRouter = require('../routes/tasks');

const SECRET = 'p5-1-task-core-test-secret-at-least-32';
const USER_ID = '5f0000000000000000000a01'; // caller (workspace editor / personal owner)
const OTHER_ID = '5f0000000000000000000a02'; // task creator (not the caller)
const MEMBER_ID = '5f0000000000000000000a03'; // workspace member assignee
const OUTSIDER_ID = '5f0000000000000000000a04'; // not a member
const WS_ID = '5f0000000000000000000c10';
const TASK_ID = '5f0000000000000000000c13';
const SUB_ID = '5f0000000000000000000c14';
const A_ID = '5f0000000000000000000c15';
const B_ID = '5f0000000000000000000c16';
const DEP_ID = '5f0000000000000000000c17';

const signToken = (id) => jwt.sign({ id, tv: 0 }, SECRET, { expiresIn: '30d' });
const cookie = (id) => `ff_session=${signToken(id)}`;

let server;
let baseUrl;

function mockUser() {
  return vi.spyOn(User, 'findById').mockImplementation(() => ({
    select: () => Promise.resolve({ _id: USER_ID, name: 'Task Core', email: 'tc@focusflow.io', role: 'user', tokenVersion: 0, deletedAt: null }),
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

describe('EEP2-P5.1.1 · Task model — dependencyRefs/estimateHours (DDS §4.9)', () => {
  it('defines dependencies, estimatedHours and order on the Task schema', () => {
    expect(Task.schema.path('dependencies')).toBeDefined();
    expect(Task.schema.path('estimatedHours')).toBeDefined();
    expect(Task.schema.path('actualHours')).toBeDefined();
    expect(Task.schema.path('order')).toBeDefined();
  });

  it('persists dependencies and estimatedHours on a workspace task create', async () => {
    mockUser();
    mockWorkspace();
    const create = vi.spyOn(Task, 'create').mockResolvedValue({ _id: TASK_ID });
    vi.spyOn(Activity, 'create').mockResolvedValue(undefined);
    // EEP2-P5.2.1: the create path validates dependencies are same-scope tasks.
    vi.spyOn(Task, 'find').mockResolvedValue([{ _id: DEP_ID, workspaceRef: WS_ID }]);

    const res = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify(workspaceTaskBody({
        dependencies: [DEP_ID],
        estimatedHours: 6,
        actualHours: 0,
      })),
    });

    expect(res.status).toBe(201);
    expect(create.mock.calls[0][0]).toMatchObject({
      workspaceRef: WS_ID,
      dependencies: [DEP_ID],
      estimatedHours: 6,
      actualHours: 0,
    });
  });
});

describe('EEP2-P5.1.2 · scope rules (DDS §4.9) — editor vs personal owner', () => {
  it('lets a non-creator workspace editor update a task', async () => {
    mockUser();
    mockWorkspace([{ userId: USER_ID, role: 'Editor' }]);
    mockTaskFindOne({ _id: TASK_ID, workspaceRef: WS_ID, userId: OTHER_ID });
    const findOneAndUpdate = vi.spyOn(Task, 'findOneAndUpdate')
      .mockResolvedValue({ _id: TASK_ID, workspaceRef: WS_ID, sprintStatus: 'done' });

    const res = await fetch(`${baseUrl}/api/tasks/${TASK_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify({ sprintStatus: 'done' }),
    });

    expect(res.status).toBe(200);
    const [filter] = findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ _id: TASK_ID });
    expect(filter.userId).toBeUndefined();
  });

  it('blocks a Viewer from updating a workspace task with 403', async () => {
    mockUser();
    mockWorkspace([{ userId: USER_ID, role: 'Viewer' }]);
    mockTaskFindOne({ _id: TASK_ID, workspaceRef: WS_ID, userId: OTHER_ID });
    const findOneAndUpdate = vi.spyOn(Task, 'findOneAndUpdate');

    const res = await fetch(`${baseUrl}/api/tasks/${TASK_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify({ sprintStatus: 'done' }),
    });

    expect(res.status).toBe(403);
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('404s a personal task owned by another user', async () => {
    mockUser();
    mockTaskFindOne({ _id: TASK_ID, userId: OTHER_ID });
    const findOneAndUpdate = vi.spyOn(Task, 'findOneAndUpdate');

    const res = await fetch(`${baseUrl}/api/tasks/${TASK_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify({ status: 'completed' }),
    });

    expect(res.status).toBe(404);
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('lets the owner update a personal task', async () => {
    mockUser();
    mockTaskFindOne({ _id: TASK_ID, userId: USER_ID });
    const findOneAndUpdate = vi.spyOn(Task, 'findOneAndUpdate')
      .mockResolvedValue({ _id: TASK_ID, status: 'active' });

    const res = await fetch(`${baseUrl}/api/tasks/${TASK_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify({ status: 'active' }),
    });

    expect(res.status).toBe(200);
    expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
  });

  it('lets a non-creator workspace editor delete a task', async () => {
    mockUser();
    mockWorkspace([{ userId: USER_ID, role: 'Editor' }]);
    mockTaskFindOne({ _id: TASK_ID, workspaceRef: WS_ID, userId: OTHER_ID, title: 'T' });
    const findOneAndDelete = vi.spyOn(Task, 'findOneAndDelete').mockResolvedValue({ _id: TASK_ID, title: 'T' });
    vi.spyOn(Session, 'deleteMany').mockResolvedValue({ deletedCount: 0 });
    vi.spyOn(Journal, 'deleteMany').mockResolvedValue({ deletedCount: 0 });
    vi.spyOn(WorkLog, 'find').mockResolvedValue([]);
    vi.spyOn(Activity, 'create').mockResolvedValue(undefined);

    const res = await fetch(`${baseUrl}/api/tasks/${TASK_ID}`, {
      method: 'DELETE',
      headers: { Cookie: cookie(USER_ID) },
    });

    expect(res.status).toBe(200);
    expect(findOneAndDelete).toHaveBeenCalledWith({ _id: TASK_ID });
  });
});

describe('EEP2-P5.1.2 · assignee/reviewer membership (DDS §4.9)', () => {
  it('rejects assigning a non-member on workspace create with 400', async () => {
    mockUser();
    mockWorkspace([{ userId: USER_ID, role: 'Owner' }]);
    const create = vi.spyOn(Task, 'create');

    const res = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify(workspaceTaskBody({ assigneeId: OUTSIDER_ID })),
    });

    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('accepts a member assignee on workspace create', async () => {
    mockUser();
    mockWorkspace([{ userId: USER_ID, role: 'Owner' }, { userId: MEMBER_ID, role: 'Developer' }]);
    const create = vi.spyOn(Task, 'create').mockResolvedValue({ _id: TASK_ID });
    vi.spyOn(Activity, 'create').mockResolvedValue(undefined);

    const res = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify(workspaceTaskBody({ assigneeId: MEMBER_ID })),
    });

    expect(res.status).toBe(201);
    expect(create.mock.calls[0][0]).toMatchObject({ assigneeId: MEMBER_ID });
  });

  it('rejects patching a workspace task assignee to a non-member with 400', async () => {
    mockUser();
    mockWorkspace([{ userId: USER_ID, role: 'Editor' }]);
    mockTaskFindOne({ _id: TASK_ID, workspaceRef: WS_ID, userId: OTHER_ID });
    const findOneAndUpdate = vi.spyOn(Task, 'findOneAndUpdate');

    const res = await fetch(`${baseUrl}/api/tasks/${TASK_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify({ assigneeId: OUTSIDER_ID }),
    });

    expect(res.status).toBe(400);
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects patching a workspace task reviewer to a non-member with 400', async () => {
    mockUser();
    mockWorkspace([{ userId: USER_ID, role: 'Editor' }]);
    mockTaskFindOne({ _id: TASK_ID, workspaceRef: WS_ID, userId: OTHER_ID });
    const findOneAndUpdate = vi.spyOn(Task, 'findOneAndUpdate');

    const res = await fetch(`${baseUrl}/api/tasks/${TASK_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify({ reviewerId: OUTSIDER_ID }),
    });

    expect(res.status).toBe(400);
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('EEP2-P5.1.2 · POST /api/tasks/reorder', () => {
  it('reorders a workspace batch as an editor, assigning order by index', async () => {
    mockUser();
    mockWorkspace([{ userId: USER_ID, role: 'Editor' }]);
    const tasks = [
      { _id: A_ID, workspaceRef: WS_ID, userId: OTHER_ID },
      { _id: B_ID, workspaceRef: WS_ID, userId: OTHER_ID },
    ];
    vi.spyOn(Task, 'find')
      .mockResolvedValueOnce(tasks)
      .mockReturnValueOnce({ sort: () => Promise.resolve([tasks[1], tasks[0]]) });
    const bulkWrite = vi.spyOn(Task, 'bulkWrite').mockResolvedValue({});

    const res = await fetch(`${baseUrl}/api/tasks/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify({ ids: [B_ID, A_ID] }),
    });

    expect(res.status).toBe(200);
    expect(bulkWrite).toHaveBeenCalledWith([
      { updateOne: { filter: { _id: B_ID }, update: { $set: { order: 0 } } } },
      { updateOne: { filter: { _id: A_ID }, update: { $set: { order: 1 } } } },
    ]);
  });

  it('rejects a workspace batch by a Viewer with 403', async () => {
    mockUser();
    mockWorkspace([{ userId: USER_ID, role: 'Viewer' }]);
    vi.spyOn(Task, 'find').mockResolvedValueOnce([
      { _id: A_ID, workspaceRef: WS_ID, userId: OTHER_ID },
      { _id: B_ID, workspaceRef: WS_ID, userId: OTHER_ID },
    ]);
    const bulkWrite = vi.spyOn(Task, 'bulkWrite');

    const res = await fetch(`${baseUrl}/api/tasks/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify({ ids: [A_ID, B_ID] }),
    });

    expect(res.status).toBe(403);
    expect(bulkWrite).not.toHaveBeenCalled();
  });

  it('rejects a mixed personal + workspace batch with 400', async () => {
    mockUser();
    vi.spyOn(Task, 'find').mockResolvedValueOnce([
      { _id: A_ID, workspaceRef: WS_ID, userId: USER_ID },
      { _id: B_ID, userId: USER_ID },
    ]);
    const bulkWrite = vi.spyOn(Task, 'bulkWrite');

    const res = await fetch(`${baseUrl}/api/tasks/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify({ ids: [A_ID, B_ID] }),
    });

    expect(res.status).toBe(400);
    expect(bulkWrite).not.toHaveBeenCalled();
  });

  it('rejects a personal batch containing another user task with 403', async () => {
    mockUser();
    vi.spyOn(Task, 'find').mockResolvedValueOnce([
      { _id: A_ID, userId: OTHER_ID },
      { _id: B_ID, userId: USER_ID },
    ]);
    const bulkWrite = vi.spyOn(Task, 'bulkWrite');

    const res = await fetch(`${baseUrl}/api/tasks/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify({ ids: [A_ID, B_ID] }),
    });

    expect(res.status).toBe(403);
    expect(bulkWrite).not.toHaveBeenCalled();
  });

  it('rejects an unknown id with 404', async () => {
    mockUser();
    vi.spyOn(Task, 'find').mockResolvedValueOnce([{ _id: A_ID, userId: USER_ID }]);
    const bulkWrite = vi.spyOn(Task, 'bulkWrite');

    const res = await fetch(`${baseUrl}/api/tasks/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify({ ids: [A_ID, B_ID] }),
    });

    expect(res.status).toBe(404);
    expect(bulkWrite).not.toHaveBeenCalled();
  });

  it('reorders a personal batch owned by the caller', async () => {
    mockUser();
    vi.spyOn(Task, 'find')
      .mockResolvedValueOnce([
        { _id: A_ID, userId: USER_ID },
        { _id: B_ID, userId: USER_ID },
      ])
      .mockReturnValueOnce({ sort: () => Promise.resolve([{ _id: A_ID }, { _id: B_ID }]) });
    const bulkWrite = vi.spyOn(Task, 'bulkWrite').mockResolvedValue({});

    const res = await fetch(`${baseUrl}/api/tasks/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify({ ids: [A_ID, B_ID] }),
    });

    expect(res.status).toBe(200);
    expect(bulkWrite).toHaveBeenCalled();
  });
});

describe('EEP2-P5.1.3 · subtask CRUD + toggle', () => {
  it('lets a non-creator workspace editor add a subtask', async () => {
    mockUser();
    mockWorkspace([{ userId: USER_ID, role: 'Editor' }]);
    mockTaskFindOne({ _id: TASK_ID, workspaceRef: WS_ID, userId: OTHER_ID });
    const findOneAndUpdate = vi.spyOn(Task, 'findOneAndUpdate')
      .mockResolvedValue({ _id: TASK_ID, subtasks: [{ _id: SUB_ID, title: 'Write tests', completed: false }] });

    const res = await fetch(`${baseUrl}/api/tasks/${TASK_ID}/subtasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify({ title: 'Write tests' }),
    });

    expect(res.status).toBe(200);
    const [filter, update] = findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ _id: TASK_ID });
    expect(filter.userId).toBeUndefined();
    expect(update).toEqual({ $push: { subtasks: { title: 'Write tests' } } });
  });

  it('toggles a subtask via $set on subtasks.$.completed', async () => {
    mockUser();
    mockWorkspace([{ userId: USER_ID, role: 'Editor' }]);
    mockTaskFindOne({ _id: TASK_ID, workspaceRef: WS_ID, userId: OTHER_ID });
    const findOneAndUpdate = vi.spyOn(Task, 'findOneAndUpdate')
      .mockResolvedValue({ _id: TASK_ID, subtasks: [{ _id: SUB_ID, title: 'Write tests', completed: true }] });

    const res = await fetch(`${baseUrl}/api/tasks/${TASK_ID}/subtasks/${SUB_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify({ completed: true }),
    });

    expect(res.status).toBe(200);
    const [filter, update] = findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ _id: TASK_ID, 'subtasks._id': SUB_ID });
    expect(update).toEqual({ $set: { 'subtasks.$.completed': true } });
  });

  it('deletes a subtask via $pull', async () => {
    mockUser();
    mockWorkspace([{ userId: USER_ID, role: 'Editor' }]);
    mockTaskFindOne({ _id: TASK_ID, workspaceRef: WS_ID, userId: OTHER_ID });
    const findOneAndUpdate = vi.spyOn(Task, 'findOneAndUpdate')
      .mockResolvedValue({ _id: TASK_ID, subtasks: [] });

    const res = await fetch(`${baseUrl}/api/tasks/${TASK_ID}/subtasks/${SUB_ID}`, {
      method: 'DELETE',
      headers: { Cookie: cookie(USER_ID) },
    });

    expect(res.status).toBe(200);
    const [filter, update] = findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ _id: TASK_ID });
    expect(update).toEqual({ $pull: { subtasks: { _id: SUB_ID } } });
  });

  it('blocks a Viewer from subtask CRUD with 403', async () => {
    mockUser();
    mockWorkspace([{ userId: USER_ID, role: 'Viewer' }]);
    mockTaskFindOne({ _id: TASK_ID, workspaceRef: WS_ID, userId: OTHER_ID });
    const findOneAndUpdate = vi.spyOn(Task, 'findOneAndUpdate');

    const res = await fetch(`${baseUrl}/api/tasks/${TASK_ID}/subtasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify({ title: 'Nope' }),
    });

    expect(res.status).toBe(403);
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects an empty subtask title before any DB access', async () => {
    mockUser();
    const findOne = vi.spyOn(Task, 'findOne');
    const findOneAndUpdate = vi.spyOn(Task, 'findOneAndUpdate');

    const res = await fetch(`${baseUrl}/api/tasks/${TASK_ID}/subtasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify({ title: '' }),
    });

    expect(res.status).toBe(400);
    expect(findOne).not.toHaveBeenCalled();
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });
});

// The personal create path (no collab scope) must stay untouched — regression guard.
describe('EEP2-P5.1.2 · personal create path unaffected', () => {
  it('creates a personal task without workspace refs', async () => {
    mockUser();
    const create = vi.spyOn(Task, 'create').mockResolvedValue({ _id: TASK_ID });
    vi.spyOn(Activity, 'create').mockResolvedValue(undefined);

    const res = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie(USER_ID) },
      body: JSON.stringify(personalTaskBody()),
    });

    expect(res.status).toBe(201);
    const data = create.mock.calls[0][0];
    expect(data).toMatchObject({ userId: USER_ID, title: 'Personal task' });
    expect(data.workspaceRef).toBeUndefined();
    expect(data.projectRef).toBeUndefined();
    expect(data.sprintRef).toBeUndefined();
  });
});
