# FocusFlow

Premium productivity and work tracking app that combines task management, time tracking, journaling, habits, reports, and analytics.

## Features

- Task management with priority, category, deadline, tags, color coding, and subtasks
- Smart timer with start, pause, resume, stop, and session tracking
- Work logs with daily entries, completed items, links, and report sharing
- Habit tracking with checklists and daily progress
- Work journal with mood and focus ratings
- Analytics and reports for daily and weekly focus trends
- Settings for profile, daily goal, and theme preferences

## Tech Stack

- React 18, TypeScript, and Vite
- Tailwind CSS
- Framer Motion
- Zustand
- Recharts
- Lucide React
- React Router
- Express, Mongoose, MongoDB, JWT auth

## Getting Started

Install frontend dependencies:

```bash
npm install
```

Install backend dependencies:

```bash
cd server
npm install
```

Copy `server/.env.example` to `server/.env` and fill in the required values (see the template for how to generate a `JWT_SECRET`).

Run the backend:

```bash
cd server
npm run dev
```

Run the frontend in another terminal:

```bash
npm run dev
```

Open http://localhost:5173.

## Client environment (VITE_API_URL)

The frontend is configured from **one** env file at the repo/app root — `mainApp/.env`
(and `mainApp/.env.production` etc. for other modes). There is **no** `src/.env`.

```bash
# mainApp/.env
VITE_API_URL=http://localhost:5001/api
```

- `VITE_API_URL` is **required**: `npm run build` fails loudly if it is missing
  (no silent `localhost` fallback — see `vite.config.ts`).
- All env files matching `.env*` are gitignored; commit only `.env.example` / `.env.sample`.

## Build

```bash
npm run build
npm run preview
```

## Project Structure

Two applications live under `mainApp/`:

```text
mainApp/                 Frontend (React 18 + Vite + TypeScript)
  src/
    components/   Layout, auth, task, worklog, and UI components
    hooks/        Timer and active-timer hooks
    pages/        Route pages
    store/        Zustand stores and cached app state
    types/        Shared TypeScript interfaces
    utils/        API, time, storage, timer, and color utilities

mainApp/server/          Backend API (Express + Mongoose + MongoDB)
  middleware/   Authentication middleware
  models/       Mongoose models
  routes/       Express API routes
  migrations/   Versioned, idempotent DB migrations (`npm run migrate`)
```

## Containerized deployment (Docker)

Build contexts are the repository root; all config lives in `nginx.conf`,
`docker-compose.yml`, and the per-app `Dockerfile`s.

```bash
# Full stack (client + server + mongo)
docker compose up --build
# → app at http://localhost:8080, API at http://localhost:8080/api

# External MongoDB instead of the bundled one (mongo becomes optional)
MONGODB_URI=mongodb://host:27017/focusflow docker compose up client server

# One-process variant
docker build -f mainApp/Dockerfile -t focusflow-client .
docker build -f mainApp/server/Dockerfile -t focusflow-server .
```

Configuration:

- `JWT_SECRET` — must be ≥32 chars and unique per deployment (the compose
  default is a local-demo placeholder; the server refuses to boot with a weak
  or known value).
- `GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI` — non-empty for the server to boot;
  replace the `disabled` placeholders to enable Google sign-in.
- `VITE_API_URL` — the client build bakes the API origin; the compose default
  (`http://localhost:8080/api`) matches the nginx reverse proxy.
- `CLIENT_PORT` / `MONGODB_URI` / `CLIENT_URL` — overridable via environment.

TLS: terminate HTTPS in front of the client (reverse proxy/LB) and set
`NODE_ENV=production` on the server so the session cookie is `Secure`; see the
443 block commented out in `nginx.conf`.

Health: `GET /api/health` (liveness) and `GET /api/health/ready` (readiness,
200 only once MongoDB is connected) drive the container healthchecks.

Data: MongoDB persists to the `mongo_data` volume; `docker compose restart`
keeps all data.

