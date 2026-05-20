const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Technician = require('../../models/TechnicianModel');
const PreplannedProject = require('../../models/PreplannedProjectModel');

function normalizeDateInput(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function getDateWindow(query) {
  const from = normalizeDateInput(query.from);
  const to = normalizeDateInput(query.to);

  if (!from && !to) return null;

  const fromDate = from ? startOfDay(from) : new Date('1970-01-01T00:00:00.000Z');
  const toDate = to ? endOfDay(to) : new Date('9999-12-31T23:59:59.999Z');

  return { fromDate, toDate };
}

async function validatePayload(payload) {
  const technicianId = payload.technician_id;
  const projectName = (payload.project_name || '').trim();
  const bay = Number.parseInt(payload.bay, 10);
  const startDate = normalizeDateInput(payload.start_date);
  const endDate = normalizeDateInput(payload.end_date);

  if (!technicianId || !projectName || Number.isNaN(bay) || !startDate || !endDate) {
    return { error: 'technician_id, project_name, bay, start_date and end_date are required.' };
  }

  if (!mongoose.Types.ObjectId.isValid(technicianId)) {
    return { error: 'Invalid technician_id.' };
  }

  if (bay < 1 || bay > 6) {
    return { error: 'bay must be between 1 and 6.' };
  }

  if (endDate < startDate) {
    return { error: 'end_date must be after or equal to start_date.' };
  }

  const technician = await Technician.findById(technicianId).lean();
  if (!technician) {
    return { error: 'Selected technician does not exist.' };
  }

  return {
    data: {
      technician_id: technicianId,
      project_name: projectName,
      bay,
      start_date: startDate,
      end_date: endDate
    }
  };
}

async function findOverlap(payload, excludeId = null) {
  const overlapFilter = {
    $or: [
      { technician_id: payload.technician_id },
      { bay: payload.bay }
    ],
    start_date: { $lte: payload.end_date },
    end_date: { $gte: payload.start_date }
  };

  if (excludeId) {
    overlapFilter._id = { $ne: excludeId };
  }

  return PreplannedProject.findOne(overlapFilter).populate('technician_id', 'name').lean();
}

router.get('/', async (req, res, next) => {
  try {
    const dateWindow = getDateWindow(req.query || {});
    const filter = {};

    if (dateWindow) {
      filter.start_date = { $lte: dateWindow.toDate };
      filter.end_date = { $gte: dateWindow.fromDate };
    }

    const projects = await PreplannedProject.find(filter)
      .populate('technician_id', 'name stockHours')
      .sort({ start_date: 1, bay: 1 })
      .lean();

    res.json(projects);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const project = await PreplannedProject.findById(req.params.id)
      .populate('technician_id', 'name stockHours')
      .lean();

    if (!project) {
      return res.status(404).json({ error: 'Preplanned project not found.' });
    }

    res.json(project);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const validation = await validatePayload(req.body || {});
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const overlap = await findOverlap(validation.data);
    if (overlap) {
      const techName = overlap.technician_id?.name || 'Unknown';
      return res.status(409).json({
        error: `Schedule overlap detected with ${overlap.project_name} (Tech: ${techName}, Bay ${overlap.bay}).`
      });
    }

    const created = await PreplannedProject.create(validation.data);
    const project = await PreplannedProject.findById(created._id)
      .populate('technician_id', 'name stockHours')
      .lean();

    return res.status(201).json(project);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const existing = await PreplannedProject.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Preplanned project not found.' });
    }

    const incoming = {
      technician_id: req.body?.technician_id ?? existing.technician_id,
      project_name: req.body?.project_name ?? existing.project_name,
      bay: req.body?.bay ?? existing.bay,
      start_date: req.body?.start_date ?? existing.start_date,
      end_date: req.body?.end_date ?? existing.end_date
    };

    const validation = await validatePayload(incoming);
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const overlap = await findOverlap(validation.data, existing._id);
    if (overlap) {
      const techName = overlap.technician_id?.name || 'Unknown';
      return res.status(409).json({
        error: `Schedule overlap detected with ${overlap.project_name} (Tech: ${techName}, Bay ${overlap.bay}).`
      });
    }

    Object.assign(existing, validation.data);
    await existing.save();

    const updated = await PreplannedProject.findById(existing._id)
      .populate('technician_id', 'name stockHours')
      .lean();

    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await PreplannedProject.findByIdAndDelete(req.params.id).lean();
    if (!deleted) {
      return res.status(404).json({ error: 'Preplanned project not found.' });
    }

    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
