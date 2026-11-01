const express = require('express');
const OfficeWorkTime = require('../models/OfficeWorkTime');
const protect = require('../middleware/auth');

const router = express.Router();
router.use(protect);

function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

router.get('/today', async (req, res, next) => {
  try {
    const { date } = req.query;
    if (!validDate(date)) return res.status(400).json({ message: 'A local date (YYYY-MM-DD) is required' });
    const entry = await OfficeWorkTime.findOne({ userId: req.user._id, date });
    res.json(entry || { date, totalMs: 0, activeSince: null });
  } catch (err) { next(err); }
});

router.get('/analytics', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (!validDate(from) || !validDate(to) || from > to) {
      return res.status(400).json({ message: 'A valid from/to date range is required' });
    }
    const entries = await OfficeWorkTime.find({ userId: req.user._id, date: { $gte: from, $lte: to } })
      .sort({ date: 1 }).lean();
    const now = Date.now();
    res.json(entries.map((entry) => ({
      date: entry.date,
      totalMs: Math.max(0, entry.totalMs || 0) + (entry.activeSince ? Math.max(0, now - entry.activeSince) : 0),
    })));
  } catch (err) { next(err); }
});

router.post('/toggle', async (req, res, next) => {
  try {
    const { date } = req.body;
    if (!validDate(date)) return res.status(400).json({ message: 'A local date (YYYY-MM-DD) is required' });
    const now = Date.now();
    let entry = await OfficeWorkTime.findOne({ userId: req.user._id, date });
    if (!entry) entry = await OfficeWorkTime.create({ userId: req.user._id, date, totalMs: 0, activeSince: now });
    else if (entry.activeSince) {
      entry.totalMs += Math.max(0, now - entry.activeSince);
      entry.activeSince = null;
      await entry.save();
    } else {
      entry.activeSince = now;
      await entry.save();
    }
    res.json(entry);
  } catch (err) { next(err); }
});

module.exports = router;
