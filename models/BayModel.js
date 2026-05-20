const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
  text: { type: String, trim: true },
  deadline: { type: Date },
  priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' }
}, { _id: false });

const DirectProjectSnapshotSchema = new mongoose.Schema({
  projectName: { type: String, trim: true },
  technicianName: { type: String, trim: true },
  timer: {
    start: { type: Date, default: null },
    end: { type: Date, default: null }
  },
  paused: { type: Boolean, default: false },
  pausedAt: { type: Date, default: null },
  status: { type: String, enum: ['active', 'completed'], default: 'active' }
}, { _id: false });

// Guard against legacy/null status entries
DirectProjectSnapshotSchema.pre('validate', function(next) {
  if (!this.status) this.status = 'active';
  next();
});

// Normalize embedded directProject on bays
const normalizeDirectStatus = function(next) {
  if (this.directProject && !this.directProject.status) {
    this.directProject.status = 'active';
  }
  next();
};

const BaySchema = new mongoose.Schema({
  bayNumber: { type: Number, required: true, unique: true, min: 1, max: 6 },
  projectName: { type: String, trim: true },
  equipmentAssignment: {
    equipmentDbId: { type: mongoose.Schema.Types.ObjectId, ref: 'Equipment', default: null },
    equipmentId: { type: String, trim: true, default: '' },
    equipmentName: { type: String, trim: true, default: '' }
  },
  assignedTeam: { type: [String], default: [] },
  timer: {
    start: { type: Date, default: null },
    end: { type: Date, default: null }
  },
  tasks: { type: [TaskSchema], default: [] },
  paused: { type: Boolean, default: false },
  pausedAt: { type: Date, default: null },
  delayReason: { type: String, trim: true, default: '' },
  currentPauseReason: { type: String, trim: true, default: '' },
  pauseEvents: {
    type: [{ pausedAt: Date, resumedAt: Date, durationMs: Number, reason: { type: String, trim: true } }],
    default: []
  },
  movedToDirect: { type: Boolean, default: false },
  directProjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'DirectProject', default: null },
  currentProjectType: { type: String, enum: ['bay', 'direct'], default: 'bay' },
  directProject: { type: DirectProjectSnapshotSchema, default: null },
  // Snapshot of the bay project when a direct project displaces it
  displacedProject: {
    projectName: { type: String, trim: true },
    assignedTeam: { type: [String], default: [] },
    timer: {
      start: { type: Date, default: null },
      end: { type: Date, default: null }
    },
    paused: { type: Boolean, default: false },
    pausedAt: { type: Date, default: null },
    currentPauseReason: { type: String, trim: true, default: '' },
    pauseStartedAt: { type: Date, default: null },
    pauseEvents: {
      type: [{ pausedAt: Date, resumedAt: Date, durationMs: Number, reason: { type: String, trim: true } }],
      default: []
    },
    delayReason: { type: String, trim: true, default: '' },
    tasks: { type: [TaskSchema], default: [] }
  }
}, { timestamps: true });

BaySchema.pre('validate', normalizeDirectStatus);

module.exports = mongoose.model('Bay', BaySchema);
