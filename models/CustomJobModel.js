const mongoose = require('mongoose');

/*
  Custom jobs created by planners from the Pre-Planner page.
  These appear as draggable cards in the source panel alongside booked equipment.
*/

const CustomJobSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  estimated_hours: { type: Number, default: 0 },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  tags: { type: [String], default: [] },
  // Once assigned, track assignment id
  assigned: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('CustomJob', CustomJobSchema);
