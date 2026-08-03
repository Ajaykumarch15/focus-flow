// @vitest-environment node
// IES-P1-24 · single-flight Google token refresh. A burst of concurrent Drive
// operations must hit Google's refresh endpoint once per user, persist the
// rotated tokens exactly once, clear the driveSyncError flag on success, and
// disconnect + surface the failure when the refresh itself fails.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { google } = require('googleapis');
const User = require('../models/User');
const googleDrive = require('../utils/googleDrive');

const OAuth2Proto = google.auth.OAuth2.prototype;
const USER_ID = '5f0000000000000000000e1';

const FRESH_CREDS = {
  credentials: {
    access_token: 'rotated-access-token',
    refresh_token: 'rotated-refresh-token',
    expiry_date: 9999999999999,
  },
};

function buildUser(overrides = {}) {
  return {
    _id: USER_ID,
    googleConnected: true,
    googleTokens: {
      accessToken: 'old-access-token',
      refreshToken: 'old-refresh-token',
      expiryDate: Date.now() - 60000, // expired → forces the refresh path
    },
    driveSyncError: '',
    markModified: vi.fn(),
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

beforeEach(() => {
  vi.spyOn(OAuth2Proto, 'refreshAccessToken').mockResolvedValue(FRESH_CREDS);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('IES-P1-24 · single-flight refresh', () => {
  it('deduplicates concurrent refreshes for the same user', async () => {
    const refreshSpy = vi.spyOn(OAuth2Proto, 'refreshAccessToken').mockResolvedValue(FRESH_CREDS);
    const callerA = buildUser();
    const callerB = buildUser();

    const [clientA, clientB] = await Promise.all([
      googleDrive.getAuthorizedClient(callerA),
      googleDrive.getAuthorizedClient(callerB),
    ]);

    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(clientA.credentials.access_token).toBe('rotated-access-token');
    expect(clientB.credentials.access_token).toBe('rotated-access-token');

    // Rotation + persistence happened exactly once, on the initiating doc.
    expect(callerA.googleTokens.refreshToken).toBe('rotated-refresh-token');
    expect(callerA.save).toHaveBeenCalledTimes(1);
  });

  it('does not refresh again for a follow-up call once the token is fresh', async () => {
    const refreshSpy = vi.spyOn(OAuth2Proto, 'refreshAccessToken').mockResolvedValue(FRESH_CREDS);
    const user = buildUser();

    const first = await googleDrive.getAuthorizedClient(user);
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(first.credentials.access_token).toBe('rotated-access-token');

    const second = await googleDrive.getAuthorizedClient(user);
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(second.credentials.access_token).toBe('rotated-access-token');
  });

  it('skips refresh entirely when the token is still valid', async () => {
    const refreshSpy = vi.spyOn(OAuth2Proto, 'refreshAccessToken').mockResolvedValue(FRESH_CREDS);
    const user = buildUser({
      googleTokens: {
        accessToken: 'fresh-access-token',
        refreshToken: 'fresh-refresh-token',
        expiryDate: Date.now() + 3600 * 1000,
      },
    });

    const client = await googleDrive.getAuthorizedClient(user);
    expect(refreshSpy).not.toHaveBeenCalled();
    expect(client.credentials.access_token).toBe('fresh-access-token');
  });

  it('throws without touching Google when the account is not connected', async () => {
    const refreshSpy = vi.spyOn(OAuth2Proto, 'refreshAccessToken');
    await expect(googleDrive.getAuthorizedClient(buildUser({ googleTokens: undefined })))
      .rejects.toThrow('Google Drive account is not connected');
    expect(refreshSpy).not.toHaveBeenCalled();
  });
});

describe('IES-P1-24 · refresh failure disconnects + surfaces the flag', () => {
  it('disconnects, flags the user, and rethrows', async () => {
    vi.spyOn(OAuth2Proto, 'refreshAccessToken').mockRejectedValue(new Error('invalid_grant'));
    const user = buildUser();

    await expect(googleDrive.getAuthorizedClient(user)).rejects.toThrow(
      'Google connection has expired. Please reconnect in settings.'
    );

    expect(user.googleConnected).toBe(false);
    expect(user.googleTokens).toBeUndefined();
    expect(user.driveSyncError).toBe('Google connection has expired. Please reconnect in settings.');
    expect(user.save).toHaveBeenCalledTimes(1);
  });
});

describe('IES-P1-24 · successful refresh clears a prior drive-sync failure', () => {
  it('resets driveSyncError on the user doc', async () => {
    const user = buildUser({ driveSyncError: 'Drive sync failed. Please reconnect in settings.' });

    await googleDrive.getAuthorizedClient(user);

    expect(user.driveSyncError).toBe('');
    expect(user.save).toHaveBeenCalledTimes(1);
  });
});

describe('IES-P1-24 · driveSyncError flag persistence', () => {
  it('setDriveError writes a targeted $set (never a full save)', async () => {
    const updateOne = vi.spyOn(User, 'updateOne').mockResolvedValue(undefined);
    await googleDrive.setDriveError(
      { _id: USER_ID },
      'Drive folder creation failed. Please reconnect in settings.'
    );
    expect(updateOne).toHaveBeenCalledWith(
      { _id: USER_ID },
      { $set: { driveSyncError: 'Drive folder creation failed. Please reconnect in settings.' } }
    );
  });

  it('clearDriveError writes driveSyncError back to empty', async () => {
    const updateOne = vi.spyOn(User, 'updateOne').mockResolvedValue(undefined);
    await googleDrive.clearDriveError({ _id: USER_ID });
    expect(updateOne).toHaveBeenCalledWith({ _id: USER_ID }, { $set: { driveSyncError: '' } });
  });

  it('is a no-op without a user id', async () => {
    const updateOne = vi.spyOn(User, 'updateOne').mockResolvedValue(undefined);
    await googleDrive.setDriveError(null, 'boom');
    await googleDrive.clearDriveError({});
    expect(updateOne).not.toHaveBeenCalled();
  });
});
