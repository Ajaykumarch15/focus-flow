const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name:         { type: String, required: true, trim: true },
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role:         { type: String, enum: ['user', 'admin'], default: 'user' },
    avatar:       { type: String, default: '' },
    streak: {
      current:    { type: Number, default: 0 },
      lastDate:   { type: String, default: '' }, // YYYY-MM-DD
      best:       { type: Number, default: 0 },
    },
    leaderboardOptIn: { type: Boolean, default: true },
    totalPoints:      { type: Number,  default: 0 },
    settings: {
      mode:          { type: String,  default: 'dark' },
      dailyGoal:     { type: Number,  default: 8 },
      pomodoroWork:  { type: Number,  default: 25 },
      pomodoroBreak: { type: Number,  default: 5 },
      timezone:      { type: String,  default: 'UTC' },
      accentColor:   { type: String,  default: '#0ea5e9' },
      fontSize:      { type: String,  default: 'md' },
      glassmorphism: { type: Boolean, default: true },
      animatedBg:    { type: Boolean, default: true },
      reducedMotion: { type: Boolean, default: false },
    },
    googleConnected: { type: Boolean, default: false },
    googleTokens: {
      accessToken:  { type: String },
      refreshToken: { type: String },
      expiryDate:   { type: Number },
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

// Strip passwordHash and Google OAuth tokens from all JSON responses.
// googleTokens (incl. long-lived refreshToken) must never reach the client;
// server-side Drive sync reads them from the loaded doc, not serialized output.
userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.googleTokens;
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
