const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },
    name: {
      type:     String,
      required: true,
      trim:     true,
    },
// IES-P1-12: lowercased mirror of `name` backing the case-insensitive
// uniqueness index `{ userId, nameKey }`. Derived in the pre-validate hook so
// it is set BEFORE the required/unique validators run (mongoose validates
// before pre-save hooks fire); the route pre-check also matches on it.
nameKey: {
  type:     String,
  required: true,
},
    googleFolderId: {
      type:    String,
      default: '',
    },
    workLogsFolderId: {
      type:    String,
      default: '',
    },
    designDocsFolderId: {
      type:    String,
      default: '',
    },
    meetingNotesFolderId: {
      type:    String,
      default: '',
    },
    reportsFolderId: {
      type:    String,
      default: '',
    },
  },
  { timestamps: true }
);

// IES-P1-12: unique project name per user, case-insensitive. The old
// `{ userId: 1, name: 1 }` index was case-sensitive, so "Foo"/"foo" could both
// be created. `nameKey` is always lowercased, so this blocks duplicates for all
// casings at the DB (E11000) even when the route pre-check races.
projectSchema.index({ userId: 1, nameKey: 1 }, { unique: true });

// IES-P1-12: keep `nameKey` in lockstep with `name`. Registered on 'validate'
// (not 'save') because mongoose validates the document BEFORE pre-save hooks
// run — with `nameKey` required, deriving it in pre-save would fail every
// create. `name` arrives trimmed by the schema setter, then `nameKey` mirrors it.
function deriveNameKey(name) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  return trimmed.toLowerCase();
}

projectSchema.pre('validate', function (next) {
  if (typeof this.name === 'string') {
    this.name = this.name.trim();
  }
  this.nameKey = deriveNameKey(this.name);
  next();
});

module.exports = mongoose.model('Project', projectSchema);
module.exports.deriveNameKey = deriveNameKey;
