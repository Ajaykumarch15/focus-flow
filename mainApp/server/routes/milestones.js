// EEP2-P3.2.1 / DDS §4.5, §6.2-6.3, §7: Milestone CRUD — a roadmap entry of a
// project. Gates per the permission matrix: read = workspace member,
// create/update = editor (non-Viewer), delete = Owner/Admin. `workspaceRef` is
// always derived from the owning Project (resolveProjectWorkspace), never the
// client body. Delete nulls `phase.milestoneRef` on child Phases (orphan
// protection, DDS §6.3) and writes `milestone.deleted` Activity.
const express = require('express');
const Milestone = require('../models/Milestone');
const Phase = require('../models/Phase');
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

const MILESTONE_STATUS = ['planned', 'active', 'completed'];

const nullableDate = z.union([dateInput, z.null()]).optional();

const milestoneCreateSchema = z.object({
  projectId: objectId,
  name: requiredString(150, 'name', 'Milestone name is required'),
  description: z.string().max(5000, 'Description too long').default(''),
  targetDate: nullableDate,
  order: z.number().finite('Invalid order').default(0),
  status: z.enum(MILESTONE_STATUS).default('planned'),
}).passthrough();

const milestonePatchSchema = z.object({
  name: requiredString(150, 'name', 'Milestone name is required').optional(),
  description: z.string().max(5000, 'Description too long').optional(),
  targetDate: nullableDate,
  order: z.number().finite('Invalid order').optional(),
  status: z.enum(MILESTONE_STATUS).optional(),
}).passthrough();

const milestoneParamsSchema = z.object({ id: objectId });

const milestoneQuerySchema = z.object({ projectId: objectId }).passthrough();

const toDate = (v) => (v == null ? null : new Date(v));

async function loadMilestone(req, res, next) {
  try {
    const milestone = await Milestone.findById(req.params.id);
    if (!milestone) return res.status(404).json({ message: 'Milestone not found' });
    req.milestone = milestone;
    next();
  } catch (err) {
    next(err);
  }
}

// ── GET /api/milestones?projectId= ─────────────────────────────────────────────
router.get('/', validate(null, { query: milestoneQuerySchema }), resolveProjectWorkspace, requireWorkspaceMember, async (req, res, next) => {
  try {
    const milestones = await Milestone.find({ projectRef: req.project._id }).sort({ order: 1, targetDate: 1, createdAt: 1 });
    res.json(milestones);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/milestones ───────────────────────────────────────────────────────
router.post('/', validate(milestoneCreateSchema), resolveProjectWorkspace, requireWorkspaceEditor, async (req, res, next) => {
  try {
    const { name, description, targetDate, order, status } = req.body;
    const milestone = await Milestone.create({
      projectRef: req.project._id,
      workspaceRef: req.project.workspaceRef,
      name: name.trim(),
      description: description || '',
      targetDate: toDate(targetDate),
      order: order ?? 0,
      status: status || 'planned',
      createdBy: req.user._id,
    });

    res.status(201).json(milestone);
    Activity.create({
      userId: req.user._id,
      action: 'milestone.created',
      workspaceRef: req.project.workspaceRef,
      details: { milestoneName: milestone.name, projectName: req.project.name, milestoneId: milestone._id },
    }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/milestones/:id ──────────────────────────────────────────────────
router.patch('/:id', validate(milestonePatchSchema, { params: milestoneParamsSchema }), loadMilestone, scopeToWorkspace((req) => req.milestone.workspaceRef), requireWorkspaceEditor, async (req, res, next) => {
  try {
    const patch = {};
    const { name, description, targetDate, order, status } = req.body;
    if (name !== undefined) patch.name = name.trim();
    if (description !== undefined) patch.description = description;
    if (targetDate !== undefined) patch.targetDate = toDate(targetDate);
    if (order !== undefined) patch.order = order;
    if (status !== undefined) patch.status = status;

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ message: 'No updatable fields provided' });
    }

    const milestone = await Milestone.findByIdAndUpdate(req.params.id, { $set: patch }, { new: true, runValidators: true });
    res.json(milestone);
    Activity.create({
      userId: req.user._id,
      action: 'milestone.updated',
      workspaceRef: req.milestone.workspaceRef,
      details: { milestoneName: milestone.name, milestoneId: milestone._id },
    }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/milestones/:id ─────────────────────────────────────────────────
router.delete('/:id', validate(null, { params: milestoneParamsSchema }), loadMilestone, scopeToWorkspace((req) => req.milestone.workspaceRef), requireWorkspaceOwnerAdmin, async (req, res, next) => {
  try {
    const milestone = req.milestone;
    await Milestone.findByIdAndDelete(milestone._id);
    // DDS §6.3: orphan protection — Phases stay, detached from the milestone.
    await Phase.updateMany({ milestoneRef: milestone._id }, { $set: { milestoneRef: null } });
    res.json({ message: 'Milestone deleted' });
    Activity.create({
      userId: req.user._id,
      action: 'milestone.deleted',
      workspaceRef: milestone.workspaceRef,
      details: { milestoneName: milestone.name, milestoneId: milestone._id },
    }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

module.exports = router;
