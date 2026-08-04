# FocusFlow — Production Credential Rotation Runbook (IES-P0-05)

Tracks EAR **BE-4 / CFG-4**: live production credentials were stored in plaintext in
`server/.env` (Atlas URI with username-as-password `AJAY:AJAY` and a live Google OAuth
client secret). This runbook rotates them, restricts Atlas network access, and moves
secrets to deploy-time env injection.

## Current state (after IES-P0-05 preparation)

| Secret | Status |
|---|---|
| Atlas DB user | Rotated password set in `server/.env` (gitignored). Atlas console must be updated to match (Step 1). |
| Atlas network access | Must be restricted to the server IP (Step 2). |
| Google OAuth client secret | Pre-rotation secret still in `server/.env`; regenerate in Cloud Console (Step 3). |
| JWT_SECRET | Already rotated (IES-P0-03). |

`.gitignore` now ignores `.env` **and** every `.env.*` variant (`.env.production`,
`.env.staging`, …) while keeping `.env.example` as the tracked template. No secret
may ever be committed.

## Step 1 — Atlas DB user (password rotation)

1. Open MongoDB Atlas → **Security → Database Access**.
2. Create a new DB user **or** reset the existing `AJAY` user:
   - Username: `focusflow_app` (recommended). If you instead keep `AJAY`, update the
     username in `server/.env` accordingly.
   - Password: copy the value from `server/.env` → `MONGODB_URI` (the part between
     `srv://<username>:` and `@cluster...`). Do **not** paste it here or in chat.
   - Privileges: `readWrite` on the `focusflow` database.
3. Save. Atlas propagates the change within seconds.

> The generated password uses only URL-safe characters, so no percent-encoding is
> needed inside the connection string.

## Step 2 — Atlas network access (restrict to server IP)

1. Atlas → **Security → Network Access**.
2. Remove any `0.0.0.0/0` (allow-all) entry for production.
3. Add the **static/public IP of the server** that runs the API.
4. For local development, add your current IP (it may change; re-add as needed).

## Step 3 — Google OAuth client secret (rotation)

1. Google Cloud Console → **APIs & Services → Credentials**.
2. Open the OAuth 2.0 Client ID matching `GOOGLE_CLIENT_ID` in `server/.env`.
3. Click **Reset secret** (or create a new client and update both `GOOGLE_CLIENT_ID`
   and `GOOGLE_CLIENT_SECRET`).
4. Paste the new secret into `server/.env` → `GOOGLE_CLIENT_SECRET`.
5. Confirm the authorized redirect URI matches `GOOGLE_REDIRECT_URI`
   (`http://localhost:5001/auth/google/callback` for dev; the production URL for prod).

## Step 4 — Deploy-time env injection (production)

- The production server must read every value from its platform env config or a secret
  manager (Render/Railway/Fly/VPS `EnvironmentFile`/a vault) — **never from a committed file**.
- Keep `server/.env.example` updated as the tracked template; `.env*` files stay out of git.
- Never paste secrets into issues, chat, or docs.

## Step 5 — Verify old credentials are revoked

1. Atlas: connect with the old `AJAY:AJAY` URI → must fail with `Authentication failed`.
2. Google: attempt a Drive connect with the old client secret → must fail.
3. App boots: `cd server && npm run dev` → no env-validation failure; DB connects with the new URI.

## Definition-of-Done checklist (IES-P0-05)

- [ ] New Atlas DB user/password active; old `AJAY:AJAY` rejected.
- [ ] Atlas network access = server IP only (no `0.0.0.0/0`).
- [ ] New Google OAuth secret active; old secret rejected.
- [ ] `git check-ignore -v server/.env.production` matches the `.env.*` rule.
- [ ] No old credential value appears in any tracked file.
