const mongoose = require('mongoose');

const PreplannedProjectSchema = new mongoose.Schema({
  technician_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Technician',
    required: true,
    index: true
  },
  project_name: { type: String, required: true, trim: true },
  bay: { type: Number, required: true, min: 1, max: 6, index: true },
  start_date: { type: Date, required: true, index: true },
  end_date: { type: Date, required: true, index: true }
}, { timestamps: true });

PreplannedProjectSchema.index({ technician_id: 1, bay: 1, start_date: 1, end_date: 1 });

module.exports = mongoose.model('PreplannedProject', PreplannedProjectSchema);
