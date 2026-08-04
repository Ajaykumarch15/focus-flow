// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import http from 'node:http';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
const User = require('../models/User');
const Activity = require('../models/Activity');
const authRouter = require('../routes/auth');
const googleDrive = require('../utils/googleDrive');

const SECRET = 'p0-10-test-secret-at-least-32-chars-long';
const CLIENT_URL = 'http://localhost:5173';
const USER_ID = '5f0000000000000000000c1';

const sha256hex = (value) => crypto.createHash('sha256').update(value).digest('hex');
const pkceChallenge = (verifier) =>
  crypto.createHash('sha256').update(verifier).digest('base64url');

const OAuth2Proto = google.auth.OAuth2.prototype;

let lastAuthUrlOpts;
let server;
let baseUrl;

function buildUser(overrides = {}) {
  return {
    _id: USER_ID,
    name: 'OAuth User',
    email: 'oauth@example.com',
    role: 'user',
    tokenVersion: 0,
    deletedAt: null,
    googleConnected: false,
    googleTokens: undefined,
    googleOAuth: undefined,
    markModified: vi.fn(),
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function signToken() {
  return jwt.sign({ id: USER_ID, tv: 0 }, SECRET, { expiresIn: '1h' });
}

beforeAll(async () => {
  process.env.JWT_SECRET = SECRET;
  process.env.CLIENT_URL = CLIENT_URL;
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
  process.env.GOOGLE_REDIRECT_URI = 'http://localhost:5001/auth/google/callback';
});

beforeEach(() => {
  lastAuthUrlOpts = undefined;
  vi.spyOn(OAuth2Proto, 'generateAuthUrl').mockImplementation((opts) => {
    lastAuthUrlOpts = opts;
    return 'https://accounts.google.com/o/oauth2/auth?client_id=x&response_type=code';
  });
  vi.spyOn(OAuth2Proto, 'getToken').mockResolvedValue({
    tokens: {
      access_token: 'access-token-1',
      refresh_token: 'refresh-token-1',
      expiry_date: 123456789,
    },
  });
  vi.spyOn(OAuth2Proto, 'refreshAccessToken').mockResolvedValue({
    credentials: {
      access_token: 'access-token-2',
      refresh_token: 'refresh-token-2',
      expiry_date: 999999999999,
    },
  });
  vi.spyOn(Activity, 'create').mockImplementation(() => Promise.resolve());
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

describe('IES-P0-10 · /api/auth/google/url issues no token in the URL', () => {
  it('stores a hashed single-use nonce + PKCE verifier and never echoes the JWT', async () => {
    const mockUser = buildUser();
    vi.spyOn(User, 'findById').mockImplementation(() => ({
      select: () => Promise.resolve(mockUser),
    }));

    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const url = `http://127.0.0.1:${server.address().port}`;

    const bearer = signToken();
    const res = await fetch(`${url}/api/auth/google/url`, {
      headers: { Authorization: `Bearer ${bearer}` },
    });
    expect(res.status).toBe(200);

    const { url: authUrl } = await res.json();
    expect(lastAuthUrlOpts).toBeDefined();

    // state is an opaque nonce, NOT the bearer JWT.
    const state = lastAuthUrlOpts.state;
    expect(state).not.toContain(bearer);
    expect(state).toMatch(/^[0-9a-f]{64}$/);

    // PKCE challenge present and derived from the stored verifier.
    expect(lastAuthUrlOpts.code_challenge_method).toBe('S256');
    expect(mockUser.googleOAuth.codeVerifier).toBeDefined();
    expect(lastAuthUrlOpts.code_challenge).toBe(pkceChallenge(mockUser.googleOAuth.codeVerifier));

    // Nonce stored hashed with an expiry; never the raw nonce.
    expect(mockUser.googleOAuth.stateHash).toBe(sha256hex(state));
    expect(mockUser.googleOAuth.stateHash).not.toBe(state);
    expect(new Date(mockUser.googleOAuth.stateExpiry).getTime()).toBeGreaterThan(Date.now());
    expect(mockUser.save).toHaveBeenCalled();

    // The URL handed to the client contains no token material.
    expect(authUrl).not.toContain(bearer);
    expect(authUrl).not.toContain('access_token');
  });
});

describe('IES-P0-10 · callback redeems with PKCE and consumes the nonce', () => {
  it('exchanges the code with the stored code_verifier and stores tokens', async () => {
    const state = 'a'.repeat(64);
    const codeVerifier = 'b'.repeat(64);
    const mockUser = buildUser({
      googleOAuth: {
        stateHash: sha256hex(state),
        stateExpiry: new Date(Date.now() + 60_000),
        codeVerifier,
      },
    });
    vi.spyOn(User, 'findOne').mockResolvedValue(mockUser);

    const res = { redirect: vi.fn() };
    await authRouter.handleGoogleCallback(
      { query: { code: 'auth-code-1', state } },
      res
    );

    expect(OAuth2Proto.getToken).toHaveBeenCalledWith('auth-code-1', { code_verifier: codeVerifier });
    expect(mockUser.googleConnected).toBe(true);
    expect(mockUser.googleTokens).toEqual({
      accessToken: 'access-token-1',
      refreshToken: 'refresh-token-1',
      expiryDate: 123456789,
    });
    expect(mockUser.googleOAuth).toBeUndefined();
    expect(res.redirect).toHaveBeenCalledWith(`${CLIENT_URL}/settings?google_connected=true`);
  });

  it('rejects a replay: once consumed, the same state no longer resolves a user', async () => {
    const state = 'c'.repeat(64);
    const mockUser = buildUser({
      googleOAuth: {
        stateHash: sha256hex(state),
        stateExpiry: new Date(Date.now() + 60_000),
        codeVerifier: 'd'.repeat(64),
      },
    });
    const findOne = vi
      .spyOn(User, 'findOne')
      .mockResolvedValueOnce(mockUser)
      .mockResolvedValueOnce(null);

    const res = { redirect: vi.fn() };
    await authRouter.handleGoogleCallback({ query: { code: 'code-1', state } }, res);
    expect(res.redirect).toHaveBeenLastCalledWith(`${CLIENT_URL}/settings?google_connected=true`);

    res.redirect.mockClear();
    await authRouter.handleGoogleCallback({ query: { code: 'code-1', state } }, res);
    expect(res.redirect).toHaveBeenCalledWith(`${CLIENT_URL}/settings?error=user_not_found`);
    expect(findOne).toHaveBeenCalledTimes(2);
  });

  it('rejects an expired nonce before exchanging any code', async () => {
    const state = 'e'.repeat(64);
    const mockUser = buildUser({
      googleOAuth: {
        stateHash: sha256hex(state),
        stateExpiry: new Date(Date.now() - 60_000),
        codeVerifier: 'f'.repeat(64),
      },
    });
    vi.spyOn(User, 'findOne').mockResolvedValue(mockUser);

    const res = { redirect: vi.fn() };
    await authRouter.handleGoogleCallback({ query: { code: 'code-1', state } }, res);

    expect(res.redirect).toHaveBeenCalledWith(`${CLIENT_URL}/settings?error=state_expired`);
    expect(OAuth2Proto.getToken).not.toHaveBeenCalled();
  });
});

describe('IES-P0-10 · refresh tokens rotate on each refresh', () => {
  it('persists the newly-issued refresh_token from Google', async () => {
    const mockUser = buildUser({
      googleTokens: {
        accessToken: 'old-access',
        refreshToken: 'old-refresh',
        expiryDate: Date.now() - 120_000, // expired → forces refresh
      },
    });

    const client = await googleDrive.getAuthorizedClient(mockUser);

    expect(client).toBeDefined();
    expect(mockUser.googleTokens.accessToken).toBe('access-token-2');
    expect(mockUser.googleTokens.refreshToken).toBe('refresh-token-2');
    expect(mockUser.googleTokens.expiryDate).toBe(999999999999);
    expect(mockUser.markModified).toHaveBeenCalledWith('googleTokens');
    expect(mockUser.save).toHaveBeenCalled();
  });
});

describe('IES-P0-10 · googleOAuth never serializes to the client', () => {
  it('strips the in-flight OAuth state from toJSON', async () => {
    const user = new User({
      name: 'Serialization',
      email: 'serial@example.com',
      passwordHash: 'hash',
      googleConnected: true,
      googleTokens: { accessToken: 'at', refreshToken: 'rt', expiryDate: 1 },
      googleOAuth: { stateHash: 'hash', stateExpiry: new Date(), codeVerifier: 'verifier' },
    });
    const json = user.toJSON();
    expect(json.passwordHash).toBeUndefined();
    expect(json.googleTokens).toBeUndefined();
    expect(json.googleOAuth).toBeUndefined();
  });
});
