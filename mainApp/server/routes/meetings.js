const express = require('express');
const Meeting = require('../models/Meeting');
const protect = require('../middleware/auth');
const { z, objectId, dateKey, validate, httpError } = require('../utils/validation');

const router = express.Router();
router.use(protect);

// Helper to generate a mock meeting link
function generateMeetingLink(platform) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const segment = (len) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  switch (platform) {
    case 'google_meet':
      return `meet.google.com/${segment(3)}-${segment(4)}-${segment(3)}`;
    case 'zoom':
      return `zoom.us/j/${Math.floor(100000000 + Math.random() * 900000000)}?pwd=${segment(12)}`;
    case 'teams':
      return `teams.microsoft.com/l/meetup-join/${segment(12)}%40thread.v2/0?context=${segment(20)}`;
    default:
      return `meeting.focusflow.app/${segment(8)}`;
  }
}

// GET /api/meetings/today - Get today's meetings
router.get('/today', async (req, res, next) => {
  try {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const meetings = await Meeting.find({
      $or: [
        { organizerId: req.user._id },
        { participantIds: req.user._id },
      ],
      date: today,
      status: { $nin: ['cancelled'] },
    })
      .populate('organizerId', 'name email avatar')
      .populate('participantIds', 'name email avatar')
      .sort({ startTime: 1 });

    res.json(meetings);
  } catch (err) {
    next(err);
  }
});

// GET /api/meetings?from=YYYY-MM-DD&to=YYYY-MM-DD&status=scheduled
router.get('/', async (req, res, next) => {
  try {
    const { from, to, status } = req.query;
    const filter = {
      $or: [
        { organizerId: req.user._id },
        { participantIds: req.user._id },
      ],
    };

    if (from && to) {
      filter.date = { $gte: from, $lte: to };
    } else if (from) {
      filter.date = { $gte: from };
    } else if (to) {
      filter.date = { $lte: to };
    }

    if (status) {
      filter.status = status;
    }

    const meetings = await Meeting.find(filter)
      .populate('organizerId', 'name email avatar')
      .populate('participantIds', 'name email avatar')
      .sort({ date: 1, startTime: 1 });

    res.json(meetings);
  } catch (err) {
    next(err);
  }
});

// GET /api/meetings/:id - Get single meeting
router.get('/:id', validate(null, { params: z.object({ id: objectId }) }), async (req, res, next) => {
  try {
    const meeting = await Meeting.findOne({
      _id: req.params.id,
      $or: [
        { organizerId: req.user._id },
        { participantIds: req.user._id },
      ],
    })
      .populate('organizerId', 'name email avatar')
      .populate('participantIds', 'name email avatar');

    if (!meeting) {
      throw httpError(404, 'NOT_FOUND', 'Meeting not found');
    }

    res.json(meeting);
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(2000).optional().default(''),
  date: dateKey,
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'startTime must be HH:mm'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'endTime must be HH:mm'),
  allDay: z.boolean().optional().default(false),
  platform: z.enum(['google_meet', 'zoom', 'teams', 'other']).optional().default('google_meet'),
  meetingLink: z.string().max(500).optional().default(''),
  location: z.string().max(300).optional().default(''),
  category: z.enum(['essentials', 'standup', 'review', 'brainstorm', 'other']).optional().default('essentials'),
  participantIds: z.array(objectId).max(50, 'Too many participants').optional().default([]),
  notes: z.string().max(10000).optional().default(''),
  tags: z.array(z.string().max(50)).max(10).optional().default([]),
  workspaceId: objectId.optional(),
});

// POST /api/meetings - Create a meeting
router.post('/', validate(createSchema), async (req, res, next) => {
  try {
    const {
      title, description, date, startTime, endTime, allDay,
      platform, meetingLink, location, category,
      participantIds, notes, tags, workspaceId,
    } = req.body;

    // Auto-generate link if not provided
    const finalLink = meetingLink || generateMeetingLink(platform);

    const meeting = await Meeting.create({
      title,
      description,
      date,
      startTime,
      endTime,
      allDay,
      platform,
      meetingLink: finalLink,
      location,
      category,
      organizerId: req.user._id,
      participantIds: participantIds || [],
      notes,
      tags,
      workspaceId,
    });

    const populated = await Meeting.findById(meeting._id)
      .populate('organizerId', 'name email avatar')
      .populate('participantIds', 'name email avatar');

    res.status(201).json(populated);
  } catch (err) {
    next(err);
  }
});

const updateSchema = createSchema.partial();

// PUT /api/meetings/:id - Update a meeting
router.put('/:id', validate(updateSchema, { params: z.object({ id: objectId }) }), async (req, res, next) => {
  try {
    const meeting = await Meeting.findOne({
      _id: req.params.id,
      organizerId: req.user._id,
    });

    if (!meeting) {
      throw httpError(404, 'NOT_FOUND', 'Meeting not found or unauthorized');
    }

    const allowedFields = [
      'title', 'description', 'date', 'startTime', 'endTime', 'allDay',
      'platform', 'meetingLink', 'location', 'category',
      'participantIds', 'notes', 'tags', 'status', 'workspaceId',
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        meeting[field] = req.body[field];
      }
    }

    // Auto-generate link if platform changed and link was empty
    if (req.body.platform && !req.body.meetingLink && !meeting.meetingLink) {
      meeting.meetingLink = generateMeetingLink(req.body.platform);
    }

    await meeting.save();

    const populated = await Meeting.findById(meeting._id)
      .populate('organizerId', 'name email avatar')
      .populate('participantIds', 'name email avatar');

    res.json(populated);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/meetings/:id/status - Update meeting status
router.patch('/:id/status', validate(z.object({ status: z.enum(['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled']) }), { params: z.object({ id: objectId }) }), async (req, res, next) => {
  try {
    const meeting = await Meeting.findOne({
      _id: req.params.id,
      $or: [
        { organizerId: req.user._id },
        { participantIds: req.user._id },
      ],
    });

    if (!meeting) {
      throw httpError(404, 'NOT_FOUND', 'Meeting not found');
    }

    meeting.status = req.body.status;
    await meeting.save();

    const populated = await Meeting.findById(meeting._id)
      .populate('organizerId', 'name email avatar')
      .populate('participantIds', 'name email avatar');

    res.json(populated);
  } catch (err) {
    next(err);
  }
});

// POST /api/meetings/:id/participants - Add participant
router.post('/:id/participants', validate(z.object({ userId: objectId }), { params: z.object({ id: objectId }) }), async (req, res, next) => {
  try {
    const meeting = await Meeting.findOne({
      _id: req.params.id,
      organizerId: req.user._id,
    });

    if (!meeting) {
      throw httpError(404, 'NOT_FOUND', 'Meeting not found or unauthorized');
    }

    if (meeting.participantIds.includes(req.body.userId)) {
      throw httpError(400, 'BAD_REQUEST', 'User is already a participant');
    }

    meeting.participantIds.push(req.body.userId);
    await meeting.save();

    const populated = await Meeting.findById(meeting._id)
      .populate('organizerId', 'name email avatar')
      .populate('participantIds', 'name email avatar');

    res.json(populated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/meetings/:id/participants/:userId - Remove participant
router.delete('/:id/participants/:userId', validate(null, { params: z.object({ id: objectId, userId: objectId }) }), async (req, res, next) => {
  try {
    const meeting = await Meeting.findOne({
      _id: req.params.id,
      organizerId: req.user._id,
    });

    if (!meeting) {
      throw httpError(404, 'NOT_FOUND', 'Meeting not found or unauthorized');
    }

    meeting.participantIds = meeting.participantIds.filter(
      (id) => id.toString() !== req.params.userId
    );
    await meeting.save();

    const populated = await Meeting.findById(meeting._id)
      .populate('organizerId', 'name email avatar')
      .populate('participantIds', 'name email avatar');

    res.json(populated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/meetings/:id - Delete a meeting
router.delete('/:id', validate(null, { params: z.object({ id: objectId }) }), async (req, res, next) => {
  try {
    const meeting = await Meeting.findOneAndDelete({
      _id: req.params.id,
      organizerId: req.user._id,
    });

    if (!meeting) {
      throw httpError(404, 'NOT_FOUND', 'Meeting not found or unauthorized');
    }

    res.json({ success: true, message: 'Meeting deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
