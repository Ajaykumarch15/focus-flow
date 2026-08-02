# FocusFlow — MongoDB Atlas Integration Update

This zip contains **only the new and changed files** to upgrade the existing
FocusFlow app from localStorage to MongoDB Atlas.

---

## Step 1 — Fill in your MongoDB credentials

Edit `server/.env` and replace the placeholders:

```
MONGODB_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@cluster0.7iotm.mongodb.net/focusflow?appName=Cluster0
JWT_SECRET=<random 32+ char secret — generate per server/.env.example>
PORT=5000
CLIENT_URL=http://localhost:5173
```

> ⚠️  Never commit `.env` to git. It is already in `.gitignore`.

---

## Step 2 — File placement map

Copy each file from this zip into your existing project:

```
focusflow-update/
├── server/                         ← NEW folder — place at project root
│   ├── package.json
│   ├── .env                        ← fill in credentials
│   ├── index.js
│   ├── middleware/
│   │   └── auth.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Task.js
│   │   ├── Session.js
│   │   └── Journal.js
│   └── routes/
│       ├── auth.js
│       ├── tasks.js
│       ├── sessions.js
│       ├── journals.js
│       └── profile.js
│
├── .env                            ← place at focusflow/ root (frontend)
│
└── src/
    ├── App.tsx                     ← REPLACE existing
    ├── store/
    │   ├── useStore.ts             ← REPLACE existing
    │   └── useAuthStore.ts         ← NEW
    ├── utils/
    │   └── api.ts                  ← NEW
    ├── pages/
    │   ├── Login.tsx               ← NEW
    │   └── Register.tsx            ← NEW
    └── components/
        ├── auth/
        │   └── ProtectedRoute.tsx  ← NEW
        └── layout/
            └── Sidebar.tsx         ← REPLACE existing
```

---

## Step 3 — Install server dependencies

```bash
cd server
npm install
```

---

## Step 4 — Run both servers

**Terminal 1 — Backend API:**
```bash
cd server
npm run dev     # uses nodemon for auto-restart
```

**Terminal 2 — Frontend:**
```bash
cd focusflow    # your existing project root
npm run dev
```

The frontend (port 5173) talks to the backend (port 5000).

---

## Step 5 — MongoDB Atlas network access

In your Atlas dashboard:
1. Go to **Network Access**
2. Click **Add IP Address**
3. For development: add `0.0.0.0/0` (allow all)
4. For production: add only your server's IP

---

## What changed and why

| File | Type | Reason |
|------|------|--------|
| `server/*` | NEW | Express API server connecting to Atlas |
| `src/utils/api.ts` | NEW | Central fetch wrapper — attaches JWT automatically |
| `src/store/useAuthStore.ts` | NEW | Manages login state and JWT token |
| `src/store/useStore.ts` | REPLACED | Actions now call API instead of localStorage |
| `src/App.tsx` | REPLACED | Added auth routes + session restore on boot |
| `src/pages/Login.tsx` | NEW | Login page with email/password form |
| `src/pages/Register.tsx` | NEW | Registration page |
| `src/components/auth/ProtectedRoute.tsx` | NEW | Redirects unauthenticated users to /login |
| `src/components/layout/Sidebar.tsx` | REPLACED | Shows user email + logout button |
| `.env` | NEW | Vite reads `VITE_API_URL` from here |

---

## Data flow after update

```
User opens app
  → App.tsx calls restoreSession()
  → Validates JWT with GET /api/auth/me
  → If valid: calls loadAll() → fetches tasks, journals, sessions from Atlas
  → If invalid: redirects to /login

User creates task
  → Zustand optimistically adds it (instant UI)
  → POST /api/tasks fires in background
  → On success: MongoDB _id replaces temp id in state

Timer start
  → POST /api/sessions → creates Session doc in Atlas
  → Every tick: local Zustand only (no API call)
  → Pause/Resume: PATCH /api/sessions/:id/pause|resume
  → Stop: PATCH /api/sessions/:id/stop → Atlas computes final activeTime
```

---

## Troubleshooting

**CORS error** — Make sure `CLIENT_URL` in `server/.env` matches exactly
where your frontend runs (default: `http://localhost:5173`).

**MongoDB connection refused** — Check your Atlas cluster is not paused
(free tier auto-pauses after 7 days of inactivity). Check IP whitelist.

**JWT errors** — Make sure `JWT_SECRET` is the same value in `.env`
as when the token was originally signed (don't change it while users
are logged in).
