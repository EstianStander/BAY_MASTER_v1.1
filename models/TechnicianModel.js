const mongoose = require('mongoose');

const TechnicianSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  stockHours: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('Technician', TechnicianSchema);
