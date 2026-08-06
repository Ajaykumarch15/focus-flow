const express = require('express');
const Task = require('../models/Task');
const Session = require('../models/Session');
const Journal = require('../models/Journal');
const WorkLog = require('../models/WorkLog');
const Activity = require('../models/Activity');
const Project = require('../models/Project');
const Sprint = require('../models/Sprint');
const Feature = require('../models/Feature');
const Workspace = require('../models/Workspace');
const protect = require('../middleware/auth');
const { findMember } = require('../middleware/workspace');
const { buildPatch } = require('../utils/patchSanitizer');
const { syncWorkLog } = require('../utils/worklogSync');
const { localDateToUtc, userTimezone } = require('../utils/dates');
const { logger } = require('../utils/logger');
const { z, objectId, dateInput, requiredString, validate } = require('../utils/validation');
const { assertWithinCapacity } = require('../utils/sprintMetrics');

const router = express.Router();
router.use(protect);

// IES-P1-06: deadlines are calendar dates ("YYYY-MM-DD") in the user's timezone,
// stored as that day's tz-midnight instant so `dayKey(deadline, tz)` always
// round-trips to the picked date. A raw "YYYY-MM-DD" from a date input is used
// verbatim; anything else (epoch ms / ISO) represents a picked UTC calendar date
// from the legacy client, so it is decoded via the instant's UTC day to avoid
// drifting a day early in negative-offset timezones.
function encodeDeadline(value, timeZone) {
  if (value === null || value === '') return null;
  if (value === undefined) return undefined;
  const raw = String(value);
  let dateKey;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    dateKey = raw;
  } else {
    const ts = new Date(value).getTime();
    if (!Number.isFinite(ts)) return undefined;
    dateKey = new Date(ts).toISOString().slice(0, 10);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return undefined;
  return localDateToUtc(dateKey, timeZone);
}

// IES-P0-16: body/param schemas.
const TASK_PRIORITY = ['low', 'medium', 'high', 'urgent'];
const TASK_STATUS = ['todo', 'active', 'paused', 'completed'];
const COLLAB_TASK_STATUS = ['backlog', 'ready', 'in_progress', 'review', 'done'];

const taskBase = {
  title: requiredString(200, 'title', 'Title is required'),
  description: z.string().max(5000, 'Description too long'),
  priority: z.enum(TASK_PRIORITY),
  status: z.enum(TASK_STATUS),
  category: z.string().trim().max(50, 'Category too long'),
  deadline: dateInput,
  color: z.string().trim().max(20, 'Color too long'),
  tags: z.array(z.string().trim().max(50, 'Tag too long')).max(50, 'Too many tags'),
};

const subtaskItem = z.object({
  title: requiredString(200, 'Subtask title', 'Subtask title required'),
});

// IES-R1: gitContext mirrors src/types/collaboration.ts GitContext.
const gitContextSchema = z.object({
  repository: z.string().max(500, 'Too long').optional(),
  branch: z.string().max(200, 'Too long').optional(),
  commitHash: z.string().max(100, 'Too long').optional(),
  prNumber: z.number().int('prNumber must be an integer').min(0, 'prNumber must be at least 0').optional(),
  prUrl: z.string().max(2000, 'Too long').optional(),
  reviewStatus: z.enum(['pending', 'approved', 'changes_requested']).optional(),
  reviewerName: z.string().max(200, 'Too long').optional(),
  mergeStatus: z.enum(['open', 'merged', 'closed']).optional(),
  deploymentStatus: z.enum(['staging', 'production', 'failed', 'not_deployed']).optional(),
}).passthrough();

// IES-R1: optional collaboration refs for workspace tasks (backward compatible —
// the personal create path ignores them).
const collabCreateFields = {
  workspaceId: objectId.optional(),
  projectId: objectId.optional(),
  sprintId: objectId.optional(),
  featureId: objectId.optional(),
  assigneeId: objectId.optional(),
  reviewerId: objectId.optional(),
  followerIds: z.array(objectId).max(100, 'Too many followers').optional(),
  labels: z.array(z.string().trim().max(50, 'Label too long')).max(50, 'Too many labels').optional(),
  dependencies: z.array(objectId).max(100, 'Too many dependencies').optional(),
  estimatedHours: z.number().finite('Invalid estimatedHours').min(0, 'estimatedHours must be at least 0').optional(),
  actualHours: z.number().finite('Invalid actualHours').min(0, 'actualHours must be at least 0').optional(),
  sprintStatus: z.enum(COLLAB_TASK_STATUS).optional(),
  gitContext: gitContextSchema.optional(),
};

const taskCreateSchema = z.object({
  ...taskBase,
  subtasks: z.array(subtaskItem).max(100, 'Too many subtasks'),
  ...collabCreateFields,
}).passthrough();

const taskPatchSchema = z.object({
  ...taskBase,
  deadline: dateInput.nullable(),
  // IES-R1 (P5-T3): collab writable fields — updateTaskStatus/assignee/reviewer/
  // labels/dependencies/hours persist via this route. Refs (workspace/project/
  // sprint/feature) stay managed by the sprint/feature routes, not here.
  sprintStatus: z.enum(COLLAB_TASK_STATUS).optional(),
  assigneeId: objectId.optional(),
  reviewerId: objectId.optional(),
  followerIds: z.array(objectId).max(100, 'Too many followers').optional(),
  labels: z.array(z.string().trim().max(50, 'Label too long')).max(50, 'Too many labels').optional(),
  dependencies: z.array(objectId).max(100, 'Too many dependencies').optional(),
  estimatedHours: z.number().finite('Invalid estimatedHours').min(0, 'estimatedHours must be at least 0').optional(),
  actualHours: z.number().finite('Invalid actualHours').min(0, 'actualHours must be at least 0').optional(),
}).partial().passthrough();

const taskParamsSchema = z.object({ id: objectId });
const subtaskParamsSchema = z.object({ id: objectId, subId: objectId });
const subtaskCreateSchema = z.object({
  title: requiredString(200, 'Subtask title', 'Subtask title required'),
});
const subtaskPatchSchema = z.object({ completed: z.boolean('completed must be a boolean') });

// IES-R1: workspace-scoped reads (`?workspaceId=`, `?projectId=`, `?sprintId=`,
// `?featureId=`). No workspace filter keeps the personal path.
const taskQuerySchema = z.object({
  workspaceId: objectId.optional(),
  projectId: objectId.optional(),
  sprintId: objectId.optional(),
  featureId: objectId.optional(),
}).passthrough();

// Fields a client may update on a Task via PATCH. Everything else is rejected.
const TASK_PATCH_FIELDS = {
  title: true,
  description: true,
  priority: true,
  status: true,
  category: true,
  deadline: true,
  color: true,
  tags: true,
  // IES-R1 (P5-T3): collab writable fields (see taskPatchSchema above).
  sprintStatus: true,
  assigneeId: true,
  reviewerId: true,
  followerIds: true,
  labels: true,
  dependencies: true,
  estimatedHours: true,
  actualHours: true,
};

// IES-R1 ownership invariant: workspaceRef is derived from the owning Project
// (never the client body) and all Task↔Feature/Sprint refs share one projectRef.
async function resolveTaskScope({ workspaceId, projectId, sprintId, featureId }) {
  let workspaceRef = workspaceId || null;
  let projectRef = null;
  let sprintRef = null;
  let featureRef = null;

  if (featureId) {
    const feature = await Feature.findById(featureId);
    if (!feature) return { error: true, status: 404, message: 'Feature not found' };
    if (projectId && String(feature.projectRef) !== String(projectId)) {
      return { error: true, status: 400, message: 'Feature does not belong to this project' };
    }
    if (sprintId && (!feature.sprintRef || String(feature.sprintRef) !== String(sprintId))) {
      return { error: true, status: 400, message: 'Feature is not planned in this sprint' };
    }
    projectRef = feature.projectRef;
    featureRef = feature._id;
    sprintRef = feature.sprintRef;
  }

  if (sprintId && !sprintRef) {
    const sprint = await Sprint.findById(sprintId);
    if (!sprint) return { error: true, status: 404, message: 'Sprint not found' };
    if (projectId && String(sprint.projectRef) !== String(projectId)) {
      return { error: true, status: 400, message: 'Sprint does not belong to this project' };
    }
    sprintRef = sprint._id;
    projectRef = projectRef || sprint.projectRef;
  }

  if (projectId && !projectRef) {
    const project = await Project.findById(projectId);
    if (!project) return { error: true, status: 404, message: 'Project not found' };
    projectRef = project._id;
    workspaceRef = workspaceRef || project.workspaceRef;
  }

  if (workspaceId && !workspaceRef) workspaceRef = workspaceId;

  if (workspaceRef && projectRef) {
    const project = await Project.findById(projectRef);
    if (!project) return { error: true, status: 404, message: 'Project not found' };
    if (String(project.workspaceRef) !== String(workspaceRef)) {
      return { error: true, status: 400, message: 'Project does not belong to this workspace' };
    }
  }

  return { error: false, workspaceRef, projectRef, sprintRef, featureRef };
}

// IES-R1: workspace tasks are edited/deleted only by non-Viewer members.
async function isWorkspaceEditor(workspaceRef, userId) {
  const ws = await Workspace.findById(workspaceRef).select('members');
  const m = ws && findMember(ws, userId);
  return !!(m && m.role !== 'Viewer');
}

// EEP2-P4.2.2: capacity guard for tasks landing in a sprint (via an owning
// Feature or an explicit sprintId) — a task's estimate consumes the sprint's
// capacityHours budget (0 = uncapped). DDS §10.
async function assertSprintCapacityForTask({ sprintRef, incomingHours, excludeTaskId }) {
  const [sprint, features, tasks] = await Promise.all([
    Sprint.findById(sprintRef),
    Feature.find({ sprintRef }).select('estimatedHours'),
    Task.find({ sprintRef }).select('estimatedHours'),
  ]);
  if (!sprint) return { status: 404, message: 'Sprint not found' };
  const siblings = tasks.filter((t) => String(t._id) !== String(excludeTaskId));
  return assertWithinCapacity({ sprint, features, tasks: siblings, incomingHours });
}

// GET /api/tasks
router.get('/', validate(null, { query: taskQuerySchema }), async (req, res, next) => {
  try {
    const { workspaceId, projectId, sprintId, featureId } = req.query;

    // IES-R1: workspace-scoped query (member-gated).
    if (workspaceId || projectId || sprintId || featureId) {
      const filter = {};
      let wsId = workspaceId;
      if (projectId) {
        const project = await Project.findById(projectId);
        if (!project) return res.status(404).json({ message: 'Project not found' });
        wsId = wsId || project.workspaceRef;
        filter.projectRef = projectId;
      }
      if (sprintId) {
        const sprint = await Sprint.findById(sprintId);
        if (!sprint) return res.status(404).json({ message: 'Sprint not found' });
        wsId = wsId || sprint.workspaceRef;
        filter.sprintRef = sprintId;
      }
      if (featureId) {
        const feature = await Feature.findById(featureId);
        if (!feature) return res.status(404).json({ message: 'Feature not found' });
        wsId = wsId || feature.workspaceRef;
        filter.featureRef = featureId;
      }
      if (!wsId) return res.status(400).json({ message: 'A workspace scope is required' });
      const ws = await Workspace.findById(wsId).select('members');
      if (!ws || !findMember(ws, req.user._id)) {
        return res.status(403).json({ message: 'You are not a member of this workspace' });
      }
      filter.workspaceRef = wsId;
      const tasks = await Task.find(filter).sort({ createdAt: -1 });
      return res.json(tasks);
    }

    // IES-R1: personal tasks = { userId, workspaceRef: null } (matches legacy
    // docs without the field too — Mongo null-equality matches missing).
    const tasks = await Task.find({ userId: req.user._id, workspaceRef: null }).sort({ createdAt: -1 });
    logger.debug({ count: tasks.length }, 'tasks fetched');
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks
router.post('/', validate(taskCreateSchema), async (req, res, next) => {
  try {
    const { title, description, priority, status, category, deadline, color, tags, subtasks } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Title is required' });
    }

    const {
      workspaceId, projectId, sprintId, featureId,
      assigneeId, reviewerId, followerIds, labels, dependencies,
      estimatedHours, actualHours, sprintStatus, gitContext,
    } = req.body;
    const hasCollabScope = workspaceId || projectId || sprintId || featureId;

    // IES-R1: workspace task create — derive workspaceRef from the owning
    // project, enforce the same-project invariant, and gate on editor role.
    if (hasCollabScope) {
      const scope = await resolveTaskScope({ workspaceId, projectId, sprintId, featureId });
      if (scope.error) return res.status(scope.status).json({ message: scope.message });
      if (!(await isWorkspaceEditor(scope.workspaceRef, req.user._id))) {
        return res.status(403).json({ message: 'Only workspace editors can create tasks in this workspace' });
      }

      if (scope.sprintRef) {
        // EEP2-P4.2.2: creating a task inside a sprint consumes capacity.
        const capErr = await assertSprintCapacityForTask({ sprintRef: scope.sprintRef, incomingHours: estimatedHours || 0 });
        if (capErr) return res.status(capErr.status).json({ message: capErr.message });
      }

      const task = await Task.create({
        userId: req.user._id,
        title: title.trim(),
        description: description || '',
        priority: priority || 'medium',
        status: status || 'todo',
        category: category || 'Work',
        color: color || '#0ea5e9',
        tags: tags || [],
        subtasks: subtasks || [],
        deadline: encodeDeadline(deadline, userTimezone(req.user)) || undefined,
        workspaceRef: scope.workspaceRef,
        projectRef: scope.projectRef || undefined,
        sprintRef: scope.sprintRef || undefined,
        featureRef: scope.featureRef || undefined,
        assigneeId: assigneeId ?? undefined,
        reviewerId: reviewerId ?? undefined,
        followerIds: followerIds || [],
        labels: labels || [],
        dependencies: dependencies || [],
        estimatedHours: estimatedHours || 0,
        actualHours: actualHours || 0,
        sprintStatus: sprintStatus || 'backlog',
        gitContext: gitContext || undefined,
      });

      logger.debug('workspace task created');
      res.status(201).json(task);
      Activity.create({
        userId: req.user._id,
        action: 'task.created',
        workspaceRef: scope.workspaceRef,
        details: { taskTitle: task.title, taskId: task._id },
      }).catch(() => {});
      return;
    }

    // Personal create path — unchanged.
    const task = await Task.create({
      userId: req.user._id,
      title: title.trim(),
      description: description || '',
      priority: priority || 'medium',
      status: status || 'todo',
      category: category || 'Work',
      color: color || '#0ea5e9',
      tags: tags || [],
      subtasks: subtasks || [],
      deadline: encodeDeadline(deadline, userTimezone(req.user)) || undefined,
    });

    logger.debug('task created');
    res.status(201).json(task);
    Activity.create({ userId: req.user._id, action: 'task.created', details: { taskTitle: task.title, taskId: task._id } }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// PATCH /api/tasks/:id
router.patch('/:id', validate(taskPatchSchema, { params: taskParamsSchema }), async (req, res, next) => {
  try {
    const patch = buildPatch(req.body, TASK_PATCH_FIELDS);
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ message: 'No updatable fields provided' });
    }
    if ('deadline' in patch) {
      patch.deadline = encodeDeadline(patch.deadline, userTimezone(req.user));
      if (patch.deadline === undefined) delete patch.deadline;
    }

    // IES-R1: workspace-scoped tasks additionally require an editor gate.
    const existing = await Task.findOne({ _id: req.params.id, userId: req.user._id }).select('workspaceRef sprintRef estimatedHours');
    if (!existing) return res.status(404).json({ message: 'Task not found' });
    if (existing.workspaceRef && !(await isWorkspaceEditor(existing.workspaceRef, req.user._id))) {
      return res.status(403).json({ message: 'Only workspace editors can update this task' });
    }

    // EEP2-P4.2.2: re-estimating a task that is planned into a sprint may not
    // push the sprint's projected load over its capacityHours budget.
    if (existing.sprintRef && patch.estimatedHours !== undefined) {
      const capErr = await assertSprintCapacityForTask({
        sprintRef: existing.sprintRef,
        incomingHours: patch.estimatedHours || 0,
        excludeTaskId: req.params.id,
      });
      if (capErr) return res.status(capErr.status).json({ message: capErr.message });
    }

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: patch },
      { new: true, runValidators: true }
    );
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json(task);
    if (req.body.status === 'completed') {
      Activity.create({ userId: req.user._id, action: 'task.completed', details: { taskTitle: task.title, taskId: task._id } }).catch(() => {});
    }
  } catch (err) {
    next(err);
  }
});

// PATCH /api/tasks/:id/git — IES-R1 git context (mirrors types/collaboration.ts).
router.patch('/:id/git', validate(gitContextSchema, { params: taskParamsSchema }), async (req, res, next) => {
  try {
    const existing = await Task.findOne({ _id: req.params.id, userId: req.user._id }).select('workspaceRef');
    if (!existing) return res.status(404).json({ message: 'Task not found' });
    if (existing.workspaceRef && !(await isWorkspaceEditor(existing.workspaceRef, req.user._id))) {
      return res.status(403).json({ message: 'Only workspace editors can update this task' });
    }

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: { gitContext: req.body } },
      { new: true, runValidators: true }
    );
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json(task);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', validate(null, { params: taskParamsSchema }), async (req, res, next) => {
  try {
    // IES-R1: workspace-scoped tasks additionally require an editor gate.
    const existing = await Task.findOne({ _id: req.params.id, userId: req.user._id }).select('workspaceRef');
    if (!existing) return res.status(404).json({ message: 'Task not found' });
    if (existing.workspaceRef && !(await isWorkspaceEditor(existing.workspaceRef, req.user._id))) {
      return res.status(403).json({ message: 'Only workspace editors can delete this task' });
    }

    const task = await Task.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!task) return res.status(404).json({ message: 'Task not found' });

    // IES-P1-09: the cascade removes the task's sessions/journal, and any
    // worklog linked via taskRef must not keep dangling `sessionIds` or a stale
    // `totalActiveMs`. Recompute each affected log against its (now-deleted)
    // sessions — the single source of truth — which strips the orphaned ids and
    // zeroes the derived totals, then unlink the task.
    const workLogs = await WorkLog.find({ taskRef: req.params.id, userId: req.user._id });

    await Promise.all([
      Session.deleteMany({ taskId: req.params.id, userId: req.user._id }),
      Journal.deleteMany({ taskId: req.params.id, userId: req.user._id }),
    ]);

    const timeZone = userTimezone(req.user);
    await Promise.all(workLogs.map(async (log) => {
      await syncWorkLog(log, req.user._id, { timeZone, persist: false });
      log.taskRef = undefined;
      await log.save();
    }));

    logger.debug('task deleted');
    res.json({ message: 'Task deleted' });
    Activity.create({ userId: req.user._id, action: 'task.deleted', details: { taskTitle: task.title } }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks/:id/subtasks
router.post('/:id/subtasks', validate(subtaskCreateSchema, { params: taskParamsSchema }), async (req, res, next) => {
  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $push: { subtasks: { title: req.body.title } } },
      { new: true, runValidators: true }
    );
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json(task);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/tasks/:id/subtasks/:subId
router.patch('/:id/subtasks/:subId', validate(subtaskPatchSchema, { params: subtaskParamsSchema }), async (req, res, next) => {
  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id, 'subtasks._id': req.params.subId },
      { $set: { 'subtasks.$.completed': req.body.completed } },
      { new: true, runValidators: true }
    );
    if (!task) return res.status(404).json({ message: 'Task or subtask not found' });
    res.json(task);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/tasks/:id/subtasks/:subId
router.delete('/:id/subtasks/:subId', validate(null, { params: subtaskParamsSchema }), async (req, res, next) => {
  try {
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $pull: { subtasks: { _id: req.params.subId } } },
      { new: true, runValidators: true }
    );
    if (!task) return res.status(404).json({ message: 'Task not found' });
    res.json(task);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
