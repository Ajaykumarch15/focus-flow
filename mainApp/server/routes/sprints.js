// IES-R1: sprint CRUD routes (docs/migration-recommendation-1.md §5).
//
// Ownership invariants (§5): `workspaceRef` is derived from the owning Project
// (resolveProjectWorkspace), never the client body; Feature↔Sprint and
// Task↔Sprint refs share the owning project's workspaceRef; DELETE nulls
// child refs instead of cascading deletes.
const express = require('express');
const Sprint = require('../models/Sprint');
const Feature = require('../models/Feature');
const Task = require('../models/Task');
const Activity = require('../models/Activity');
const protect = require('../middleware/auth');
const {
  resolveProjectWorkspace,
  requireWorkspaceMember,
  requireWorkspaceEditor,
  requireWorkspaceOwnerAdmin,
  scopeToWorkspace,
} = require('../middleware/workspace');
const { z, objectId, dateInput, requiredString, validate } = require('../utils/validation');

const router = express.Router();
router.use(protect);

// IES-P0-16: body/param/query schemas.
const SPRINT_STATUS = ['future', 'active', 'completed'];

const sprintCreateSchema = z.object({
  projectId: objectId,
  name: requiredString(150, 'name', 'Sprint name is required'),
  startDate: dateInput,
  endDate: dateInput,
  goal: z.string().max(2000, 'Goal too long').default(''),
  capacityHours: z.number().finite('Invalid capacityHours').min(0, 'capacityHours must be at least 0').default(0),
  targetVelocity: z.number().finite('Invalid targetVelocity').min(0, 'targetVelocity must be at least 0').default(0),
}).passthrough();

const sprintPatchSchema = z.object({
  name: requiredString(150, 'name', 'Sprint name is required').optional(),
  startDate: dateInput.optional(),
  endDate: dateInput.optional(),
  goal: z.string().max(2000, 'Goal too long').optional(),
  capacityHours: z.number().finite('Invalid capacityHours').min(0, 'capacityHours must be at least 0').optional(),
  targetVelocity: z.number().finite('Invalid targetVelocity').min(0, 'targetVelocity must be at least 0').optional(),
  status: z.enum(SPRINT_STATUS).optional(),
}).passthrough();

const sprintParamsSchema = z.object({ id: objectId });
const sprintQuerySchema = z.object({ projectId: objectId });

async function loadSprint(req, res, next) {
  try {
    const sprint = await Sprint.findById(req.params.id);
    if (!sprint) return res.status(404).json({ message: 'Sprint not found' });
    req.sprint = sprint;
    next();
  } catch (err) {
    next(err);
  }
}

// ── GET /api/sprints?projectId= ───────────────────────────────────────────────
router.get('/', validate(null, { query: sprintQuerySchema }), resolveProjectWorkspace, requireWorkspaceMember, async (req, res, next) => {
  try {
    const sprints = await Sprint.find({ projectRef: req.project._id }).sort({ startDate: -1 });
    res.json(sprints);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/sprints ──────────────────────────────────────────────────────────
router.post('/', validate(sprintCreateSchema), resolveProjectWorkspace, requireWorkspaceEditor, async (req, res, next) => {
  try {
    const { name, startDate, endDate, goal, capacityHours, targetVelocity } = req.body;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (!(start.getTime() < end.getTime())) {
      return res.status(400).json({ message: 'startDate must be before endDate' });
    }

    const sprint = await Sprint.create({
      projectRef: req.project._id,
      workspaceRef: req.project.workspaceRef,
      name: name.trim(),
      goal: goal || '',
      startDate: start,
      endDate: end,
      capacityHours: capacityHours || 0,
      targetVelocity: targetVelocity || 0,
      createdBy: req.user._id,
    });

    res.status(201).json(sprint);
    Activity.create({
      userId: req.user._id,
      action: 'sprint.created',
      workspaceRef: req.project.workspaceRef,
      details: { sprintName: sprint.name, projectName: req.project.name, sprintId: sprint._id },
    }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/sprints/:id ─────────────────────────────────────────────────────
router.patch('/:id', validate(sprintPatchSchema, { params: sprintParamsSchema }), loadSprint, scopeToWorkspace((req) => req.sprint.workspaceRef), requireWorkspaceEditor, async (req, res, next) => {
  try {
    const patch = {};
    const { name, goal, startDate, endDate, capacityHours, targetVelocity, status } = req.body;
    if (name !== undefined) patch.name = name.trim();
    if (goal !== undefined) patch.goal = goal;
    if (startDate !== undefined) patch.startDate = new Date(startDate);
    if (endDate !== undefined) patch.endDate = new Date(endDate);
    if (capacityHours !== undefined) patch.capacityHours = capacityHours;
    if (targetVelocity !== undefined) patch.targetVelocity = targetVelocity;
    if (status !== undefined) patch.status = status;

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ message: 'No updatable fields provided' });
    }
    if (patch.startDate || patch.endDate) {
      const start = (patch.startDate || req.sprint.startDate).getTime();
      const end = (patch.endDate || req.sprint.endDate).getTime();
      if (!(start < end)) {
        return res.status(400).json({ message: 'startDate must be before endDate' });
      }
    }

    const sprint = await Sprint.findByIdAndUpdate(req.params.id, { $set: patch }, { new: true, runValidators: true });
    res.json(sprint);
    Activity.create({
      userId: req.user._id,
      action: 'sprint.updated',
      workspaceRef: req.sprint.workspaceRef,
      details: { sprintName: sprint.name, sprintId: sprint._id },
    }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/sprints/:id ────────────────────────────────────────────────────
router.delete('/:id', validate(null, { params: sprintParamsSchema }), loadSprint, scopeToWorkspace((req) => req.sprint.workspaceRef), requireWorkspaceOwnerAdmin, async (req, res, next) => {
  try {
    const sprint = req.sprint;
    await Sprint.findByIdAndDelete(sprint._id);
    // IES-R1: no cascade delete — children return to the Project Backlog.
    await Promise.all([
      Feature.updateMany({ sprintRef: sprint._id }, { $set: { sprintRef: null } }),
      Task.updateMany({ sprintRef: sprint._id }, { $set: { sprintRef: null } }),
    ]);
    res.json({ message: 'Sprint deleted' });
    Activity.create({
      userId: req.user._id,
      action: 'sprint.deleted',
      workspaceRef: sprint.workspaceRef,
      details: { sprintName: sprint.name, sprintId: sprint._id },
    }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

module.exports = router;
