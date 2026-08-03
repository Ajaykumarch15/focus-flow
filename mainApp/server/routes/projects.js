const express = require('express');
const Project = require('../models/Project');
const protect = require('../middleware/auth');
const { getAuthorizedClient, createProjectFolders, setDriveError, clearDriveError } = require('../utils/googleDrive');
const { logger } = require('../utils/logger');
const { z, objectId, requiredString, validate } = require('../utils/validation');

const router = express.Router();
router.use(protect);

// IES-P0-16: body/param schemas.
const projectCreateSchema = z.object({
  name: requiredString(100, 'name', 'Project name is required'),
});
const projectParamsSchema = z.object({ id: objectId });

// ── GET /api/projects ──────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const projects = await Project.find({ userId: req.user._id }).sort({ name: 1 });
    res.json(projects);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/projects ─────────────────────────────────────────────────────────
router.post('/', validate(projectCreateSchema), async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Project name is required' });
    }

    const trimmedName = name.trim();

    // IES-P1-12: exact-match pre-check on the lowercased `nameKey` (never a
    // `$regex` over user input). The DB unique index `{ userId, nameKey }` is
    // the authoritative guard — the E11000 catch below keeps the same friendly
    // 400 for the race where two creates slip past this check simultaneously.
    const existing = await Project.findOne({ userId: req.user._id, nameKey: trimmedName.toLowerCase() });
    if (existing) {
      return res.status(400).json({ message: 'A project with this name already exists' });
    }

    let folderIds = {};

    // If Google Drive is connected, create folders automatically
    if (req.user.googleConnected && req.user.googleTokens && req.user.googleTokens.refreshToken) {
      try {
        const oauth2Client = await getAuthorizedClient(req.user);
        folderIds = await createProjectFolders(oauth2Client, trimmedName);
        await clearDriveError(req.user); // IES-P1-24: Drive worked — reset the flag.
      } catch (driveErr) {
        logger.warn('Google Drive folder creation failed during project setup');
        // IES-P1-24: surface the failure so the client can prompt a reconnect.
        await setDriveError(req.user, 'Drive folder creation failed. Please reconnect in settings.');
      }
    }

    let project;
    try {
      project = await Project.create({
        userId: req.user._id,
        name: trimmedName,
        ...folderIds,
      });
    } catch (err) {
      if (err && err.code === 11000) {
        return res.status(400).json({ message: 'A project with this name already exists' });
      }
      throw err;
    }

    logger.debug('project created');
    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/projects/:id/sync-drive ──────────────────────────────────────────
// Manual trigger to create folders if Google Drive was connected AFTER project creation
router.post('/:id/sync-drive', validate(null, { params: projectParamsSchema }), async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, userId: req.user._id });
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (!req.user.googleConnected) {
      return res.status(400).json({ message: 'Google Drive is not connected' });
    }

    if (project.googleFolderId) {
      return res.json({ message: 'Project folders already created in Google Drive', project });
    }

    const oauth2Client = await getAuthorizedClient(req.user);
    const folderIds = await createProjectFolders(oauth2Client, project.name);

    project.googleFolderId = folderIds.googleFolderId;
    project.workLogsFolderId = folderIds.workLogsFolderId;
    project.designDocsFolderId = folderIds.designDocsFolderId;
    project.meetingNotesFolderId = folderIds.meetingNotesFolderId;
    project.reportsFolderId = folderIds.reportsFolderId;

    await project.save();
    await clearDriveError(req.user); // IES-P1-24: sync succeeded — reset the flag.

    logger.debug('project drive folders synced');
    res.json(project);
  } catch (err) {
    // IES-P1-24: sync-drive failures reach the client as a 500 AND set the flag.
    await setDriveError(req.user, 'Drive sync failed. Please reconnect in settings.').catch(() => {});
    next(err);
  }
});

module.exports = router;
