const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    // IES-P1-07: field-level bounds so hostile/malformed input can't poison a profile.
    name:         { type: String, required: true, trim: true, maxlength: 100 },
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    passwordHash: { type: String, required: true },
    role:         { type: String, enum: ['user', 'admin'], default: 'user' },
    avatar:       { type: String, default: '', maxlength: 2000 },
    streak: {
      current:    { type: Number, default: 0, min: 0 },
      lastDate:   { type: String, default: '' }, // YYYY-MM-DD
      best:       { type: Number, default: 0, min: 0 },
    },
    leaderboardOptIn: { type: Boolean, default: true },
    totalPoints:      { type: Number,  default: 0, min: 0 },
    settings: {
      mode:          { type: String,  enum: ['dark', 'light'], default: 'dark' },
      dailyGoal:     { type: Number,  default: 8, min: 0, max: 24 },
      pomodoroWork:  { type: Number,  default: 25, min: 1, max: 120 },
      pomodoroBreak: { type: Number,  default: 5, min: 1, max: 60 },
      timezone:      { type: String,  default: 'UTC', maxlength: 50 },
      accentColor:   { type: String,  default: '#0ea5e9', maxlength: 7 },
      fontSize:      { type: String,  enum: ['sm', 'md', 'lg'], default: 'md' },
      glassmorphism: { type: Boolean, default: true },
      animatedBg:    { type: Boolean, default: true },
      reducedMotion: { type: Boolean, default: false },
    },
    googleConnected: { type: Boolean, default: false },
    // IES-P1-24: last Google Drive sync failure, surfaced to the client so a
    // user can reconnect instead of silently losing Drive-backed work logs.
    // Empty string = healthy; non-empty = human-readable reason to show in UI.
    driveSyncError: { type: String, default: '', maxlength: 500 },
    googleTokens: {
      accessToken:  { type: String },
      refreshToken: { type: String },
      expiryDate:   { type: Number },
    },
    // In-progress Google OAuth flow (IES-P0-10): opaque single-use nonce stored
    // hashed, with expiry, plus the PKCE code_verifier needed to redeem the code.
    googleOAuth: {
      stateHash:    { type: String },
      stateExpiry:  { type: Date },
      codeVerifier: { type: String },
    },
    deletedAt: { type: Date, default: null, index: true },
    // Bumped on soft-delete / role change to invalidate previously-issued JWTs.
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Helps the login query `findOne({ email, deletedAt: null })`.
// The `{ _id, deletedAt }` pair needs no extra index — the `_id` unique index
// already serves `findById` in `protect`.
userSchema.index({ email: 1, deletedAt: 1 });

// IES-P1-04: leaderboard is a partial index over opted-in, non-deleted users.
userSchema.index(
  { leaderboardOptIn: 1, totalPoints: -1 },
  { partialFilterExpression: { leaderboardOptIn: true, deletedAt: null } }
);

// Strip passwordHash and Google OAuth tokens from all JSON responses.
// googleTokens (incl. long-lived refreshToken) and the in-flight googleOAuth
// flow (PKCE verifier) must never reach the client; server-side Drive sync reads
// them from the loaded doc, not serialized output.
userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.googleTokens;
    delete ret.googleOAuth;
    return ret;
  },
});

// Compare plaintext password during login
userSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

// Static helper to hash a password before save
userSchema.statics.hashPassword = (plain) => bcrypt.hash(plain, 12);

module.exports = mongoose.model('User', userSchema);
