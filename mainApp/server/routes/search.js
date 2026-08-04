// IES-P2-06 · global + workspace search.
//
//   GET /api/search?q=…&workspaceId=…&limit=…
//
// Two scopes (auth always enforced via `protect`):
//   • workspaceId given → the caller must be a member (403 otherwise); searches
//     projects / teams / members inside that workspace.
//   • no workspaceId    → personal scope for the caller: tasks / worklogs /
//     personal projects / workspaces they belong to.
//
// Every result is normalized to `{ kind, id, title, subtitle, workspaceId, url }`
// so the client can render both the command palette and the results page from
// one contract. The global /api rate limiter in index.js keeps this bounded.
const express = require('express');
const Workspace = require('../models/Workspace');
const Project = require('../models/Project');
const Team = require('../models/Team');
const Task = require('../models/Task');
const WorkLog = require('../models/WorkLog');
const User = require('../models/User');
const protect = require('../middleware/auth');
const { memberUserId, findMember } = require('../middleware/workspace');
const { z, objectId, requiredString, validate } = require('../utils/validation');
const { parsePageSize } = require('../utils/pagination');

const router = express.Router();
router.use(protect);

const MAX_QUERY_LENGTH = 100;

const searchQuerySchema = z
  .object({
    q: requiredString(MAX_QUERY_LENGTH, 'q', 'Search query is required'),
    workspaceId: objectId.optional(),
    limit: z.coerce.number().int().min(1, 'limit must be at least 1').max(100, 'limit must be at most 100').optional(),
  })
  .passthrough();

// Escape user input so it cannot inject regex operators (e.g. `.*`, `^`).
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toResult(kind, id, title, subtitle, workspaceId, url) {
  return { kind, id: String(id), title, subtitle, workspaceId, url };
}

// ── GET /api/search ────────────────────────────────────────────────────────────
router.get('/', validate(null, { query: searchQuerySchema }), async (req, res, next) => {
  try {
    const limit = parsePageSize(req.query.limit);
    const q = req.query.q.trim();
    const rx = new RegExp(escapeRegex(q), 'i');

    const results = {
      query: q,
      workspaceId: undefined,
      projects: [],
      teams: [],
      members: [],
      tasks: [],
      worklogs: [],
      workspaces: [],
    };

    if (req.query.workspaceId) {
      // ── Workspace scope: member-gated ─────────────────────────────────────
      const ws = await Workspace.findById(req.query.workspaceId);
      if (!ws) return res.status(404).json({ message: 'Workspace not found' });
      if (!findMember(ws, req.user._id)) {
        return res.status(403).json({ message: 'You are not a member of this workspace' });
      }
      results.workspaceId = String(ws._id);

      const projects = await Project.find({
        workspaceRef: ws._id,
        $or: [{ name: rx }, { nameKey: rx }, { description: rx }],
      }).limit(limit);
      results.projects = projects.map((p) =>
        toResult('project', p._id, p.name, p.description || 'Project', results.workspaceId, `/w/${ws._id}/projects`)
      );

      const teams = await Team.find({
        workspaceRef: ws._id,
        $or: [{ name: rx }, { description: rx }],
      }).limit(limit);
      results.teams = teams.map((t) =>
        toResult('team', t._id, t.name, t.description || 'Team', results.workspaceId, `/w/${ws._id}/teams`)
      );

      const memberIds = (ws.members || []).map((m) => memberUserId(m)).filter(Boolean);
      const members = await User.find({
        _id: { $in: memberIds },
        $or: [{ name: rx }, { email: rx }],
      }).limit(limit);
      results.members = members.map((u) =>
        toResult('member', u._id, u.name, u.email || 'Member', results.workspaceId, `/w/${ws._id}/members/${u._id}`)
      );
    } else {
      // ── Personal scope: the caller's own data ─────────────────────────────
      const [tasks, worklogs, projects, workspaces] = await Promise.all([
        Task.find({ userId: req.user._id, $or: [{ title: rx }, { description: rx }] }).limit(limit),
        WorkLog.find({ userId: req.user._id, $or: [{ title: rx }, { currentWork: rx }, { plan: rx }] }).limit(limit),
        Project.find({
          userId: req.user._id,
          workspaceRef: null,
          $or: [{ name: rx }, { nameKey: rx }, { description: rx }],
        }).limit(limit),
        Workspace.find({
          $and: [
            { $or: [{ createdBy: req.user._id }, { 'members.userId': req.user._id }] },
            { $or: [{ name: rx }, { description: rx }] },
          ],
        }).limit(limit),
      ]);

      results.tasks = tasks.map((t) =>
        toResult('task', t._id, t.title, t.description || 'Task', '', `/tasks/${t._id}`)
      );
      results.worklogs = worklogs.map((w) =>
        toResult('worklog', w._id, w.title || 'Untitled Work Item', w.currentWork || 'Work log', '', `/worklog/${w._id}`)
      );
      results.projects = projects.map((p) =>
        toResult('project', p._id, p.name, p.description || 'Project', '', '/team')
      );
      results.workspaces = workspaces.map((w) =>
        toResult('workspace', w._id, w.name, w.description || 'Workspace', String(w._id), `/w/${w._id}/overview`)
      );
    }

    res.json(results);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
