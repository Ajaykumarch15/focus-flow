// @vitest-environment node
// IES-P1-24 · Drive failures reach the client and set the driveSyncError flag —
// the folder-creation and doc-sync code paths can no longer degrade silently.
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import http from 'node:http';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
const User = require('../models/User');
const Project = require('../models/Project');
const WorkLog = require('../models/WorkLog');
const projectsRouter = require('../routes/projects');
const workLogsRouter = require('../routes/workLogs');

// IES-P0-10: googleapis is a ~4s cold load under node. Pre-warm the CJS cache
// during import (not counted against the 5s test timeout) so the route files'
// later requires are instant cache hits.
require('../utils/googleDrive');

const SECRET = 'p1-24-test-drive-surfacing-32char';
const USER_ID = '5f0000000000000000000d4';
const PROJECT_ID = '5f0000000000000000000d50';
const WORKLOG_ID = '5f0000000000000000000d51';
const OAuth2Proto = google.auth.OAuth2.prototype;

const signToken = () => jwt.sign({ id: USER_ID, tv: 0 }, SECRET, { expiresIn: '30d' });

let server;
let baseUrl;

function connectedUser() {
  return {
    _id: USER_ID,
    name: 'Drive User',
    email: 'drive@example.com',
    role: 'user',
    tokenVersion: 0,
    deletedAt: null,
    googleConnected: true,
    googleTokens: {
      accessToken: 'old-at',
      refreshToken: 'old-rt',
      expiryDate: Date.now() - 60000, // expired → forces the refresh path
    },
    markModified: vi.fn(),
    save: vi.fn().mockResolvedValue(undefined),
  };
}

function mockFindById(user) {
  return vi.spyOn(User, 'findById').mockImplementation(() => ({
    select: () => Promise.resolve(user),
  }));
}

beforeAll(async () => {
  process.env.JWT_SECRET = SECRET;
  process.env.CLIENT_URL = 'http://localhost:5173';
  delete process.env.NODE_ENV;

  const app = express();
  app.use(express.json());
  app.use('/api/projects', projectsRouter);
  app.use('/api/worklogs', workLogsRouter);
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

describe('IES-P1-24 · Drive failures surface driveSyncError', () => {
  it('project folder creation failure sets the flag and still creates the project', async () => {
    mockFindById(connectedUser());
    vi.spyOn(OAuth2Proto, 'refreshAccessToken').mockRejectedValue(new Error('invalid_grant'));
    vi.spyOn(Project, 'findOne').mockResolvedValue(null);
    vi.spyOn(Project, 'create').mockResolvedValue({ _id: 'p1', name: 'Drive Project' });
    const updateOne = vi.spyOn(User, 'updateOne').mockResolvedValue(undefined);

    const res = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signToken()}` },
      body: JSON.stringify({ name: 'Drive Project' }),
    });

    expect(res.status).toBe(201);
    expect(updateOne).toHaveBeenCalledWith(
      { _id: USER_ID },
      { $set: { driveSyncError: 'Drive folder creation failed. Please reconnect in settings.' } }
    );
  });

  it('sync-drive failure sets the flag and errors out', async () => {
    mockFindById(connectedUser());
    vi.spyOn(OAuth2Proto, 'refreshAccessToken').mockRejectedValue(new Error('invalid_grant'));
    vi.spyOn(Project, 'findOne').mockResolvedValue({ _id: PROJECT_ID, name: 'P', userId: USER_ID });
    const updateOne = vi.spyOn(User, 'updateOne').mockResolvedValue(undefined);

    const res = await fetch(`${baseUrl}/api/projects/${PROJECT_ID}/sync-drive`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${signToken()}` },
    });

    expect(res.status).toBe(500);
    expect(updateOne).toHaveBeenCalledWith(
      { _id: USER_ID },
      { $set: { driveSyncError: 'Drive sync failed. Please reconnect in settings.' } }
    );
  });

  it('worklog doc sync failure sets the flag while the local patch still succeeds', async () => {
    mockFindById(connectedUser());
    vi.spyOn(OAuth2Proto, 'refreshAccessToken').mockRejectedValue(new Error('invalid_grant'));
    const log = { _id: WORKLOG_ID, googleDocId: 'doc-1', title: 'T' };
    vi.spyOn(WorkLog, 'findOneAndUpdate').mockImplementation(() => ({
      populate: () => ({ populate: () => Promise.resolve(log) }),
    }));
    const updateOne = vi.spyOn(User, 'updateOne').mockResolvedValue(undefined);

    const res = await fetch(`${baseUrl}/api/worklogs/${WORKLOG_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signToken()}` },
      body: JSON.stringify({ currentWork: 'Updated' }),
    });

    expect(res.status).toBe(200);
    // triggerGoogleDocSync is fire-and-forget — flush its async failure path.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(updateOne).toHaveBeenCalledWith(
      { _id: USER_ID },
      { $set: { driveSyncError: 'Google Docs sync failed. Please reconnect in settings.' } }
    );
  });
});
