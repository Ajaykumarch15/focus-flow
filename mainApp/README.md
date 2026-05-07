# FocusFlow 🎯

**Premium Productivity & Work Tracking App**

A beautiful, modern productivity app combining task management, time tracking, journaling, and analytics — inspired by Notion + Clockify + Todoist + Linear.

## Features

- 📋 **Task Management** — Create tasks with priority, category, deadline, and color coding
- ⏱️ **Smart Timer** — Start/pause/resume/stop timers with automatic session tracking
- 📊 **Analytics** — Weekly charts, category breakdowns, and focus trends
- 📔 **Work Journal** — Mood-rated journal entries tied to each task
- ✅ **Subtasks** — Checklists with progress tracking
- 🎯 **Focus Mode** — Pomodoro timer with motivational quotes
- ⚙️ **Settings** — Customize name, daily goals, Pomodoro durations, and themes

## Tech Stack

- React 18 + TypeScript + Vite
- Tailwind CSS for styling
- Framer Motion for animations
- Zustand for state management (persisted to localStorage)
- Recharts for analytics
- Lucide React for icons
- React Router v6

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Build

```bash
npm run build
npm run preview
```

## Project Structure

```
src/
├── components/
│   ├── layout/       # Sidebar, AppLayout
│   └── tasks/        # TaskCard, CreateTaskModal
├── hooks/            # useTimer, useActiveTimer
├── pages/            # Landing, Dashboard, Tasks, TaskDetail, Analytics, Journal, FocusMode, Settings
├── store/            # Zustand store with persistence
├── types/            # TypeScript interfaces
└── utils/            # time, colors, storage utilities
```
