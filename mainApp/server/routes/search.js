// Personal-only global search.
//   GET /api/search?q=…&limit=…
// Searches the signed-in user's own tasks, work logs and personal projects.
// Every result is normalized to `{ kind, id, title, subtitle, workspaceId, url }`.
const express = require('express');
const Project = require('../models/Project');
const Task = require('../models/Task');
const WorkLog = require('../models/WorkLog');
const protect = require('../middleware/auth');
const { z, objectId, requiredString, validate } = require('../utils/validation');
const { parsePageSize } = require('../utils/pagination');

const router = express.Router();
router.use(protect);

const MAX_QUERY_LENGTH = 100;

const searchQuerySchema = z
  .object({
    q: requiredString(MAX_QUERY_LENGTH, 'q', 'Search query is required'),
    // Accepted for backwards compatibility with older bookmark links; ignored.
    workspaceId: objectId.optional(),
    limit: z.coerce.number().int().min(1, 'limit must be at least 1').max(100, 'limit must be at most 100').optional(),
  })
  .passthrough();

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toResult(kind, id, title, subtitle, url) {
  return { kind, id: String(id), title, subtitle, workspaceId: undefined, url };
}

router.get('/', validate(null, { query: searchQuerySchema }), async (req, res, next) => {
  try {
    const limit = parsePageSize(req.query.limit);
    const rx = new RegExp(escapeRegex(req.query.q.trim()), 'i');

    const [tasks, worklogs, projects] = await Promise.all([
      Task.find({ userId: req.user._id, $or: [{ title: rx }, { description: rx }] }).limit(limit),
      WorkLog.find({ userId: req.user._id, $or: [{ title: rx }, { currentWork: rx }, { plan: rx }] }).limit(limit),
      Project.find({
        userId: req.user._id,
        workspaceRef: null,
        $or: [{ name: rx }, { nameKey: rx }, { description: rx }],
      }).limit(limit),
    ]);

    res.json({
      query: req.query.q.trim(),
      projects: projects.map((p) => toResult('project', p._id, p.name, p.description || 'Project', `/worklog/projects/${p._id}`)),
      tasks: tasks.map((t) => toResult('task', t._id, t.title, t.description || 'Task', `/worklog/tasks/${t._id}`)),
      worklogs: worklogs.map((w) => toResult('worklog', w._id, w.title || 'Untitled Work Item', w.currentWork || 'Work log', `/worklog/logs/${w._id}`)),
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
