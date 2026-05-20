const mongoose = require('mongoose');

const FinishedProjectSchema = new mongoose.Schema({
  bayNumber: { type: Number, required: true },
  projectName: { type: String, trim: true },
  assignedTeam: { type: [String], default: [] },
  timer: {
    start: { type: Date, default: null },
    end: { type: Date, default: null }
  },
  paused: { type: Boolean, default: false },
  pausedAt: { type: Date, default: null },
  pauseEvents: {
    type: [{ pausedAt: Date, resumedAt: Date, durationMs: Number, reason: { type: String, trim: true } }],
    default: []
  },
  currentPauseReason: { type: String, trim: true, default: '' },
  movedToDirect: { type: Boolean, default: false },
  delayReason: { type: String, trim: true, default: '' },
  projectNotes: { type: Array, default: [] },
  completedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('FinishedProject', FinishedProjectSchema);
