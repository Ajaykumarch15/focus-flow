# Collab workspace removal

FocusFlow now has exactly two workspaces: **Personal** and **WorkLog**. The
collab workspace, its teams/people/chat/leaderboard surfaces, and their server
routes have been removed. Admin Teams and the Meetings members directory were
also removed; meeting organisers and participants remain on each meeting.

## What was removed

- Frontend: `src/modules/collab/**`, the `@collab` alias, collab routes, the
  GlobalHeader chat/command-palette buttons, Admin Teams and Meetings members.
- Server: collab route mounts (`teams`, `workspaces`, `sprints`, `features`,
  `milestones`, `phases`, `modules`, `comments`, `attachments`, `notifications`,
  `chat`), the Socket.IO chat layer, admin workspace-role endpoints, and the
  collab task merge in `useStore.loadAll`.
- Search is now personal-only (tasks, work logs, personal projects).
- Collab links on tasks are gone: no workspace/sprint/feature refs, no
  workspace-scoped task reads/creates, no collab timer gate in
  `POST /api/sessions`, no collab worklog visibility endpoints, and no
  `workspaceContext: 'collab'` value in the client or task models.
- Obsolete collab unit/integration tests were removed alongside the features.
- Collab Mongoose model files are retained **only** so the historical
  `001_role_migration.js` / authorization seed can still run. The migration
  below drops their collections; the files can be deleted once those legacy
  scripts are archived.
- `leaderboardOptIn` remains on users as the public-profile visibility flag —
  it is not a leaderboard feature and avoids an unrelated data migration.

## Legacy links

| Old route | New route |
| --- | --- |
| `/collab/*` | `/home` |
| `/admin/teams` | `/admin/people` |
| `/meetings/members` | `/meetings` |

## Data migration runbook

Run these against the production database, in order, while the app is stopped:

1. **Archive** (non-destructive):
   ```bash
   cd mainApp
   node server/scripts/archiveCollabData.js
   ```
   Writes EJSON documents and a `manifest.json` to
   `backups/collab-archive-<timestamp>/`. Verify the archive before continuing.

2. **Preview** the destructive step:
   ```bash
   node server/migrations/0019_remove_collab_data.js --dry-run
   ```

3. **Apply**:
   ```bash
   node server/migrations/0019_remove_collab_data.js
   ```

The migration drops collab-owned collections, deletes workspace-backed projects,
unsets `teamIds` on kept projects, clears dangling collab refs on tasks and
personal tasks (`workspaceRef`, `projectRef`, `sprintRef`, `featureRef`,
assignee/reviewer/follower fields, sprint/hours/git metadata), clears
`workspaceId` on meetings/schedules, and relabels collab task contexts as
`work` / `personal`. The archive keeps a copy of every affected task document.

`backups/` is git-ignored. Keep the archive in your own backup store according
to your retention policy.
