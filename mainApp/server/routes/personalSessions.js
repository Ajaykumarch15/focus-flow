const express = require('express');
const PersonalSession = require('../models/PersonalSession');
const PersonalTask = require('../models/PersonalTask');
const protect = require('../middleware/auth');
const { serverTime } = require('../utils/sessionTime');
const { logger } = require('../utils/logger');
const { z, objectId, timestamp, opId, validate } = require('../utils/validation');

const router = express.Router();
router.use(protect);

const sessionParamsSchema = z.object({ id: objectId });
const sessionCreateSchema = z.object({ personalTaskId: objectId, startTime: timestamp.optional(), opId });
const sessionPauseSchema = z.object({ pauseTime: timestamp.optional(), opId });
const sessionResumeSchema = z.object({ resumeTime: timestamp.optional(), opId });
const sessionStopSchema = z.object({ endTime: timestamp.optional(), opId });

function hasAppliedOp(session, opId) {
  return Boolean(opId && Array.isArray(session.appliedOpIds) && session.appliedOpIds.includes(opId));
}

function markApplied(session, opId) {
  if (opId && !hasAppliedOp(session, opId)) {
    session.appliedOpIds = [...(session.appliedOpIds || []), opId];
  }
}

function finalizeSessionDoc(session, endTime) {
  const lastPause = [...(session.pauseLog || [])].reverse().find((p) => !p.resumeTime);
  if (lastPause) {
    lastPause.resumeTime = endTime;
    session.totalPauseDuration =
      Math.max(0, session.totalPauseDuration || 0) + Math.max(0, endTime - lastPause.pauseStart);
  }

  session.endTime = endTime;
  session.isActive = false;
  session.activeTime = Math.max(0, endTime - session.startTime - (session.totalPauseDuration || 0));
  session.lastHeartbeat = endTime;

  let score = 100;
  score -= (session.pauseCount || 0) * 5;
  if (session.activeTime > 0) {
    const pauseRatio = session.totalPauseDuration / session.activeTime;
    score -= Math.min(50, pauseRatio * 20);
  }
  session.focusScore = Math.max(0, Math.min(100, Math.round(score)));
  return session;
}

async function recomputeTaskTotalTime(personalTaskId) {
  const sessions = await PersonalSession.find({ personalTaskId, isActive: false });
  const totalTime = sessions.reduce((acc, s) => acc + (s.activeTime || 0), 0);
  await PersonalTask.findByIdAndUpdate(personalTaskId, { totalTime });
}

// GET /api/personal-sessions — fetch sessions (optional ?personalTaskId=, ?active=true)
router.get('/', async (req, res, next) => {
  try {
    const filter = { userId: req.user._id };
    if (req.query.personalTaskId) filter.personalTaskId = req.query.personalTaskId;
    if (req.query.active === 'true') filter.isActive = true;

    const sessions = await PersonalSession.find(filter).sort({ startTime: -1 });
    res.json(sessions);
  } catch (err) {
    next(err);
  }
});

// POST /api/personal-sessions — start a new session
router.post('/', validate(sessionCreateSchema), async (req, res, next) => {
  try {
    const { personalTaskId, startTime, opId } = req.body;
    if (!personalTaskId) return res.status(400).json({ message: 'personalTaskId is required' });

    const task = await PersonalTask.findOne({ _id: personalTaskId, userId: req.user._id });
    if (!task) return res.status(404).json({ message: 'Task not found' });

    if (opId) {
      const existing = await PersonalSession.findOne({ userId: req.user._id, clientOpId: opId });
      if (existing) return res.status(200).json(existing);
    }

    const now = serverTime(startTime);

    const existingSameTaskSession = await PersonalSession.findOne({
      userId: req.user._id,
      personalTaskId,
      isActive: true,
    });
    if (existingSameTaskSession) {
      return res.status(200).json(existingSameTaskSession);
    }

    const orphanedSessions = await PersonalSession.find({ userId: req.user._id, isActive: true });
    for (const activeSession of orphanedSessions) {
      finalizeSessionDoc(activeSession, now);
      await activeSession.save();
      await recomputeTaskTotalTime(activeSession.personalTaskId);
    }

    let session;
    try {
      session = await PersonalSession.create({
        userId: req.user._id,
        personalTaskId,
        startTime: now,
        isActive: true,
        lastHeartbeat: now,
        ...(opId ? { clientOpId: opId } : {}),
      });
    } catch (err) {
      if (err?.code === 11000 && opId) {
        const existing = await PersonalSession.findOne({ userId: req.user._id, clientOpId: opId });
        if (existing) return res.status(200).json(existing);
      }
      throw err;
    }

    await PersonalTask.findByIdAndUpdate(personalTaskId, { status: 'active' });

    logger.debug('personal session started');
    res.status(201).json(session);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/personal-sessions/:id/pause
router.patch('/:id/pause', validate(sessionPauseSchema, { params: sessionParamsSchema }), async (req, res, next) => {
  try {
    const { pauseTime, opId } = req.body;

    const session = await PersonalSession.findOne({ _id: req.params.id, userId: req.user._id, isActive: true });
    if (!session) return res.status(404).json({ message: 'Active session not found' });

    if (hasAppliedOp(session, opId)) return res.json(session);

    const now = serverTime(pauseTime, { min: session.startTime });

    const hasOpenPause = session.pauseLog.some(p => !p.resumeTime);
    if (!hasOpenPause) {
      session.pauseLog.push({ pauseStart: now });
      session.pauseCount = (session.pauseCount || 0) + 1;
    }
    session.lastHeartbeat = now;
    markApplied(session, opId);
    await session.save();

    await PersonalTask.findByIdAndUpdate(session.personalTaskId, { status: 'paused' });

    res.json(session);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/personal-sessions/:id/resume
router.patch('/:id/resume', validate(sessionResumeSchema, { params: sessionParamsSchema }), async (req, res, next) => {
  try {
    const { resumeTime, opId } = req.body;

    const session = await PersonalSession.findOne({ _id: req.params.id, userId: req.user._id, isActive: true });
    if (!session) return res.status(404).json({ message: 'Active session not found' });

    if (hasAppliedOp(session, opId)) return res.json(session);

    const now = serverTime(resumeTime, { min: session.startTime });

    const lastPause = [...session.pauseLog].reverse().find(p => !p.resumeTime);
    if (lastPause) {
      lastPause.resumeTime = now;
      const pauseDuration = Math.max(0, now - lastPause.pauseStart);
      session.totalPauseDuration += pauseDuration;
    }
    session.lastHeartbeat = now;
    markApplied(session, opId);
    await session.save();

    await PersonalTask.findByIdAndUpdate(session.personalTaskId, { status: 'active' });

    res.json(session);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/personal-sessions/:id/stop
router.patch('/:id/stop', validate(sessionStopSchema, { params: sessionParamsSchema }), async (req, res, next) => {
  try {
    const { endTime, opId } = req.body;

    const session = await PersonalSession.findOne({ _id: req.params.id, userId: req.user._id });
    if (!session) return res.status(404).json({ message: 'Session not found' });

    if (hasAppliedOp(session, opId)) return res.json(session);

    if (!session.isActive) {
      markApplied(session, opId);
      await session.save();
      return res.json(session);
    }

    const now = serverTime(endTime, { min: session.startTime });

    markApplied(session, opId);
    finalizeSessionDoc(session, now);
    await session.save();

    await recomputeTaskTotalTime(session.personalTaskId);

    logger.debug('personal session stopped');
    res.json(session);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/personal-sessions/:id/heartbeat
router.patch('/:id/heartbeat', validate(null, { params: sessionParamsSchema }), async (req, res, next) => {
  try {
    const session = await PersonalSession.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id, isActive: true },
      { $set: { lastHeartbeat: serverTime(req.body && req.body.at) } },
      { new: true, projection: { lastHeartbeat: 1 } }
    );
    if (!session) return res.status(404).json({ message: 'Active session not found' });
    res.json({ lastHeartbeat: session.lastHeartbeat });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
