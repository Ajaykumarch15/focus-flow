// IES-R1: feature/work-item CRUD routes incl. the Project Backlog
// (docs/migration-recommendation-1.md §5, §9.1/§9.2).
//
// Backlog = query (`{ projectRef, sprintRef: null }`), not a collection.
// `sprintRef` changes (drag into/out of a Sprint) revalidate the feature↔sprint
// same-project invariant; `workspaceRef` is always derived from the owning
// Project, never the client body.
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
const { z, objectId, requiredString, validate } = require('../utils/validation');

const router = express.Router();
router.use(protect);

// IES-P0-16: body/param/query schemas.
const FEATURE_TYPE = ['feature', 'bug', 'spike', 'chore', 'research', 'debt', 'improvement'];
const FEATURE_STATUS = ['backlog', 'ready', 'in_progress', 'review', 'done'];

// §9.1: a feature is in the Backlog when sprintRef is null — an explicit null
// (move out of sprint) and an absent value are both accepted.
const nullableRef = z.union([objectId, z.null()]).optional();

const featureCreateSchema = z.object({
  projectId: objectId,
  sprintId: nullableRef,
  name: requiredString(150, 'name', 'Feature name is required'),
  description: z.string().max(5000, 'Description too long').default(''),
  type: z.enum(FEATURE_TYPE).default('feature'),
  labels: z.array(z.string().trim().max(50, 'Label too long')).max(50, 'Too many labels').default([]),
  ownerId: objectId.optional(),
  estimatedHours: z.number().finite('Invalid estimatedHours').min(0, 'estimatedHours must be at least 0').default(0),
  status: z.enum(FEATURE_STATUS).default('backlog'),
  order: z.number().finite('Invalid order').default(0),
}).passthrough();

const featurePatchSchema = z.object({
  name: requiredString(150, 'name', 'Feature name is required').optional(),
  description: z.string().max(5000, 'Description too long').optional(),
  type: z.enum(FEATURE_TYPE).optional(),
  labels: z.array(z.string().trim().max(50, 'Label too long')).max(50, 'Too many labels').optional(),
  ownerId: objectId.optional(),
  estimatedHours: z.number().finite('Invalid estimatedHours').min(0, 'estimatedHours must be at least 0').optional(),
  status: z.enum(FEATURE_STATUS).optional(),
  order: z.number().finite('Invalid order').optional(),
  sprintId: nullableRef,
}).passthrough();

const featureParamsSchema = z.object({ id: objectId });

// §9.1 backlog=true ⇒ sprintRef: null; otherwise optional sprintId filter.
const featureQuerySchema = z.object({
  projectId: objectId,
  sprintId: objectId.optional(),
  backlog: z.enum(['true', 'false']).optional(),
  type: z.enum(FEATURE_TYPE).optional(),
  status: z.enum(FEATURE_STATUS).optional(),
}).passthrough();

async function loadFeature(req, res, next) {
  try {
    const feature = await Feature.findById(req.params.id);
    if (!feature) return res.status(404).json({ message: 'Feature not found' });
    req.feature = feature;
    next();
  } catch (err) {
    next(err);
  }
}

// IES-R1: Feature↔Sprint must share the same projectRef (no cross-project
// sprints). Returns null when the sprint is valid for `projectRef`.
async function validateSprintForProject(sprintId, projectRef) {
  const sprint = await Sprint.findById(sprintId);
  if (!sprint) return { status: 404, message: 'Sprint not found' };
  if (String(sprint.projectRef) !== String(projectRef)) {
    return { status: 400, message: 'Sprint does not belong to this project' };
  }
  return null;
}

// ── GET /api/features?projectId=&backlog=&sprintId=&type=&status= ────────────
router.get('/', validate(null, { query: featureQuerySchema }), resolveProjectWorkspace, requireWorkspaceMember, async (req, res, next) => {
  try {
    const { sprintId, backlog, type, status } = req.query;
    const filter = { projectRef: req.project._id };
    if (backlog === 'true') {
      filter.sprintRef = null;
    } else if (sprintId) {
      const err = await validateSprintForProject(sprintId, req.project._id);
      if (err) return res.status(err.status).json({ message: err.message });
      filter.sprintRef = sprintId;
    }
    if (type) filter.type = type;
    if (status) filter.status = status;
    const features = await Feature.find(filter).sort({ order: 1, createdAt: 1 });
    res.json(features);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/features ─────────────────────────────────────────────────────────
router.post('/', validate(featureCreateSchema), resolveProjectWorkspace, requireWorkspaceEditor, async (req, res, next) => {
  try {
    const { name, description, type, labels, ownerId, estimatedHours, status, order, sprintId } = req.body;
    let sprintRef = sprintId ?? null;
    if (sprintId) {
      const err = await validateSprintForProject(sprintId, req.project._id);
      if (err) return res.status(err.status).json({ message: err.message });
    }

    const feature = await Feature.create({
      projectRef: req.project._id,
      sprintRef,
      workspaceRef: req.project.workspaceRef,
      name: name.trim(),
      description: description || '',
      type: type || 'feature',
      labels: labels || [],
      ownerId: ownerId ?? null,
      estimatedHours: estimatedHours || 0,
      status: status || 'backlog',
      order: order || 0,
      createdBy: req.user._id,
    });

    res.status(201).json(feature);
    Activity.create({
      userId: req.user._id,
      action: 'feature.created',
      workspaceRef: req.project.workspaceRef,
      details: { featureName: feature.name, projectName: req.project.name, featureId: feature._id },
    }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/features/:id ────────────────────────────────────────────────────
router.patch('/:id', validate(featurePatchSchema, { params: featureParamsSchema }), loadFeature, scopeToWorkspace((req) => req.feature.workspaceRef), requireWorkspaceEditor, async (req, res, next) => {
  try {
    const patch = {};
    const { name, description, type, labels, ownerId, estimatedHours, status, order, sprintId } = req.body;
    if (name !== undefined) patch.name = name.trim();
    if (description !== undefined) patch.description = description;
    if (type !== undefined) patch.type = type;
    if (labels !== undefined) patch.labels = labels;
    if (ownerId !== undefined) patch.ownerId = ownerId;
    if (estimatedHours !== undefined) patch.estimatedHours = estimatedHours;
    if (status !== undefined) patch.status = status;
    if (order !== undefined) patch.order = order;
    if (sprintId !== undefined) {
      // §9.1 drag-and-drop into/out of a Sprint — revalidates same-project.
      const ref = sprintId ?? null;
      if (ref) {
        const err = await validateSprintForProject(ref, req.feature.projectRef);
        if (err) return res.status(err.status).json({ message: err.message });
      }
      patch.sprintRef = ref;
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ message: 'No updatable fields provided' });
    }

    const feature = await Feature.findByIdAndUpdate(req.params.id, { $set: patch }, { new: true, runValidators: true });
    res.json(feature);
    Activity.create({
      userId: req.user._id,
      action: 'feature.updated',
      workspaceRef: req.feature.workspaceRef,
      details: { featureName: feature.name, featureId: feature._id },
    }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/features/:id ───────────────────────────────────────────────────
router.delete('/:id', validate(null, { params: featureParamsSchema }), loadFeature, scopeToWorkspace((req) => req.feature.workspaceRef), requireWorkspaceOwnerAdmin, async (req, res, next) => {
  try {
    const feature = req.feature;
    await Feature.findByIdAndDelete(feature._id);
    // IES-R1: no cascade delete — tasks return to an unlinked state.
    await Task.updateMany({ featureRef: feature._id }, { $set: { featureRef: null } });
    res.json({ message: 'Feature deleted' });
    Activity.create({
      userId: req.user._id,
      action: 'feature.deleted',
      workspaceRef: feature.workspaceRef,
      details: { featureName: feature.name, featureId: feature._id },
    }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

module.exports = router;
