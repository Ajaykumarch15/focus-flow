const express = require('express');
const Project = require('../models/Project');
const protect = require('../middleware/auth');
const { getAuthorizedClient, createProjectFolders } = require('../utils/googleDrive');

const router = express.Router();
router.use(protect);

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
router.post('/', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Project name is required' });
    }

    const trimmedName = name.trim();

    // Check if project already exists for this user
    const existing = await Project.findOne({ userId: req.user._id, name: { $regex: new RegExp(`^${trimmedName}$`, 'i') } });
    if (existing) {
      return res.status(400).json({ message: 'A project with this name already exists' });
    }

    let folderIds = {};

    // If Google Drive is connected, create folders automatically
    if (req.user.googleConnected && req.user.googleTokens && req.user.googleTokens.refreshToken) {
      try {
        const oauth2Client = await getAuthorizedClient(req.user);
        folderIds = await createProjectFolders(oauth2Client, trimmedName);
      } catch (driveErr) {
        console.error('⚠️ Google Drive folder creation failed during project setup:', driveErr.message);
        // Continue creating project in DB even if Drive fails, so user experience isn't blocked completely
      }
    }

    const project = await Project.create({
      userId: req.user._id,
      name: trimmedName,
      ...folderIds,
    });

    console.log(`✅ Project created: "${project.name}" (Google Folder: ${project.googleFolderId || 'not connected'})`);
    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/projects/:id/sync-drive ──────────────────────────────────────────
// Manual trigger to create folders if Google Drive was connected AFTER project creation
router.post('/:id/sync-drive', async (req, res, next) => {
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

    console.log(`✅ Manually synced Drive folders for project "${project.name}"`);
    res.json(project);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
