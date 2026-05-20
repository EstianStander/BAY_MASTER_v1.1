const mongoose = require('mongoose');

const HolidaySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  date: { type: Date, required: true, index: true },
  // 'system' = auto-fetched SA public holiday, 'manual' = user-added
  source: { type: String, enum: ['system', 'manual'], default: 'manual' },
}, { timestamps: true });

// Prevent duplicate holidays on the same date
HolidaySchema.index({ date: 1 }, { unique: true });

module.exports = mongoose.model('Holiday', HolidaySchema);
