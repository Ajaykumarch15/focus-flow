// EEP2-P3.2.3 / DDS §4.7, §6.2-6.3, §7: Module CRUD — a capability area inside
// a Phase. Gates: read = member, create/update = editor, delete = Owner/Admin.
// The parent `phaseRef` is validated to share the same projectRef (re-parenting
// included), and `ownerId` must be a workspace member (route-level check, DDS
// §4.7). Delete nulls `feature.moduleRef` on child Features and writes
// `module.deleted` Activity.
const express = require('express');
const Phase = require('../models/Phase');
const Module = require('../models/Module');
const Feature = require('../models/Feature');
const Activity = require('../models/Activity');
const protect = require('../middleware/auth');
const {
  findMember,
  resolveProjectWorkspace,
  requireWorkspaceMember,
  requireWorkspaceEditor,
  requireWorkspaceOwnerAdmin,
  scopeToWorkspace,
} = require('../middleware/workspace');
const { z, objectId, requiredString, validate } = require('../utils/validation');

const router = express.Router();
router.use(protect);

const MODULE_STATUS = ['planned', 'active', 'completed'];

const moduleCreateSchema = z.object({
  projectId: objectId,
  phaseId: objectId,
  name: requiredString(150, 'name', 'Module name is required'),
  description: z.string().max(5000, 'Description too long').default(''),
  status: z.enum(MODULE_STATUS).default('planned'),
  order: z.number().finite('Invalid order').default(0),
  ownerId: objectId.optional(),
}).passthrough();

const modulePatchSchema = z.object({
  name: requiredString(150, 'name', 'Module name is required').optional(),
  description: z.string().max(5000, 'Description too long').optional(),
  status: z.enum(MODULE_STATUS).optional(),
  order: z.number().finite('Invalid order').optional(),
  phaseId: objectId.optional(),
  ownerId: objectId.optional(),
}).passthrough();

const moduleParamsSchema = z.object({ id: objectId });

const moduleQuerySchema = z.object({ projectId: objectId, phaseId: objectId.optional() }).passthrough();

// DDS §6.2: a Module's parent Phase must belong to the same project as the
// Module being created/updated (no cross-project parents).
async function validatePhaseForProject(phaseId, projectRef) {
  const phase = await Phase.findById(phaseId);
  if (!phase) return { status: 404, message: 'Phase not found' };
  if (String(phase.projectRef) !== String(projectRef)) {
    return { status: 400, message: 'Phase does not belong to this project' };
  }
  return null;
}

// DDS §4.7: ownerId must be a workspace member. Runs after the workspace is
// loaded (req.workspace carries members).
function validateOwnerIsMember(workspace, ownerId) {
  if (ownerId == null) return null;
  if (!findMember(workspace, ownerId)) {
    return { status: 400, message: 'ownerId must be a workspace member' };
  }
  return null;
}

async function loadModule(req, res, next) {
  try {
    const mod = await Module.findById(req.params.id);
    if (!mod) return res.status(404).json({ message: 'Module not found' });
    req.module = mod;
    next();
  } catch (err) {
    next(err);
  }
}

// ── GET /api/modules?projectId=&phaseId= ───────────────────────────────────────
router.get('/', validate(null, { query: moduleQuerySchema }), resolveProjectWorkspace, requireWorkspaceMember, async (req, res, next) => {
  try {
    const filter = { projectRef: req.project._id };
    if (req.query.phaseId) filter.phaseRef = req.query.phaseId;
    const modules = await Module.find(filter).sort({ order: 1, createdAt: 1 });
    res.json(modules);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/modules ──────────────────────────────────────────────────────────
router.post('/', validate(moduleCreateSchema), resolveProjectWorkspace, requireWorkspaceEditor, async (req, res, next) => {
  try {
    const { phaseId, name, description, status, order, ownerId } = req.body;
    const parentErr = await validatePhaseForProject(phaseId, req.project._id);
    if (parentErr) return res.status(parentErr.status).json({ message: parentErr.message });
    const ownerErr = validateOwnerIsMember(req.workspace, ownerId);
    if (ownerErr) return res.status(ownerErr.status).json({ message: ownerErr.message });

    const mod = await Module.create({
      phaseRef: phaseId,
      projectRef: req.project._id,
      workspaceRef: req.project.workspaceRef,
      name: name.trim(),
      description: description || '',
      status: status || 'planned',
      order: order ?? 0,
      ownerId: ownerId ?? null,
      createdBy: req.user._id,
    });

    res.status(201).json(mod);
    Activity.create({
      userId: req.user._id,
      action: 'module.created',
      workspaceRef: req.project.workspaceRef,
      details: { moduleName: mod.name, projectName: req.project.name, moduleId: mod._id },
    }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/modules/:id ─────────────────────────────────────────────────────
router.patch('/:id', validate(modulePatchSchema, { params: moduleParamsSchema }), loadModule, scopeToWorkspace((req) => req.module.workspaceRef), requireWorkspaceEditor, async (req, res, next) => {
  try {
    const patch = {};
    const { name, description, status, order, phaseId, ownerId } = req.body;
    if (name !== undefined) patch.name = name.trim();
    if (description !== undefined) patch.description = description;
    if (status !== undefined) patch.status = status;
    if (order !== undefined) patch.order = order;
    if (phaseId !== undefined) {
      const err = await validatePhaseForProject(phaseId, req.module.projectRef);
      if (err) return res.status(err.status).json({ message: err.message });
      patch.phaseRef = phaseId;
    }
    if (ownerId !== undefined) {
      const err = validateOwnerIsMember(req.workspace, ownerId);
      if (err) return res.status(err.status).json({ message: err.message });
      patch.ownerId = ownerId;
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ message: 'No updatable fields provided' });
    }

    const mod = await Module.findByIdAndUpdate(req.params.id, { $set: patch }, { new: true, runValidators: true });
    res.json(mod);
    Activity.create({
      userId: req.user._id,
      action: 'module.updated',
      workspaceRef: req.module.workspaceRef,
      details: { moduleName: mod.name, moduleId: mod._id },
    }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/modules/:id ────────────────────────────────────────────────────
router.delete('/:id', validate(null, { params: moduleParamsSchema }), loadModule, scopeToWorkspace((req) => req.module.workspaceRef), requireWorkspaceOwnerAdmin, async (req, res, next) => {
  try {
    const mod = req.module;
    await Module.findByIdAndDelete(mod._id);
    // DDS §6.3: orphan protection — Features become project-level (moduleRef null).
    await Feature.updateMany({ moduleRef: mod._id }, { $set: { moduleRef: null } });
    res.json({ message: 'Module deleted' });
    Activity.create({
      userId: req.user._id,
      action: 'module.deleted',
      workspaceRef: mod.workspaceRef,
      details: { moduleName: mod.name, moduleId: mod._id },
    }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

module.exports = router;
