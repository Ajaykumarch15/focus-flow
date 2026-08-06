// EEP2-P3.2.2 / DDS §4.6, §6.2-6.3, §7: Phase CRUD — a delivery stage inside a
// Milestone. Gates: read = member, create/update = editor, delete = Owner/Admin.
// `workspaceRef`/`projectRef` are derived from the owning Project; the parent
// `milestoneRef` is validated to share the same projectRef (same-project at the
// Milestone↔Phase level) — this includes re-parenting via PATCH. Delete nulls
// `module.phaseRef` on child Modules and writes `phase.deleted` Activity.
const express = require('express');
const Milestone = require('../models/Milestone');
const Phase = require('../models/Phase');
const Module = require('../models/Module');
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

const PHASE_STATUS = ['planned', 'active', 'completed'];

const nullableDate = z.union([dateInput, z.null()]).optional();

const phaseCreateSchema = z.object({
  projectId: objectId,
  milestoneId: objectId,
  name: requiredString(150, 'name', 'Phase name is required'),
  description: z.string().max(5000, 'Description too long').default(''),
  status: z.enum(PHASE_STATUS).default('planned'),
  order: z.number().finite('Invalid order').default(0),
  startDate: nullableDate,
  endDate: nullableDate,
}).passthrough();

const phasePatchSchema = z.object({
  name: requiredString(150, 'name', 'Phase name is required').optional(),
  description: z.string().max(5000, 'Description too long').optional(),
  status: z.enum(PHASE_STATUS).optional(),
  order: z.number().finite('Invalid order').optional(),
  milestoneId: objectId.optional(),
  startDate: nullableDate,
  endDate: nullableDate,
}).passthrough();

const phaseParamsSchema = z.object({ id: objectId });

const phaseQuerySchema = z.object({ projectId: objectId, milestoneId: objectId.optional() }).passthrough();

const toDate = (v) => (v == null ? null : new Date(v));

// DDS §6.2: a Phase's parent Milestone must belong to the same project as the
// Phase being created/updated (no cross-project parents).
async function validateMilestoneForProject(milestoneId, projectRef) {
  const milestone = await Milestone.findById(milestoneId);
  if (!milestone) return { status: 404, message: 'Milestone not found' };
  if (String(milestone.projectRef) !== String(projectRef)) {
    return { status: 400, message: 'Milestone does not belong to this project' };
  }
  return null;
}

async function loadPhase(req, res, next) {
  try {
    const phase = await Phase.findById(req.params.id);
    if (!phase) return res.status(404).json({ message: 'Phase not found' });
    req.phase = phase;
    next();
  } catch (err) {
    next(err);
  }
}

// ── GET /api/phases?projectId=&milestoneId= ────────────────────────────────────
router.get('/', validate(null, { query: phaseQuerySchema }), resolveProjectWorkspace, requireWorkspaceMember, async (req, res, next) => {
  try {
    const filter = { projectRef: req.project._id };
    if (req.query.milestoneId) filter.milestoneRef = req.query.milestoneId;
    const phases = await Phase.find(filter).sort({ order: 1, createdAt: 1 });
    res.json(phases);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/phases ───────────────────────────────────────────────────────────
router.post('/', validate(phaseCreateSchema), resolveProjectWorkspace, requireWorkspaceEditor, async (req, res, next) => {
  try {
    const { milestoneId, name, description, status, order, startDate, endDate } = req.body;
    const err = await validateMilestoneForProject(milestoneId, req.project._id);
    if (err) return res.status(err.status).json({ message: err.message });

    const phase = await Phase.create({
      milestoneRef: milestoneId,
      projectRef: req.project._id,
      workspaceRef: req.project.workspaceRef,
      name: name.trim(),
      description: description || '',
      status: status || 'planned',
      order: order ?? 0,
      startDate: toDate(startDate),
      endDate: toDate(endDate),
      createdBy: req.user._id,
    });

    res.status(201).json(phase);
    Activity.create({
      userId: req.user._id,
      action: 'phase.created',
      workspaceRef: req.project.workspaceRef,
      details: { phaseName: phase.name, projectName: req.project.name, phaseId: phase._id },
    }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/phases/:id ──────────────────────────────────────────────────────
router.patch('/:id', validate(phasePatchSchema, { params: phaseParamsSchema }), loadPhase, scopeToWorkspace((req) => req.phase.workspaceRef), requireWorkspaceEditor, async (req, res, next) => {
  try {
    const patch = {};
    const { name, description, status, order, milestoneId, startDate, endDate } = req.body;
    if (name !== undefined) patch.name = name.trim();
    if (description !== undefined) patch.description = description;
    if (status !== undefined) patch.status = status;
    if (order !== undefined) patch.order = order;
    if (startDate !== undefined) patch.startDate = toDate(startDate);
    if (endDate !== undefined) patch.endDate = toDate(endDate);
    if (milestoneId !== undefined) {
      // P3.2.2 s2: re-parenting revalidates same-project against the Phase.
      const err = await validateMilestoneForProject(milestoneId, req.phase.projectRef);
      if (err) return res.status(err.status).json({ message: err.message });
      patch.milestoneRef = milestoneId;
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ message: 'No updatable fields provided' });
    }

    const phase = await Phase.findByIdAndUpdate(req.params.id, { $set: patch }, { new: true, runValidators: true });
    res.json(phase);
    Activity.create({
      userId: req.user._id,
      action: 'phase.updated',
      workspaceRef: req.phase.workspaceRef,
      details: { phaseName: phase.name, phaseId: phase._id },
    }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/phases/:id ─────────────────────────────────────────────────────
router.delete('/:id', validate(null, { params: phaseParamsSchema }), loadPhase, scopeToWorkspace((req) => req.phase.workspaceRef), requireWorkspaceOwnerAdmin, async (req, res, next) => {
  try {
    const phase = req.phase;
    await Phase.findByIdAndDelete(phase._id);
    // DDS §6.3: orphan protection — Modules stay, detached from the phase.
    await Module.updateMany({ phaseRef: phase._id }, { $set: { phaseRef: null } });
    res.json({ message: 'Phase deleted' });
    Activity.create({
      userId: req.user._id,
      action: 'phase.deleted',
      workspaceRef: phase.workspaceRef,
      details: { phaseName: phase.name, phaseId: phase._id },
    }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

module.exports = router;
