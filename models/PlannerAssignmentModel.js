const mongoose = require('mongoose');

/*
  MongoDB Schema for the advanced Pre-Planner page.

  Each assignment represents a single scheduled block on the Gantt timeline:
  - Linked to a technician
  - Optionally linked to booked equipment OR is a custom job
  - Spans a date range
  - Assigned to a bay (1-6, "External", or freeform text)
  - Tracks priority, notes, and source type
*/

const PlannerAssignmentSchema = new mongoose.Schema({
  technician_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Technician',
    required: true,
    index: true
  },

  // 'equipment' = dragged from booked equipment list
  // 'custom'    = user-created custom job
  // 'dayoff'    = technician day off / leave
  source_type: {
    type: String,
    enum: ['equipment', 'custom', 'dayoff'],
    required: true
  },

  // If source_type === 'equipment', reference the Equipment document
  equipment_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Equipment',
    default: null
  },

  // Display title (equipment model/name or custom job title)
  title: { type: String, required: true, trim: true },

  // Optional description / job details
  description: { type: String, trim: true, default: '' },

  // Bay identifier – stored as string to support "External" and custom values
  // Bay identifier – not required for dayoff source_type
  bay: { type: String, trim: true, default: '' },

  start_date: { type: Date, required: true, index: true },
  end_date: { type: Date, required: true, index: true },

  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },

  is_rush: { type: Boolean, default: false },

  notes: { type: String, trim: true, default: '' },

  tags: { type: [String], default: [] },

  // Estimated duration in hours (for custom jobs)
  estimated_hours: { type: Number, default: 0 },

  // Color override (hex) – optional
  color: { type: String, trim: true, default: '' }
}, { timestamps: true });

PlannerAssignmentSchema.index({ technician_id: 1, start_date: 1, end_date: 1 });
PlannerAssignmentSchema.index({ bay: 1, start_date: 1, end_date: 1 });

module.exports = mongoose.model('PlannerAssignment', PlannerAssignmentSchema);
