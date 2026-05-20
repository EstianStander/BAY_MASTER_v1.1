const mongoose = require('mongoose');

const ALLOWED_CATEGORIES = [
  'Spare Parts',
  'Coil Repair',
  'Retrofit',
  'Other Repairs',
  'Other General'
];

const EquipmentSchema = new mongoose.Schema({
  category: { type: String, enum: ALLOWED_CATEGORIES, required: true },
  equipmentId: { type: String, required: true, trim: true },
  equipmentName: { type: String, required: true, trim: true },
  customerName: { type: String, trim: true, default: '' },
  customerContact: { type: String, trim: true, default: '' },
  issueDescription: { type: String, required: true, trim: true },
  photoUrls: { type: [String], default: [] },
  photoFilenames: { type: [String], default: [] },
  receivedAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['in-workshop', 'checked-out'], default: 'in-workshop' },
  checkedOutAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Equipment', EquipmentSchema);
