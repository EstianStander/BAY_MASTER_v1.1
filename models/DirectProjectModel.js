const mongoose = require('mongoose');

const DirectProjectSchema = new mongoose.Schema({
  projectName: { type: String, required: true, trim: true },
  technicianName: { type: String, required: true, trim: true },
  bayNumber: { type: Number, required: true, min: 1, max: 6 },
  timer: {
    start: { type: Date, required: true },
    end: { type: Date, required: true }
  },
  paused: { type: Boolean, default: false },
  pausedAt: { type: Date, default: null },
  status: { type: String, enum: ['active', 'completed'], default: 'active' },
  completedAt: { type: Date, default: null },
  projectNotes: { type: [Object], default: [] }
}, { timestamps: true });

module.exports = mongoose.model('DirectProject', DirectProjectSchema);
