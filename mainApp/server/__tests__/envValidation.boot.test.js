import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLACEHOLDER_JWT_SECRET = 'your_super_secret_jwt_key_change_this_in_production_min_32_chars';
const FAST_FAIL_MONGODB_URI = 'mongodb://127.0.0.1:1/test?serverSelectionTimeoutMS=800&connectTimeoutMS=500';

function runServer(envOverrides) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['index.js'], {
      cwd: serverDir,
      env: { ...process.env, ...envOverrides },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

describe('IES-P0-03 · server boot-time env validation', () => {
  it('refuses to boot when JWT_SECRET is empty', async () => {
    const { code, stderr } = await runServer({ JWT_SECRET: '', MONGODB_URI: FAST_FAIL_MONGODB_URI });
    expect(code).toBe(1);
    expect(stderr).toContain('JWT_SECRET is required');
  });

  it('refuses to boot when JWT_SECRET is the known placeholder', async () => {
    const { code, stderr } = await runServer({ JWT_SECRET: PLACEHOLDER_JWT_SECRET, MONGODB_URI: FAST_FAIL_MONGODB_URI });
    expect(code).toBe(1);
    expect(stderr).toContain('known placeholder');
  });

  it('refuses to boot when JWT_SECRET is shorter than 32 characters', async () => {
    const { code, stderr } = await runServer({ JWT_SECRET: 'short-secret', MONGODB_URI: FAST_FAIL_MONGODB_URI });
    expect(code).toBe(1);
    expect(stderr).toContain('at least 32 characters');
  });

  it('refuses to boot when other required env vars are missing', async () => {
    const { code, stderr } = await runServer({ GOOGLE_CLIENT_ID: '', MONGODB_URI: FAST_FAIL_MONGODB_URI });
    expect(code).toBe(1);
    expect(stderr).toContain('GOOGLE_CLIENT_ID is required');
  });

  it('refuses to boot on an invalid PORT', async () => {
    const { code, stderr } = await runServer({ PORT: 'abc', MONGODB_URI: FAST_FAIL_MONGODB_URI });
    expect(code).toBe(1);
    expect(stderr).toContain('PORT must be an integer');
  });

  it(
    'passes validation with a valid secret and proceeds to MongoDB connect',
    async () => {
      const { code, stderr } = await runServer({
        JWT_SECRET: 'z'.repeat(64),
        MONGODB_URI: FAST_FAIL_MONGODB_URI,
        BOOT_MAX_RETRIES: '2',
        BOOT_RETRY_BASE_DELAY_MS: '0',
      });
      expect(code).toBe(1);
      expect(stderr).toContain('MongoDB connection failed');
      expect(stderr).toContain('retries exhausted');
      expect(stderr).not.toContain('Invalid environment');
    },
    15000
  );
});
