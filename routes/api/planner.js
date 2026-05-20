const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Technician = require('../../models/TechnicianModel');
const Equipment = require('../../models/EquipmentModel');
const PlannerAssignment = require('../../models/PlannerAssignmentModel');
const CustomJob = require('../../models/CustomJobModel');
const Holiday = require('../../models/HolidayModel');
const syncSAHolidays = require('../../utils/syncSAHolidays');

// Sync SA public holidays once on first request, then every 24 h
let lastSync = 0;
const SYNC_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

async function ensureHolidaysLoaded() {
  const now = Date.now();
  if (now - lastSync > SYNC_INTERVAL) {
    lastSync = now;
    // Fire-and-forget so it doesn't block the response
    syncSAHolidays().catch(() => {});
  }
}

// ─── Helpers ──────────────────────────────────────────────

function normDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfDay(d) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function endOfDay(d) {
  const c = new Date(d);
  c.setHours(23, 59, 59, 999);
  return c;
}

// ─── GET /  – aggregate bootstrap payload ─────────────────
// Returns technicians, assignments (within date window), booked equipment, and custom jobs
router.get('/', async (req, res, next) => {
  try {
    // Trigger SA holiday sync in background (non-blocking)
    ensureHolidaysLoaded();

    const from = normDate(req.query.from);
    const to = normDate(req.query.to);

    const assignmentFilter = {};
    if (from || to) {
      const fromDate = from ? startOfDay(from) : new Date('1970-01-01');
      const toDate = to ? endOfDay(to) : new Date('9999-12-31');
      assignmentFilter.start_date = { $lte: toDate };
      assignmentFilter.end_date = { $gte: fromDate };
    }

    const [technicians, assignments, equipment, customJobs, holidays] = await Promise.all([
      Technician.find().sort({ name: 1 }).lean(),
      PlannerAssignment.find(assignmentFilter)
        .populate('technician_id', 'name stockHours')
        .populate('equipment_id', 'equipmentId equipmentName customerName category')
        .sort({ start_date: 1 })
        .lean(),
      Equipment.find({ status: 'in-workshop' }).sort({ createdAt: -1 }).lean(),
      CustomJob.find().sort({ createdAt: -1 }).lean(),
      Holiday.find().sort({ date: 1 }).lean()
    ]);

    res.json({ technicians, assignments, equipment, customJobs, holidays });
  } catch (err) {
    next(err);
  }
});

// ─── Assignments CRUD ─────────────────────────────────────

router.post('/assignments', async (req, res, next) => {
  try {
    const body = req.body;
    if (!body) return res.status(400).json({ error: 'Request body required.' });

    const techId = body.technician_id;
    const title = (body.title || '').trim();
    const bay = (body.bay || '').trim();
    const startDate = normDate(body.start_date);
    const endDate = normDate(body.end_date);
    const sourceType = body.source_type;

    if (!techId || !title || !startDate || !endDate || !sourceType) {
      return res.status(400).json({ error: 'technician_id, title, start_date, end_date and source_type are required.' });
    }

    // Bay is required for non-dayoff assignments
    if (sourceType !== 'dayoff' && !bay) {
      return res.status(400).json({ error: 'bay is required for equipment and custom assignments.' });
    }

    if (!mongoose.Types.ObjectId.isValid(techId)) {
      return res.status(400).json({ error: 'Invalid technician_id.' });
    }

    if (endDate < startDate) {
      return res.status(400).json({ error: 'end_date must be >= start_date.' });
    }

    const tech = await Technician.findById(techId).lean();
    if (!tech) return res.status(400).json({ error: 'Technician not found.' });

    const doc = await PlannerAssignment.create({
      technician_id: techId,
      source_type: sourceType,
      equipment_id: body.equipment_id || null,
      title,
      description: body.description || '',
      bay,
      start_date: startDate,
      end_date: endDate,
      priority: body.priority || 'medium',
      is_rush: Boolean(body.is_rush),
      notes: body.notes || '',
      tags: Array.isArray(body.tags) ? body.tags : [],
      estimated_hours: Number(body.estimated_hours) || 0,
      color: body.color || ''
    });

    const populated = await PlannerAssignment.findById(doc._id)
      .populate('technician_id', 'name stockHours')
      .populate('equipment_id', 'equipmentId equipmentName customerName category')
      .lean();

    res.status(201).json(populated);
  } catch (err) {
    next(err);
  }
});

router.put('/assignments/:id', async (req, res, next) => {
  try {
    const existing = await PlannerAssignment.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Assignment not found.' });

    const body = req.body;

    if (body.technician_id !== undefined) {
      if (!mongoose.Types.ObjectId.isValid(body.technician_id)) {
        return res.status(400).json({ error: 'Invalid technician_id.' });
      }
      existing.technician_id = body.technician_id;
    }
    if (body.title !== undefined) existing.title = body.title;
    if (body.description !== undefined) existing.description = body.description;
    if (body.bay !== undefined) existing.bay = body.bay;
    if (body.start_date !== undefined) existing.start_date = normDate(body.start_date);
    if (body.end_date !== undefined) existing.end_date = normDate(body.end_date);
    if (body.priority !== undefined) existing.priority = body.priority;
    if (body.is_rush !== undefined) existing.is_rush = body.is_rush;
    if (body.notes !== undefined) existing.notes = body.notes;
    if (body.tags !== undefined) existing.tags = body.tags;
    if (body.estimated_hours !== undefined) existing.estimated_hours = body.estimated_hours;
    if (body.color !== undefined) existing.color = body.color;
    if (body.source_type !== undefined) existing.source_type = body.source_type;
    if (body.equipment_id !== undefined) existing.equipment_id = body.equipment_id;

    if (existing.end_date < existing.start_date) {
      return res.status(400).json({ error: 'end_date must be >= start_date.' });
    }

    await existing.save();

    const updated = await PlannerAssignment.findById(existing._id)
      .populate('technician_id', 'name stockHours')
      .populate('equipment_id', 'equipmentId equipmentName customerName category')
      .lean();

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Bulk save: accepts array of assignment objects (create or update)
router.post('/assignments/bulk', async (req, res, next) => {
  try {
    const items = Array.isArray(req.body) ? req.body : req.body?.assignments;
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Expected an array of assignments.' });
    }

    const results = [];
    for (const item of items) {
      if (item._id) {
        const existing = await PlannerAssignment.findById(item._id);
        if (existing) {
          Object.assign(existing, item);
          await existing.save();
          results.push(existing.toObject());
          continue;
        }
      }
      const created = await PlannerAssignment.create(item);
      results.push(created.toObject());
    }

    res.json({ saved: results.length, assignments: results });
  } catch (err) {
    next(err);
  }
});

router.delete('/assignments/:id', async (req, res, next) => {
  try {
    const deleted = await PlannerAssignment.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Assignment not found.' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ─── Custom Jobs CRUD ──────────────────────────────────────

router.get('/custom-jobs', async (_req, res, next) => {
  try {
    const jobs = await CustomJob.find().sort({ createdAt: -1 }).lean();
    res.json(jobs);
  } catch (err) {
    next(err);
  }
});

router.post('/custom-jobs', async (req, res, next) => {
  try {
    const title = (req.body.title || '').trim();
    if (!title) return res.status(400).json({ error: 'Job title is required.' });

    const doc = await CustomJob.create({
      title,
      description: req.body.description || '',
      estimated_hours: Number(req.body.estimated_hours) || 0,
      priority: req.body.priority || 'medium',
      tags: Array.isArray(req.body.tags) ? req.body.tags : []
    });

    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
});

router.delete('/custom-jobs/:id', async (req, res, next) => {
  try {
    const deleted = await CustomJob.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Custom job not found.' });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ─── Holidays CRUD ─────────────────────────────────────────

router.get('/holidays', async (_req, res, next) => {
  try {
    const holidays = await Holiday.find().sort({ date: 1 }).lean();
    res.json(holidays);
  } catch (err) {
    next(err);
  }
});

router.post('/holidays', async (req, res, next) => {
  try {
    const name = (req.body.name || '').trim();
    const date = normDate(req.body.date);
    if (!name || !date) return res.status(400).json({ error: 'name and date are required.' });

    const doc = await Holiday.create({ name, date: startOfDay(date), source: 'manual' });
    res.status(201).json(doc);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'A holiday already exists on this date.' });
    }
    next(err);
  }
});

router.delete('/holidays/:id', async (req, res, next) => {
  try {
    const holiday = await Holiday.findById(req.params.id);
    if (!holiday) return res.status(404).json({ error: 'Holiday not found.' });
    if (holiday.source === 'system') {
      return res.status(400).json({ error: 'Cannot delete a system holiday. Only manually added holidays can be removed.' });
    }
    await Holiday.findByIdAndDelete(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
