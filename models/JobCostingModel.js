const mongoose = require('mongoose');

const FIXED_RATE_NORMAL = '590.16';
const FIXED_RATE_OT15 = '885.24';
const FIXED_RATE_OT20 = '1180.32';
const EMPTY_OBJECT_ID = '000000000000000000000000';

function decimalOf(value, fallback = '0') {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : Number(fallback);
  return mongoose.Types.Decimal128.fromString(String(safe));
}

const materialSchema = new mongoose.Schema({
  Item: { type: String, trim: true, default: '' },
  Description: { type: String, trim: true, default: '' },
  Qty: { type: mongoose.Schema.Types.Decimal128, default: () => decimalOf(0) },
  CostPrice: { type: mongoose.Schema.Types.Decimal128, default: () => decimalOf(0) }
}, { _id: false });

const technicianSchema = new mongoose.Schema({
  TechnicianId: { type: mongoose.Schema.Types.ObjectId, default: null },
  TechnicianName: { type: String, trim: true, default: '' },
  Hours: { type: mongoose.Schema.Types.Decimal128, default: () => decimalOf(0) },
  IsMainTechnician: { type: Boolean, default: false }
}, { _id: false });

const jobSchema = new mongoose.Schema({
  CompanyId: { type: mongoose.Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId(EMPTY_OBJECT_ID) },
  JobNo: { type: String, trim: true, default: '' },
  CustomerOrderNo: { type: String, trim: true, default: '' },
  TicketNo: { type: String, trim: true, default: '' },
  QuoteNo: { type: String, trim: true, default: '' },
  Category: { type: String, trim: true, default: '' },
  DateCreated: { type: Date, default: Date.now },
  DateUpdated: { type: Date, default: Date.now },
  Status: { type: String, trim: true, default: 'Draft' },
  Description: { type: String, trim: true, default: '' },
  Technicians: { type: [technicianSchema], default: [] },
  Rate: { type: mongoose.Schema.Types.Decimal128, default: () => decimalOf(FIXED_RATE_NORMAL) },
  RateOt15: { type: mongoose.Schema.Types.Decimal128, default: () => decimalOf(FIXED_RATE_OT15) },
  RateOt20: { type: mongoose.Schema.Types.Decimal128, default: () => decimalOf(FIXED_RATE_OT20) },
  AllocRate: { type: mongoose.Schema.Types.Decimal128, default: () => decimalOf(0) },
  AllocRateOt15: { type: mongoose.Schema.Types.Decimal128, default: () => decimalOf(0) },
  AllocRateOt20: { type: mongoose.Schema.Types.Decimal128, default: () => decimalOf(0) },
  NormalHours: { type: mongoose.Schema.Types.Decimal128, default: () => decimalOf(0) },
  Ot15Hours: { type: mongoose.Schema.Types.Decimal128, default: () => decimalOf(0) },
  Ot20Hours: { type: mongoose.Schema.Types.Decimal128, default: () => decimalOf(0) },
  Materials: { type: [materialSchema], default: [] },
  Revenue: { type: mongoose.Schema.Types.Decimal128, default: () => decimalOf(0) },
  AllocNormal: { type: mongoose.Schema.Types.Decimal128, default: () => decimalOf(0) },
  AllocOt15: { type: mongoose.Schema.Types.Decimal128, default: () => decimalOf(0) },
  AllocOt20: { type: mongoose.Schema.Types.Decimal128, default: () => decimalOf(0) },
  ActualNormal: { type: mongoose.Schema.Types.Decimal128, default: () => decimalOf(0) },
  ActualOt15: { type: mongoose.Schema.Types.Decimal128, default: () => decimalOf(0) },
  ActualOt20: { type: mongoose.Schema.Types.Decimal128, default: () => decimalOf(0) },
  ActualMaterialCost: { type: mongoose.Schema.Types.Decimal128, default: () => decimalOf(0) },

  ProjectSource: { type: String, enum: ['bay', 'direct', 'finished'], default: null },
  ProjectId: { type: mongoose.Schema.Types.ObjectId, default: null },
  ProjectName: { type: String, trim: true, default: '' },
  BayNumber: { type: Number, default: null },
  CompanyName: { type: String, trim: true, default: '' }
}, { strict: false, collection: 'Jobs' });

jobSchema.index({ JobNo: 1 });
jobSchema.index({ ProjectSource: 1, ProjectId: 1 });

jobSchema.pre('save', function(next) {
  this.DateUpdated = new Date();

  if (!this.DateCreated) this.DateCreated = new Date();

  next();
});

const jobsMongoUri = process.env.JOBS_MONGODB_URI
  || process.env.MONGODB_URI
  || process.env.MongoDb__ConnectionString
  || 'mongodb+srv://stormfoxstudi_db_user:WjZLMVHXEpfSdtAU@inductotrackdb.q5ekljf.mongodb.net/';

const jobsDbName = process.env.JOBS_DB_NAME
  || process.env.MONGODB_DATABASE
  || process.env.MONGODB_DB
  || process.env.MongoDb__Database
  || 'InductoTrackDb';

const jobsConnection = mongoose.createConnection(jobsMongoUri, {
  dbName: jobsDbName,
  serverSelectionTimeoutMS: 8000,
  connectTimeoutMS: 8000,
  socketTimeoutMS: 30000,
  maxPoolSize: 8,
  family: 4
});

module.exports = jobsConnection.models.JobCosting || jobsConnection.model('JobCosting', jobSchema, 'Jobs');
