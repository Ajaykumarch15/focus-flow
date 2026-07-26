const express = require('express');
const WorkLog = require('../models/WorkLog');
const Session = require('../models/Session');
const Task    = require('../models/Task');
const Activity = require('../models/Activity');
const protect = require('../middleware/auth');

const router = express.Router();
router.use(protect);

// ── Helpers ───────────────────────────────────────────────────────────────────
function sumMs(entries) {
  return (entries || []).reduce((a, e) => a + (e.activeMs || 0), 0);
}

function userTimezone(req) {
  return req.user?.settings?.timezone || 'UTC';
}

function triggerGoogleDocSync(req, log) {
  if (req.user && req.user.googleConnected && req.user.googleTokens && req.user.googleTokens.refreshToken && log.googleDocId) {
    const { getAuthorizedClient, updateWorkLogDoc } = require('../utils/googleDrive');
    getAuthorizedClient(req.user).then(async (oauth2Client) => {
      await updateWorkLogDoc(
        oauth2Client,
        log.googleDocId,
        log.title,
        log.projectRef ? log.projectRef.name : 'No Project',
        {
          problem: log.problem,
          plan: log.plan,
          designNotes: log.designNotes,
          currentWork: log.currentWork,
          blockers: log.blockers,
          completedItems: log.completedItems,
          links: log.links
        }
      );
    }).catch(driveErr => {
      console.error('⚠️ Failed to sync updated WorkLog to Google Docs:', driveErr.message);
    });
  }
}

function dayKey(ts, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ts));
}

function getOffsetMs(date, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
    const asUtc = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour === '24' ? '0' : values.hour),
      Number(values.minute),
      Number(values.second)
    );
    return asUtc - date.getTime();
  } catch {
    return 0;
  }
}

function localDateToUtc(dateKey, timeZone) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  return new Date(utcGuess.getTime() - getOffsetMs(utcGuess, timeZone));
}

// Compute effective active ms for a session (works for both active and stopped)
function sessionActiveMs(session) {
  if (!session.isActive) return session.activeTime || 0;
  // Running session — compute live
  const now = Date.now();
  const lastPause = session.pauseLog?.length
    ? session.pauseLog[session.pauseLog.length - 1]
    : null;
  const isPaused = lastPause && !lastPause.resumeTime;
  if (isPaused) {
    return Math.max(0, lastPause.pauseStart - session.startTime - session.totalPauseDuration);
  }
  return Math.max(0, now - session.startTime - session.totalPauseDuration);
}

// Pull all session data for a task and upsert one workEntry per day.
async function syncWorkEntries(log, userId, timeZone = 'UTC') {
  const taskId = log.taskRef?._id || log.taskRef;
  if (!taskId) return log;

  const sessions = await Session.find({
    userId,
    taskId,
  });

  if (sessions.length === 0) return log;

  const grouped = new Map();
  for (const session of sessions) {
    const key = dayKey(session.startTime, timeZone);
    const activeMs = sessionActiveMs(session);
    if (activeMs <= 0) continue;
    const existing = grouped.get(key) || {
      date: localDateToUtc(key, timeZone),
      activeMs: 0,
      startedAt: session.startTime,
      endedAt: session.endTime || session.startTime,
      sessionIds: [],
    };
    existing.activeMs += activeMs;
    existing.startedAt = Math.min(existing.startedAt, session.startTime);
    existing.endedAt = Math.max(existing.endedAt, session.endTime || Date.now());
    existing.sessionIds.push(session._id);
    grouped.set(key, existing);
  }

  for (const [key, aggregate] of grouped.entries()) {
    const existingIdx = log.workEntries.findIndex(e =>
      dayKey(e.date.getTime(), timeZone) === key || e.date.toISOString().slice(0, 10) === key
    );
    if (existingIdx >= 0) {
      log.workEntries[existingIdx].date = aggregate.date;
      log.workEntries[existingIdx].activeMs = aggregate.activeMs;
      log.workEntries[existingIdx].startedAt = aggregate.startedAt;
      log.workEntries[existingIdx].endedAt = aggregate.endedAt;
      log.workEntries[existingIdx].sessionIds = aggregate.sessionIds;
    } else {
      log.workEntries.push({ ...aggregate, what: '' });
    }
  }

  log.totalActiveMs = sumMs(log.workEntries);
  await log.save();
  return log;
}

// ── GET /api/worklogs ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const filter = { userId: req.user._id };
    if (req.query.active === 'true')  filter.isActive = true;
    if (req.query.active === 'false') filter.isActive = false;

    let logs = await WorkLog.find(filter)
      .populate('taskRef', 'title color category totalTime')
      .populate('projectRef', 'name googleFolderId workLogsFolderId')
      .sort({ isActive: -1, updatedAt: -1 });

    const timeZone = userTimezone(req);
    logs = await Promise.all(logs.map(log => syncWorkEntries(log, req.user._id, timeZone)));

    res.json(logs);
  } catch (err) {
    console.error('GET /worklogs error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/worklogs/:id ─────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    let log = await WorkLog.findOne({ _id: req.params.id, userId: req.user._id })
      .populate('taskRef', 'title color category totalTime')
      .populate('projectRef', 'name googleFolderId workLogsFolderId');

    if (!log) return res.status(404).json({ message: 'Not found' });

    // Auto-sync today's time from linked task sessions
    log = await syncWorkEntries(log, req.user._id, userTimezone(req));
    res.json(log);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/worklogs ────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      title, problem, gitBranch, currentWork, plan,
      designNotes, blockers, status, mood, tags, taskRef, projectId
    } = req.body;

    const Project = require('../models/Project');
    let projectRef = undefined;
    let googleDocId = '';
    let googleDocUrl = '';

    // Auto-create folders if Google Drive is connected
    if (req.user.googleConnected && req.user.googleTokens && req.user.googleTokens.refreshToken) {
      try {
        const { getAuthorizedClient, createProjectFolders, createWorkLogDoc } = require('../utils/googleDrive');
        const oauth2Client = await getAuthorizedClient(req.user);
        let targetFolderId = null;
        let pName = 'General';

        if (projectId) {
          const project = await Project.findOne({ _id: projectId, userId: req.user._id });
          if (project) {
            projectRef = project._id;
            pName = project.name;
            if (!project.workLogsFolderId) {
              console.log(`📁 Project folders missing in Drive for "${project.name}", creating them...`);
              const folderIds = await createProjectFolders(oauth2Client, project.name);
              project.googleFolderId = folderIds.googleFolderId;
              project.workLogsFolderId = folderIds.workLogsFolderId;
              project.designDocsFolderId = folderIds.designDocsFolderId;
              project.meetingNotesFolderId = folderIds.meetingNotesFolderId;
              project.reportsFolderId = folderIds.reportsFolderId;
              await project.save();
            }
            targetFolderId = project.workLogsFolderId;
          }
        }

        if (!targetFolderId) {
          // Fallback: use or create a default "FocusFlow WorkLogs" folder
          const { google } = require('googleapis');
          const drive = google.drive({ version: 'v3', auth: oauth2Client });
          console.log('📁 No project specified. Looking for default "FocusFlow WorkLogs" folder...');
          
          const searchRes = await drive.files.list({
            q: "name = 'FocusFlow WorkLogs' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
            fields: 'files(id)',
            spaces: 'drive',
          });

          if (searchRes.data.files && searchRes.data.files.length > 0) {
            targetFolderId = searchRes.data.files[0].id;
            console.log(`✅ Found existing default folder: ${targetFolderId}`);
          } else {
            console.log('📁 Default folder not found, creating one...');
            const defaultFolderMetadata = {
              name: 'FocusFlow WorkLogs',
              mimeType: 'application/vnd.google-apps.folder',
            };
            const defaultFolderRes = await drive.files.create({
              requestBody: defaultFolderMetadata,
              fields: 'id',
            });
            targetFolderId = defaultFolderRes.data.id;
            console.log(`✅ Created default folder: ${targetFolderId}`);
          }
        }

        if (targetFolderId) {
          const docRes = await createWorkLogDoc(
            oauth2Client,
            targetFolderId,
            title || 'Untitled Work Item',
            pName,
            { problem, plan, designNotes, currentWork, blockers }
          );
          googleDocId = docRes.googleDocId;
          googleDocUrl = docRes.googleDocUrl;
        }
      } catch (driveErr) {
        console.error('⚠️ Google Drive doc creation failed:', driveErr.message);
      }
    } else if (projectId) {
      // If Drive is not connected but project is passed, we still link the project in DB
      const project = await Project.findOne({ _id: projectId, userId: req.user._id });
      if (project) {
        projectRef = project._id;
      }
    }

    const log = await WorkLog.create({
      userId:      req.user._id,
      title:       title     || 'Untitled Work Item',
      problem, gitBranch, currentWork, plan, designNotes, blockers,
      status:      status    || 'in-progress',
      isActive:    true,
      mood:        mood      || 3,
      tags:        tags      || [],
      taskRef:     taskRef   || undefined,
      projectRef,
      googleDocId,
      googleDocUrl,
      workEntries: [],
      totalActiveMs: 0,
    });

    // Seed today's entry immediately if task linked
    let populated = await log.populate([
      { path: 'taskRef', select: 'title color category totalTime' },
      { path: 'projectRef', select: 'name googleFolderId workLogsFolderId' }
    ]);
    populated = await syncWorkEntries(populated, req.user._id, userTimezone(req));

    console.log(`✅ WorkLog created: "${log.title}" linked to project: ${projectId || 'none'}, task: ${taskRef || 'none'}`);
    res.status(201).json(populated);
    Activity.create({ userId: req.user._id, action: 'worklog.created', details: { worklogTitle: log.title } }).catch(() => {});
  } catch (err) {
    console.error('POST /worklogs error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/worklogs/:id ───────────────────────────────────────────────────
router.patch('/:id', async (req, res) => {
  try {
    let log = await WorkLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: req.body },
      { new: true, runValidators: true }
    ).populate('taskRef', 'title color category totalTime')
     .populate('projectRef', 'name googleFolderId workLogsFolderId');

    if (!log) return res.status(404).json({ message: 'Not found' });
    triggerGoogleDocSync(req, log);
    res.json(log);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/worklogs/:id/sync-time ─────────────────────────────────────────
router.post('/:id/sync-time', async (req, res) => {
  try {
    let log = await WorkLog.findOne({ _id: req.params.id, userId: req.user._id });
    if (!log) return res.status(404).json({ message: 'Not found' });

    log = await syncWorkEntries(log, req.user._id, userTimezone(req));
    await log.populate([
      { path: 'taskRef', select: 'title color category totalTime' },
      { path: 'projectRef', select: 'name googleFolderId workLogsFolderId' }
    ]);
    res.json(log);
  } catch (err) {
    console.error('sync-time error:', err);
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/worklogs/:id/task - link, change, or unlink the backing task
router.patch('/:id/task', async (req, res) => {
  try {
    const { taskRef } = req.body;
    if (taskRef) {
      const task = await Task.findOne({ _id: taskRef, userId: req.user._id });
      if (!task) return res.status(404).json({ message: 'Task not found' });
    }

    let log = await WorkLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      taskRef ? { $set: { taskRef } } : { $unset: { taskRef: '' }, $set: { totalActiveMs: 0, workEntries: [] } },
      { new: true }
    ).populate('taskRef', 'title color category totalTime')
     .populate('projectRef', 'name googleFolderId workLogsFolderId');

    if (!log) return res.status(404).json({ message: 'Not found' });
    log = await syncWorkEntries(log, req.user._id, userTimezone(req));
    await log.populate([
      { path: 'taskRef', select: 'title color category totalTime' },
      { path: 'projectRef', select: 'name googleFolderId workLogsFolderId' }
    ]);
    res.json(log);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PATCH /api/worklogs/:id/entries/:entryId ─────────────────────────────────
router.patch('/:id/entries/:entryId', async (req, res) => {
  try {
    const log = await WorkLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id, 'workEntries._id': req.params.entryId },
      { $set: { 'workEntries.$.what': req.body.what } },
      { new: true }
    ).populate('taskRef', 'title color category totalTime')
     .populate('projectRef', 'name googleFolderId workLogsFolderId');

    if (!log) return res.status(404).json({ message: 'Not found' });
    res.json(log);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/worklogs/:id/close ─────────────────────────────────────────────
router.post('/:id/close', async (req, res) => {
  try {
    const log = await WorkLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: { status: 'done', isActive: false, closedAt: new Date() } },
      { new: true }
    ).populate('taskRef', 'title color category totalTime')
     .populate('projectRef', 'name googleFolderId workLogsFolderId');
    if (!log) return res.status(404).json({ message: 'Not found' });
    res.json(log);
    Activity.create({ userId: req.user._id, action: 'worklog.closed', details: { worklogTitle: log.title } }).catch(() => {});
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/worklogs/:id/continue ──────────────────────────────────────────
router.post('/:id/continue', async (req, res) => {
  try {
    const log = await WorkLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: { status: 'in-progress', isActive: true, closedAt: null, reopenedAt: new Date() } },
      { new: true }
    ).populate('taskRef', 'title color category totalTime')
     .populate('projectRef', 'name googleFolderId workLogsFolderId');
    if (!log) return res.status(404).json({ message: 'Not found' });
    res.json(log);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/worklogs/:id/completed ─────────────────────────────────────────
router.post('/:id/completed', async (req, res) => {
  try {
    const log = await WorkLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $push: { completedItems: { text: req.body.text, done: true } } },
      { new: true }
    ).populate('taskRef', 'title color category totalTime')
     .populate('projectRef', 'name googleFolderId workLogsFolderId');
    if (!log) return res.status(404).json({ message: 'Not found' });
    triggerGoogleDocSync(req, log);
    res.json(log);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── DELETE /api/worklogs/:id/completed/:itemId ────────────────────────────────
router.delete('/:id/completed/:itemId', async (req, res) => {
  try {
    const log = await WorkLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $pull: { completedItems: { _id: req.params.itemId } } },
      { new: true }
    ).populate('taskRef', 'title color category totalTime')
     .populate('projectRef', 'name googleFolderId workLogsFolderId');
    if (!log) return res.status(404).json({ message: 'Not found' });
    triggerGoogleDocSync(req, log);
    res.json(log);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/worklogs/:id/links ──────────────────────────────────────────────
router.post('/:id/links', async (req, res) => {
  try {
    const log = await WorkLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $push: { links: { label: req.body.label, url: req.body.url } } },
      { new: true }
    ).populate('taskRef', 'title color category totalTime')
     .populate('projectRef', 'name googleFolderId workLogsFolderId');
    if (!log) return res.status(404).json({ message: 'Not found' });
    triggerGoogleDocSync(req, log);
    res.json(log);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── DELETE /api/worklogs/:id/links/:linkId ────────────────────────────────────
router.delete('/:id/links/:linkId', async (req, res) => {
  try {
    const log = await WorkLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $pull: { links: { _id: req.params.linkId } } },
      { new: true }
    ).populate('taskRef', 'title color category totalTime')
     .populate('projectRef', 'name googleFolderId workLogsFolderId');
    if (!log) return res.status(404).json({ message: 'Not found' });
    triggerGoogleDocSync(req, log);
    res.json(log);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── DELETE /api/worklogs/:id ──────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const log = await WorkLog.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!log) return res.status(404).json({ message: 'Not found' });
    res.json(log);
    Activity.create({ userId: req.user._id, action: 'worklog.closed', details: { worklogTitle: log.title } }).catch(() => {});
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
