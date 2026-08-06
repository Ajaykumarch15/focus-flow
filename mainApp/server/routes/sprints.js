// IES-R1: sprint CRUD routes (docs/migration-recommendation-1.md §5).
//
// Ownership invariants (§5): `workspaceRef` is derived from the owning Project
// (resolveProjectWorkspace), never the client body; Feature↔Sprint and
// Task↔Sprint refs share the owning project's workspaceRef; DELETE nulls
// child refs instead of cascading deletes.
//
// EEP2-P4.1.2/3/4 (DDS §4.11, §6.1, §10): create/update carry goals, capacity
// and dates with strict validation; status changes flow through the lifecycle
// state machine (draft → planned → active → completed, no skips, planned →
// active guarded on startDate); the commitment endpoint latches
// `committed`/`commitmentDate` once (Owner/Admin) and freezes the scope.
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
const { SPRINT_STATUSES, assertTransition } = require('../utils/sprintState');

const router = express.Router();
router.use(protect);

// EEP2-P4.1.4: fields owned by the commitment endpoint — never writable via PATCH.
const SERVER_OWNED_FIELDS = ['committed', 'commitmentDate', 'committedBy'];
// Fields that define the committed scope and are frozen once committed.
const COMMIT_SCOPE_FIELDS = ['name', 'goal', 'startDate', 'endDate', 'capacityHours', 'targetVelocity'];

// IES-P0-16: body/param/query schemas.
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
  status: z.enum(SPRINT_STATUSES).optional(),
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
      status: 'draft',
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
    if (SERVER_OWNED_FIELDS.some((f) => req.body[f] !== undefined)) {
      return res.status(400).json({ message: 'committed / commitmentDate / committedBy are managed by the commit endpoint' });
    }

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

    // EEP2-P4.1.4: a committed sprint's scope is frozen — only lifecycle status
    // transitions may still change the document.
    if (req.sprint.committed && COMMIT_SCOPE_FIELDS.some((f) => patch[f] !== undefined)) {
      return res.status(409).json({ message: 'Sprint is committed and its scope is frozen' });
    }

    if (patch.startDate || patch.endDate) {
      const start = (patch.startDate || req.sprint.startDate).getTime();
      const end = (patch.endDate || req.sprint.endDate).getTime();
      if (!(start < end)) {
        return res.status(400).json({ message: 'startDate must be before endDate' });
      }
    }

    // EEP2-P4.1.3: status changes flow through the lifecycle state machine.
    const statusChanged = patch.status !== undefined && patch.status !== req.sprint.status;
    if (statusChanged) {
      try {
        assertTransition(req.sprint.status, patch.status, { now: Date.now(), startDate: req.sprint.startDate });
      } catch (err) {
        return res.status(err.status || 400).json({ message: err.message });
      }
    }

    const sprint = await Sprint.findByIdAndUpdate(req.params.id, { $set: patch }, { new: true, runValidators: true });
    res.json(sprint);
    Activity.create({
      userId: req.user._id,
      action: statusChanged ? 'sprint.state_changed' : 'sprint.updated',
      workspaceRef: req.sprint.workspaceRef,
      details: statusChanged
        ? { sprintName: sprint.name, sprintId: sprint._id, from: req.sprint.status, to: sprint.status }
        : { sprintName: sprint.name, sprintId: sprint._id },
    }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// ── POST /api/sprints/:id/commit (EEP2-P4.1.4) ────────────────────────────────
// Owner/Admin only. Latches `committed` + `commitmentDate` + `committedBy` and
// advances draft → planned. The commitment is one-way: a repeated commit is an
// idempotent no-op that never rewrites the original commitmentDate, and PATCH
// refuses to touch the committed scope afterwards.
router.post('/:id/commit', validate(null, { params: sprintParamsSchema }), loadSprint, scopeToWorkspace((req) => req.sprint.workspaceRef), requireWorkspaceOwnerAdmin, async (req, res, next) => {
  try {
    const sprint = req.sprint;
    if (sprint.committed) {
      return res.json(sprint);
    }

    const set = {
      committed: true,
      commitmentDate: new Date(),
      committedBy: req.user._id,
    };
    if (sprint.status === 'draft') {
      set.status = 'planned';
    }

    const updated = await Sprint.findByIdAndUpdate(sprint._id, { $set: set }, { new: true, runValidators: true });
    res.json(updated);
    Activity.create({
      userId: req.user._id,
      action: 'sprint.committed',
      workspaceRef: sprint.workspaceRef,
      details: { sprintName: updated.name, sprintId: updated._id, from: sprint.status, to: updated.status },
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
