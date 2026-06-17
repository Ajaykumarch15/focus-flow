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
  },
  { timestamps: true }
);

// Strip passwordHash from all JSON responses
userSchema.set('toJSON', {
  transform: (_doc, ret) => { delete ret.passwordHash; return ret; },
});

// Compare plaintext password during login
userSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

// Static helper to hash a password before save
userSchema.statics.hashPassword = (plain) => bcrypt.hash(plain, 12);

module.exports = mongoose.model('User', userSchema);
