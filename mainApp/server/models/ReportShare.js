const mongoose = require('mongoose');

const reportShareSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    expiresAt: {
      type: Date,
      // IES-P1-13: every share gets a bounded expiry at creation (route caps it
      // to 1..365 days). Required so the TTL index below can retire every share.
      required: true,
    },
    revokedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

reportShareSchema.index({ userId: 1, date: 1, revokedAt: 1 });

// IES-P1-13 (DB-18): TTL index — documents are removed the moment `expiresAt`
// passes, whether or not they were revoked. `expireAfterSeconds: 0` means no
// grace period. Documents without `expiresAt` are untouched (none, per required).
reportShareSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('ReportShare', reportShareSchema);
