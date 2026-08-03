const express = require('express');
const WorkLog = require('../models/WorkLog');
const Task    = require('../models/Task');
const Activity = require('../models/Activity');
const protect = require('../middleware/auth');
const { buildPatch } = require('../utils/patchSanitizer');
const { logger } = require('../utils/logger');
const { syncWorkLog, syncWorkLogsBulk } = require('../utils/worklogSync');
const { ARRAY_CAPS } = require('../utils/worklogLimits');
const { z, objectId, timestamp, intInRange, validate } = require('../utils/validation');

const router = express.Router();
router.use(protect);

// IES-P0-16: body/param schemas — size caps keep documents well under the
// Mongo 16 MB limit, enums match the model, numbers are NaN-safe.
const WORKLOG_STATUS = ['planning', 'in-progress', 'reviewing', 'blocked', 'done'];
const TIMELINE_TYPES = ['timer_start', 'timer_pause', 'timer_resume', 'timer_stop', 'note', 'snapshot', 'completed_item', 'decision', 'blocker'];
const BLOCKER_SEVERITY = ['low', 'medium', 'high', 'critical'];
const BLOCKER_STATUS = ['open', 'investigating', 'blocked', 'resolved'];
const SNAPSHOT_PERIODS = ['Morning', 'Afternoon', 'Evening', 'Custom'];
const COMPLETED_CATEGORIES = ['feature', 'bug', 'refactor', 'research', 'documentation', 'general'];
const LINK_CATEGORIES = ['Figma', 'GitHub', 'Jira', 'Linear', 'Documentation', 'API', 'Database', 'PR', 'Meeting Notes', 'General'];

const text = (max, label) => z.string().trim().max(max, `${label} too long (max ${max})`);
const requiredText = (max, label) =>
  z.string({ error: `${label} is required` }).trim().min(1, `${label} is required`).max(max, `${label} too long (max ${max})`);

const problemFlowSchema = z.object({
  problem: text(10000, 'problem').optional(),
  investigation: text(10000, 'investigation').optional(),
  rootCause: text(10000, 'rootCause').optional(),
  solution: text(10000, 'solution').optional(),
  lessonsLearned: text(10000, 'lessonsLearned').optional(),
}).passthrough();

const gitRefSchema = z.object({
  repository: text(200, 'repository').optional(),
  branch: text(200, 'branch').optional(),
  commitIds: z.array(z.string().max(200)).max(100, 'Too many commit ids').optional(),
  prNumber: text(20, 'prNumber').optional(),
  issueNumber: text(20, 'issueNumber').optional(),
}).passthrough();

const tomorrowPlanSchema = z.object({
  topPriority: text(2000, 'topPriority').optional(),
  unfinishedItems: z.array(z.string().max(200)).max(100, 'Too many items').optional(),
  attentionRequired: text(2000, 'attentionRequired').optional(),
}).passthrough();

const reflectionSchema = z.object({
  wentWell: text(5000, 'wentWell').optional(),
  slowedDown: text(5000, 'slowedDown').optional(),
  learned: text(5000, 'learned').optional(),
  improvement: text(5000, 'improvement').optional(),
  rating: intInRange(1, 5, 'rating').optional(),
}).passthrough();

const moodMetricsSchema = z.object({
  energy: intInRange(1, 5, 'energy').optional(),
  focus: intInRange(1, 5, 'focus').optional(),
  stress: intInRange(1, 5, 'stress').optional(),
  confidence: intInRange(1, 5, 'confidence').optional(),
  motivation: intInRange(1, 5, 'motivation').optional(),
}).passthrough();

const workLogBase = {
  title: text(200, 'title'),
  problem: text(10000, 'problem'),
  gitBranch: text(200, 'gitBranch'),
  currentWork: text(10000, 'currentWork'),
  plan: text(10000, 'plan'),
  designNotes: text(10000, 'designNotes'),
  blockers: text(10000, 'blockers'),
  status: z.enum(WORKLOG_STATUS),
  mood: intInRange(1, 5, 'mood'),
  tags: z.array(text(50, 'tag')).max(100, 'Too many tags'),
  problemFlow: problemFlowSchema,
  gitRef: gitRefSchema,
  tomorrowPlan: tomorrowPlanSchema,
  reflection: reflectionSchema,
  moodMetrics: moodMetricsSchema,
};

const workLogCreateSchema = z.object({ ...workLogBase, taskRef: objectId, projectId: objectId }).partial().passthrough();
const workLogPatchSchema = z.object(workLogBase).partial().passthrough();

const workLogParamsSchema = z.object({ id: objectId });
const itemParams = (key) => z.object({ id: objectId, [key]: objectId });

const timelineEntrySchema = z.object({
  title: requiredText(300, 'Title'),
  description: text(2000, 'description').optional(),
  type: z.enum(TIMELINE_TYPES).optional(),
  category: text(100, 'category').optional(),
  metadata: z.unknown().optional(),
  timestamp: timestamp.optional(),
});

const decisionSchema = z.object({
  title: requiredText(300, 'Title'),
  context: text(5000, 'context').optional(),
  decision: text(5000, 'decision').optional(),
  alternatives: text(5000, 'alternatives').optional(),
  rationale: text(5000, 'rationale').optional(),
});

const blockerCreateSchema = z.object({
  title: requiredText(300, 'Title'),
  severity: z.enum(BLOCKER_SEVERITY).optional(),
  notes: text(2000, 'notes').optional(),
});
const blockerPatchSchema = z.object({
  status: z.enum(BLOCKER_STATUS).optional(),
  notes: text(2000, 'notes').optional(),
});

const snapshotCreateSchema = z.object({
  period: z.enum(SNAPSHOT_PERIODS).optional(),
  text: requiredText(5000, 'text'),
});

const attachmentCreateSchema = z.object({
  name: requiredText(200, 'name'),
  type: text(50, 'type').optional(),
  url: requiredText(2000, 'url'),
  sizeBytes: z.coerce.number().finite('sizeBytes must be a number').min(0, 'sizeBytes must be at least 0').optional(),
  description: text(2000, 'description').optional(),
});

const completedItemCreateSchema = z.object({
  text: requiredText(300, 'text'),
  category: z.enum(COMPLETED_CATEGORIES).optional(),
});

const linkCreateSchema = z.object({
  label: requiredText(300, 'label'),
  url: requiredText(2000, 'url'),
  category: z.enum(LINK_CATEGORIES).optional(),
});

const workLogTaskPatchSchema = z.object({ taskRef: objectId.nullable() });

// Fields a client may update on a WorkLog via PATCH. Nested sub-document fields
// are matched on their dotted paths. Everything else is rejected.
// IES-P1-27: the legacy top-level `problem` is folded into `problemFlow.problem`
// (see the PATCH handler) — only the canonical path is writable here.
const WORKLOG_PATCH_FIELDS = {
  title: true,
  gitBranch: true,
  currentWork: true,
  plan: true,
  designNotes: true,
  blockers: true,
  status: true,
  mood: true,
  tags: true,
  problemFlow: {
    problem: true,
    investigation: true,
    rootCause: true,
    solution: true,
    lessonsLearned: true,
  },
  reflection: {
    wentWell: true,
    slowedDown: true,
    learned: true,
    improvement: true,
    rating: true,
  },
  moodMetrics: {
    energy: true,
    focus: true,
    stress: true,
    confidence: true,
    motivation: true,
  },
  tomorrowPlan: {
    topPriority: true,
    attentionRequired: true,
    unfinishedItems: true,
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function userTimezone(req) {
  return req.user?.settings?.timezone || 'UTC';
}

function triggerGoogleDocSync(req, log) {
  if (req.user && req.user.googleConnected && req.user.googleTokens && req.user.googleTokens.refreshToken && log.googleDocId) {
    const { getAuthorizedClient, updateWorkLogDoc, setDriveError, clearDriveError } = require('../utils/googleDrive');
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
      // IES-P1-24: the doc updated on Drive — reset any prior sync failure.
      await clearDriveError(req.user);
    }).catch(driveErr => {
      // IES-P1-24: surface the failure instead of degrading silently.
      logger.warn('Failed to sync updated WorkLog to Google Docs');
      setDriveError(req.user, 'Google Docs sync failed. Please reconnect in settings.').catch(() => {});
    });
  }
}

// ── GET /api/worklogs ─────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const filter = { userId: req.user._id };
    if (req.query.active === 'true')  filter.isActive = true;
    if (req.query.active === 'false') filter.isActive = false;

    let logs = await WorkLog.find(filter)
      .populate('taskRef', 'title color category totalTime')
      .populate('projectRef', 'name googleFolderId workLogsFolderId')
      .sort({ isActive: -1, updatedAt: -1 });

    const timeZone = userTimezone(req);
    // IES-P1-02: GET computes effective totals without writing to the DB.
    // IES-P1-03: one batched session query for the whole list (no N+1).
    logs = await syncWorkLogsBulk(logs, req.user._id, { timeZone });

    // IES-P1-10: list responses stay lean — the heaviest arrays (auto-generated
    // timer timeline, progress snapshots, attachments) are omitted; the detail
    // route (GET /:id) still returns the full document. The arrays the main
    // WorkLog view renders (workEntries, completedItems, decisions, blockers,
    // links) stay, so the page needs no extra round-trip to paint.
    res.json(logs.map((log) => {
      const json = typeof log.toObject === 'function' ? log.toObject() : log;
      delete json.timelineEntries;
      delete json.progressSnapshots;
      delete json.attachments;
      return json;
    }));
  } catch (err) {
    next(err);
  }
});

// ── GET /api/worklogs/:id ─────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    let log = await WorkLog.findOne({ _id: req.params.id, userId: req.user._id })
      .populate('taskRef', 'title color category totalTime')
      .populate('projectRef', 'name googleFolderId workLogsFolderId');

    if (!log) return res.status(404).json({ message: 'Not found' });

    // IES-P1-02: GET computes effective totals without writing to the DB.
    log = await syncWorkLog(log, req.user._id, { timeZone: userTimezone(req), persist: false });
    res.json(log);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/worklogs ────────────────────────────────────────────────────────
router.post('/', validate(workLogCreateSchema), async (req, res, next) => {
  try {
    const {
      title, problem, gitBranch, currentWork, plan,
      designNotes, blockers, status, mood, tags, taskRef, projectId,
      problemFlow, gitRef, tomorrowPlan, reflection, moodMetrics
    } = req.body;

    const Project = require('../models/Project');
    let projectRef = undefined;
    let googleDocId = '';
    let googleDocUrl = '';

    if (req.user.googleConnected && req.user.googleTokens && req.user.googleTokens.refreshToken) {
      const { getAuthorizedClient, createProjectFolders, createWorkLogDoc, setDriveError, clearDriveError } = require('../utils/googleDrive');
      try {
        const oauth2Client = await getAuthorizedClient(req.user);
        let targetFolderId = null;
        let pName = 'General';

        if (projectId) {
          const project = await Project.findOne({ _id: projectId, userId: req.user._id });
          if (project) {
            projectRef = project._id;
            pName = project.name;
            if (!project.workLogsFolderId) {
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
          const { google } = require('googleapis');
          const drive = google.drive({ version: 'v3', auth: oauth2Client });
          const searchRes = await drive.files.list({
            q: "name = 'FocusFlow WorkLogs' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
            fields: 'files(id)',
            spaces: 'drive',
          });

          if (searchRes.data.files && searchRes.data.files.length > 0) {
            targetFolderId = searchRes.data.files[0].id;
          } else {
            const defaultFolderRes = await drive.files.create({
              requestBody: { name: 'FocusFlow WorkLogs', mimeType: 'application/vnd.google-apps.folder' },
              fields: 'id',
            });
            targetFolderId = defaultFolderRes.data.id;
          }
        }

        if (targetFolderId) {
          const docRes = await createWorkLogDoc(
            oauth2Client,
            targetFolderId,
            title || 'Untitled Work Item',
            pName,
            { problem: problemFlow?.problem || problem, plan, designNotes, currentWork, blockers }
          );
          googleDocId = docRes.googleDocId;
          googleDocUrl = docRes.googleDocUrl;
        }
        await clearDriveError(req.user);
      } catch (driveErr) {
        logger.warn('Google Drive doc creation failed');
        // IES-P1-24: surface the failure so the client can prompt a reconnect.
        await setDriveError(req.user, 'Drive doc creation failed. Please reconnect in settings.');
      }
    } else if (projectId) {
      const project = await Project.findOne({ _id: projectId, userId: req.user._id });
      if (project) projectRef = project._id;
    }

    const initialTimeline = [
      {
        timestamp: Date.now(),
        type: 'note',
        title: 'Work Journal Initialized',
        description: `Started developer journal "${title || 'Untitled Work Item'}"`,
        category: 'Setup'
      }
    ];

    const log = await WorkLog.create({
      userId:      req.user._id,
      title:       title     || 'Untitled Work Item',
      problem:     problem   || problemFlow?.problem || '',
      gitBranch:   gitBranch || gitRef?.branch || '',
      currentWork: currentWork || '',
      plan:        plan      || '',
      designNotes: designNotes || '',
      blockers:    blockers  || '',
      status:      status    || 'in-progress',
      isActive:    true,
      mood:        mood      || 3,
      tags:        tags      || [],
      taskRef:     taskRef   || undefined,
      projectRef,
      googleDocId,
      googleDocUrl,
      problemFlow: { ...(problemFlow || {}), problem: problemFlow?.problem || problem || '' },
      gitRef:      gitRef || { branch: gitBranch || '' },
      tomorrowPlan: tomorrowPlan || {},
      reflection:  reflection || {},
      moodMetrics: moodMetrics || { energy: 3, focus: 4, stress: 2, confidence: 4, motivation: 4 },
      timelineEntries: initialTimeline,
      workEntries: [],
      totalActiveMs: 0,
    });

    let populated = await log.populate([
      { path: 'taskRef', select: 'title color category totalTime' },
      { path: 'projectRef', select: 'name googleFolderId workLogsFolderId' }
    ]);
    populated = await syncWorkLog(populated, req.user._id, { timeZone: userTimezone(req) });

    res.status(201).json(populated);
    Activity.create({ userId: req.user._id, action: 'worklog.created', details: { worklogTitle: log.title } }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/worklogs/:id ───────────────────────────────────────────────────
router.patch('/:id', validate(workLogPatchSchema, { params: workLogParamsSchema }), async (req, res, next) => {
  try {
    // IES-P1-27: fold a legacy top-level `problem` write into the single
    // `problemFlow.problem` source (explicit `problemFlow.problem` wins).
    const body = { ...req.body };
    if (body.problem != null && body['problemFlow.problem'] == null) {
      body['problemFlow.problem'] = body.problem;
    }
    delete body.problem;

    const patch = buildPatch(body, WORKLOG_PATCH_FIELDS);
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ message: 'No updatable fields provided' });
    }

    let log = await WorkLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: patch },
      { new: true, runValidators: true }
    ).populate('taskRef', 'title color category totalTime')
     .populate('projectRef', 'name googleFolderId workLogsFolderId');

    if (!log) return res.status(404).json({ message: 'Not found' });
    triggerGoogleDocSync(req, log);
    res.json(log);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/worklogs/:id/entries/:entryId — edit a day's "what I did" text.
// IES-P1-02: the unified sync preserves this text for surviving days.
router.patch('/:id/entries/:entryId', validate(
  z.object({ what: text(10000, 'what') }),
  { params: z.object({ id: objectId, entryId: objectId }) }
), async (req, res, next) => {
  try {
    const { what } = req.body;
    const log = await WorkLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id, 'workEntries._id': req.params.entryId },
      { $set: { 'workEntries.$.what': what } },
      { new: true, runValidators: true }
    ).populate('taskRef', 'title color category totalTime')
     .populate('projectRef', 'name googleFolderId workLogsFolderId');
    if (!log) return res.status(404).json({ message: 'Not found' });
    res.json(log);
  } catch (err) {
    next(err);
  }
});

// ── Sub-Document Specific Endpoints ─────────────────────────────────────────

// POST /api/worklogs/:id/timeline — Add timeline entry
router.post('/:id/timeline', validate(timelineEntrySchema, { params: workLogParamsSchema }), async (req, res, next) => {
  try {
    const { title, description, type, category, metadata, timestamp } = req.body;
    // IES-P1-10: `$slice: -cap` keeps the newest entries — the array cannot grow
    // past its budget even though findOneAndUpdate skips the pre-save hook.
    const log = await WorkLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $push: { timelineEntries: { $each: [{ title, description, type: type || 'note', category: category || 'General', metadata, timestamp: timestamp || Date.now() }], $slice: -ARRAY_CAPS.timelineEntries } } },
      { new: true, runValidators: true }
    ).populate('taskRef', 'title color category totalTime')
     .populate('projectRef', 'name googleFolderId workLogsFolderId');
    if (!log) return res.status(404).json({ message: 'Not found' });
    res.json(log);
  } catch (err) {
    next(err);
  }
});

// POST /api/worklogs/:id/decisions — Add decision
router.post('/:id/decisions', validate(decisionSchema, { params: workLogParamsSchema }), async (req, res, next) => {
  try {
    const { title, context, decision, alternatives, rationale } = req.body;
    const log = await WorkLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { 
        $push: { 
          decisions: { $each: [{ title, context, decision, alternatives, rationale, timestamp: Date.now() }], $slice: -ARRAY_CAPS.decisions },
          timelineEntries: { $each: [{ title: `Decision: ${title}`, description: decision, type: 'decision', category: 'Architecture' }], $slice: -ARRAY_CAPS.timelineEntries }
        } 
      },
      { new: true, runValidators: true }
    ).populate('taskRef', 'title color category totalTime')
     .populate('projectRef', 'name googleFolderId workLogsFolderId');
    if (!log) return res.status(404).json({ message: 'Not found' });
    res.json(log);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/worklogs/:id/decisions/:decId
router.delete('/:id/decisions/:decId', validate(null, { params: itemParams('decId') }), async (req, res, next) => {
  try {
    const log = await WorkLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $pull: { decisions: { _id: req.params.decId } } },
      { new: true, runValidators: true }
    ).populate('taskRef', 'title color category totalTime')
     .populate('projectRef', 'name googleFolderId workLogsFolderId');
    if (!log) return res.status(404).json({ message: 'Not found' });
    res.json(log);
  } catch (err) {
    next(err);
  }
});

// POST /api/worklogs/:id/blockers — Add blocker
router.post('/:id/blockers', validate(blockerCreateSchema, { params: workLogParamsSchema }), async (req, res, next) => {
  try {
    const { title, severity, notes } = req.body;
    const log = await WorkLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { 
        $push: { 
          blockerList: { $each: [{ title, severity: severity || 'medium', status: 'open', notes, createdAt: Date.now() }], $slice: -ARRAY_CAPS.blockerList },
          timelineEntries: { $each: [{ title: `Blocker Added: ${title}`, description: notes, type: 'blocker', category: 'Blocker' }], $slice: -ARRAY_CAPS.timelineEntries }
        } 
      },
      { new: true, runValidators: true }
    ).populate('taskRef', 'title color category totalTime')
     .populate('projectRef', 'name googleFolderId workLogsFolderId');
    if (!log) return res.status(404).json({ message: 'Not found' });
    res.json(log);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/worklogs/:id/blockers/:blkId — Update blocker status
router.patch('/:id/blockers/:blkId', validate(blockerPatchSchema, { params: itemParams('blkId') }), async (req, res, next) => {
  try {
    const { status, notes } = req.body;
    const patch = {};
    if (status) patch['blockerList.$.status'] = status;
    if (notes) patch['blockerList.$.notes'] = notes;
    if (status === 'resolved') patch['blockerList.$.resolvedAt'] = Date.now();

    const log = await WorkLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id, 'blockerList._id': req.params.blkId },
      { $set: patch },
      { new: true, runValidators: true }
    ).populate('taskRef', 'title color category totalTime')
     .populate('projectRef', 'name googleFolderId workLogsFolderId');
    if (!log) return res.status(404).json({ message: 'Not found' });
    res.json(log);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/worklogs/:id/blockers/:blkId
router.delete('/:id/blockers/:blkId', validate(null, { params: itemParams('blkId') }), async (req, res, next) => {
  try {
    const log = await WorkLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $pull: { blockerList: { _id: req.params.blkId } } },
      { new: true, runValidators: true }
    ).populate('taskRef', 'title color category totalTime')
     .populate('projectRef', 'name googleFolderId workLogsFolderId');
    if (!log) return res.status(404).json({ message: 'Not found' });
    res.json(log);
  } catch (err) {
    next(err);
  }
});

// POST /api/worklogs/:id/snapshots — Add progress snapshot
router.post('/:id/snapshots', validate(snapshotCreateSchema, { params: workLogParamsSchema }), async (req, res, next) => {
  try {
    const { period, text } = req.body;
    const log = await WorkLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { 
        $push: { 
          progressSnapshots: { $each: [{ period: period || 'Morning', text, timestamp: Date.now() }], $slice: -ARRAY_CAPS.progressSnapshots },
          timelineEntries: { $each: [{ title: `${period} Snapshot`, description: text, type: 'snapshot', category: 'Progress' }], $slice: -ARRAY_CAPS.timelineEntries }
        } 
      },
      { new: true, runValidators: true }
    ).populate('taskRef', 'title color category totalTime')
     .populate('projectRef', 'name googleFolderId workLogsFolderId');
    if (!log) return res.status(404).json({ message: 'Not found' });
    res.json(log);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/worklogs/:id/snapshots/:snapId
router.delete('/:id/snapshots/:snapId', validate(null, { params: itemParams('snapId') }), async (req, res, next) => {
  try {
    const log = await WorkLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $pull: { progressSnapshots: { _id: req.params.snapId } } },
      { new: true, runValidators: true }
    ).populate('taskRef', 'title color category totalTime')
     .populate('projectRef', 'name googleFolderId workLogsFolderId');
    if (!log) return res.status(404).json({ message: 'Not found' });
    res.json(log);
  } catch (err) {
    next(err);
  }
});

// POST /api/worklogs/:id/attachments — Add attachment
router.post('/:id/attachments', validate(attachmentCreateSchema, { params: workLogParamsSchema }), async (req, res, next) => {
  try {
    const { name, type, url, sizeBytes, description } = req.body;
    const log = await WorkLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $push: { attachments: { $each: [{ name, type: type || 'file', url, sizeBytes: sizeBytes || 0, description: description || '', uploadDate: Date.now() }], $slice: -ARRAY_CAPS.attachments } } },
      { new: true, runValidators: true }
    ).populate('taskRef', 'title color category totalTime')
     .populate('projectRef', 'name googleFolderId workLogsFolderId');
    if (!log) return res.status(404).json({ message: 'Not found' });
    res.json(log);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/worklogs/:id/attachments/:attId
router.delete('/:id/attachments/:attId', validate(null, { params: itemParams('attId') }), async (req, res, next) => {
  try {
    const log = await WorkLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $pull: { attachments: { _id: req.params.attId } } },
      { new: true, runValidators: true }
    ).populate('taskRef', 'title color category totalTime')
     .populate('projectRef', 'name googleFolderId workLogsFolderId');
    if (!log) return res.status(404).json({ message: 'Not found' });
    res.json(log);
  } catch (err) {
    next(err);
  }
});

// POST /api/worklogs/:id/completed — Add completed item with category
router.post('/:id/completed', validate(completedItemCreateSchema, { params: workLogParamsSchema }), async (req, res, next) => {
  try {
    const { text, category } = req.body;
    const log = await WorkLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { 
        $push: { 
          completedItems: { $each: [{ text, category: category || 'feature', done: true, completedAt: Date.now(), createdAt: Date.now() }], $slice: -ARRAY_CAPS.completedItems },
          timelineEntries: { $each: [{ title: `Completed: ${text}`, description: `Category: ${category || 'feature'}`, type: 'completed_item', category: 'Done' }], $slice: -ARRAY_CAPS.timelineEntries }
        } 
      },
      { new: true, runValidators: true }
    ).populate('taskRef', 'title color category totalTime')
     .populate('projectRef', 'name googleFolderId workLogsFolderId');
    if (!log) return res.status(404).json({ message: 'Not found' });
    triggerGoogleDocSync(req, log);
    res.json(log);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/worklogs/:id/completed/:itemId
router.delete('/:id/completed/:itemId', validate(null, { params: itemParams('itemId') }), async (req, res, next) => {
  try {
    const log = await WorkLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $pull: { completedItems: { _id: req.params.itemId } } },
      { new: true, runValidators: true }
    ).populate('taskRef', 'title color category totalTime')
     .populate('projectRef', 'name googleFolderId workLogsFolderId');
    if (!log) return res.status(404).json({ message: 'Not found' });
    triggerGoogleDocSync(req, log);
    res.json(log);
  } catch (err) {
    next(err);
  }
});

// POST /api/worklogs/:id/links — Add link with category
router.post('/:id/links', validate(linkCreateSchema, { params: workLogParamsSchema }), async (req, res, next) => {
  try {
    const { label, url, category } = req.body;
    const log = await WorkLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $push: { links: { $each: [{ label, url, category: category || 'General' }], $slice: -ARRAY_CAPS.links } } },
      { new: true, runValidators: true }
    ).populate('taskRef', 'title color category totalTime')
     .populate('projectRef', 'name googleFolderId workLogsFolderId');
    if (!log) return res.status(404).json({ message: 'Not found' });
    triggerGoogleDocSync(req, log);
    res.json(log);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/worklogs/:id/links/:linkId
router.delete('/:id/links/:linkId', validate(null, { params: itemParams('linkId') }), async (req, res, next) => {
  try {
    const log = await WorkLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $pull: { links: { _id: req.params.linkId } } },
      { new: true, runValidators: true }
    ).populate('taskRef', 'title color category totalTime')
     .populate('projectRef', 'name googleFolderId workLogsFolderId');
    if (!log) return res.status(404).json({ message: 'Not found' });
    triggerGoogleDocSync(req, log);
    res.json(log);
  } catch (err) {
    next(err);
  }
});

// POST /api/worklogs/:id/sync-time
router.post('/:id/sync-time', validate(null, { params: workLogParamsSchema }), async (req, res, next) => {
  try {
    let log = await WorkLog.findOne({ _id: req.params.id, userId: req.user._id });
    if (!log) return res.status(404).json({ message: 'Not found' });

    log = await syncWorkLog(log, req.user._id, { timeZone: userTimezone(req) });
    await log.populate([
      { path: 'taskRef', select: 'title color category totalTime' },
      { path: 'projectRef', select: 'name googleFolderId workLogsFolderId' }
    ]);
    res.json(log);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/worklogs/:id/task
router.patch('/:id/task', validate(workLogTaskPatchSchema, { params: workLogParamsSchema }), async (req, res, next) => {
  try {
    const { taskRef } = req.body;
    if (taskRef) {
      const task = await Task.findOne({ _id: taskRef, userId: req.user._id });
      if (!task) return res.status(404).json({ message: 'Task not found' });
    }

    let log = await WorkLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      taskRef ? { $set: { taskRef } } : { $unset: { taskRef: '' }, $set: { totalActiveMs: 0, workEntries: [] } },
      { new: true, runValidators: true }
    ).populate('taskRef', 'title color category totalTime')
     .populate('projectRef', 'name googleFolderId workLogsFolderId');

    if (!log) return res.status(404).json({ message: 'Not found' });
    log = await syncWorkLog(log, req.user._id, { timeZone: userTimezone(req) });
    await log.populate([
      { path: 'taskRef', select: 'title color category totalTime' },
      { path: 'projectRef', select: 'name googleFolderId workLogsFolderId' }
    ]);
    res.json(log);
  } catch (err) {
    next(err);
  }
});

// POST /api/worklogs/:id/close
router.post('/:id/close', validate(null, { params: workLogParamsSchema }), async (req, res, next) => {
  try {
    const log = await WorkLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: { status: 'done', isActive: false, closedAt: Date.now() } },
      { new: true, runValidators: true }
    ).populate('taskRef', 'title color category totalTime')
     .populate('projectRef', 'name googleFolderId workLogsFolderId');
    if (!log) return res.status(404).json({ message: 'Not found' });
    res.json(log);
    Activity.create({ userId: req.user._id, action: 'worklog.closed', details: { worklogTitle: log.title } }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

// POST /api/worklogs/:id/continue
router.post('/:id/continue', validate(null, { params: workLogParamsSchema }), async (req, res, next) => {
  try {
    const log = await WorkLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: { status: 'in-progress', isActive: true, closedAt: null, reopenedAt: Date.now() } },
      { new: true, runValidators: true }
    ).populate('taskRef', 'title color category totalTime')
     .populate('projectRef', 'name googleFolderId workLogsFolderId');
    if (!log) return res.status(404).json({ message: 'Not found' });
    res.json(log);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/worklogs/:id
router.delete('/:id', validate(null, { params: workLogParamsSchema }), async (req, res, next) => {
  try {
    const log = await WorkLog.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!log) return res.status(404).json({ message: 'Not found' });
    res.json(log);
    Activity.create({ userId: req.user._id, action: 'worklog.closed', details: { worklogTitle: log.title } }).catch(() => {});
  } catch (err) {
    next(err);
  }
});

module.exports = router;
