# FocusFlow

Premium productivity and work tracking app that combines task management, time tracking, journaling, habits, reports, and analytics.

## Features

- Task management with priority, category, deadline, tags, color coding, and subtasks
- Smart timer with start, pause, resume, stop, and session tracking
- Work logs with daily entries, completed items, links, and report sharing
- Habit tracking with checklists and daily progress
- Work journal with mood and focus ratings
- Analytics and reports for daily and weekly focus trends
- Settings for profile, daily goal, Pomodoro durations, and theme preferences

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

## Build

```bash
npm run build
npm run preview
```

## Project Structure

```text
src/
  components/   Layout, auth, task, worklog, and UI components
  hooks/        Timer and active-timer hooks
  pages/        Route pages
  store/        Zustand stores and cached app state
  types/        Shared TypeScript interfaces
  utils/        API, time, storage, timer, and color utilities

server/
  middleware/   Authentication middleware
  models/       Mongoose models
  routes/       Express API routes
```
