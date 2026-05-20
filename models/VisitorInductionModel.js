const mongoose = require('mongoose');

const PPEItemSchema = new mongoose.Schema({
  own: { type: Boolean, default: false },
  loan: { type: Boolean, default: false }
}, { _id: false });

const VisitorInductionSchema = new mongoose.Schema({
  visitorType: { type: String, enum: ['workshop', 'visitor', 'delivery'], default: 'workshop' },
  inductionDate: { type: Date, required: true },
  validUntil: { type: Date, default: null },
  ppe: {
    safetyHelmet: { type: PPEItemSchema, default: () => ({}) },
    safetyBoots: { type: PPEItemSchema, default: () => ({}) },
    overalls: { type: PPEItemSchema, default: () => ({}) },
    eyeProtection: { type: PPEItemSchema, default: () => ({}) },
    hearingProtection: { type: PPEItemSchema, default: () => ({}) },
    gloves: { type: PPEItemSchema, default: () => ({}) },
    safetyHarness: { type: PPEItemSchema, default: () => ({}) },
    heightsTraining: { type: Boolean, default: false }
  },
  medical: {
    diabetes: { type: String, enum: ['yes', 'no', null], default: null },
    epilepsy: { type: String, enum: ['yes', 'no', null], default: null },
    hypertension: { type: String, enum: ['yes', 'no', null], default: null },
    tuberculosis: { type: String, enum: ['yes', 'no', null], default: null },
    asthma: { type: String, enum: ['yes', 'no', null], default: null },
    vision: { type: String, enum: ['yes', 'no', null], default: null },
    hearing: { type: String, enum: ['yes', 'no', null], default: null },
    drugs: { type: String, enum: ['yes', 'no', null], default: null },
    alcohol: { type: String, enum: ['yes', 'no', null], default: null }
  },
  visitor: {
    company: { type: String, required: true, trim: true },
    contactNo: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    idNumber: { type: String, default: null, trim: true }
  },
  delivery: {
    company: { type: String, default: null, trim: true },
    contactNo: { type: String, default: null, trim: true },
    name: { type: String, default: null, trim: true },
    idNumber: { type: String, default: null, trim: true }
  },
  signatureUrl: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('VisitorInduction', VisitorInductionSchema);
