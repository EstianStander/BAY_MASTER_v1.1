const express = require('express');
const router = express.Router();
const Bay = require('../../models/BayModel');
const FinishedProject = require('../../models/FinishedProjectModel');

// Normalize payload to ensure dates are Date objects
function normalizePayload(body) {
  const toDate = (value) => (value ? new Date(value) : null);
  const equipmentAssignment = body.equipmentAssignment || null;
  return {
    projectName: body.projectName || null,
    equipmentAssignment: equipmentAssignment
      ? {
          equipmentDbId: equipmentAssignment.equipmentDbId || null,
          equipmentId: equipmentAssignment.equipmentId || '',
          equipmentName: equipmentAssignment.equipmentName || ''
        }
      : null,
    assignedTeam: Array.isArray(body.assignedTeam) ? body.assignedTeam : [],
    timer: {
      start: toDate(body.timer?.start),
      end: toDate(body.timer?.end)
    },
    tasks: Array.isArray(body.tasks) ? body.tasks.map(t => ({
      text: t.text || '',
      deadline: toDate(t.deadline),
      priority: t.priority || 'medium'
    })) : [],
    paused: Boolean(body.paused),
    pausedAt: toDate(body.pausedAt),
    delayReason: body.delayReason || '',
    currentPauseReason: body.currentPauseReason || '',
    pauseEvents: Array.isArray(body.pauseEvents) ? body.pauseEvents.map(ev => ({
      pausedAt: toDate(ev.pausedAt),
      resumedAt: toDate(ev.resumedAt),
      durationMs: ev.durationMs || 0,
      reason: ev.reason || ''
    })) : [],
    movedToDirect: Boolean(body.movedToDirect)
  };
}

// GET all bays (returns array of 6 positions, null where missing)
router.get('/', async (_req, res, next) => {
  try {
    const bays = await Bay.find().sort({ bayNumber: 1 }).lean();
    const map = new Map(bays.map(b => [b.bayNumber, b]));
    const result = Array.from({ length: 6 }, (_, idx) => map.get(idx + 1) || null);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET single bay
router.get('/:bayNumber', async (req, res, next) => {
  try {
    const bayNumber = parseInt(req.params.bayNumber, 10);
    const bay = await Bay.findOne({ bayNumber }).lean();
    res.json(bay || null);
  } catch (err) {
    next(err);
  }
});

// UPSERT bay
router.post('/:bayNumber', async (req, res, next) => {
  try {
    const bayNumber = parseInt(req.params.bayNumber, 10);
    const payload = normalizePayload(req.body);
    const bay = await Bay.findOneAndUpdate(
      { bayNumber },
      { bayNumber, ...payload },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json(bay);
  } catch (err) {
    next(err);
  }
});

// Pause / Unpause bay
router.post('/:bayNumber/pause', async (req, res, next) => {
  try {
    const bayNumber = parseInt(req.params.bayNumber, 10);
    const action = req.body?.action;
    const reason = req.body?.reason || '';
    const bay = await Bay.findOne({ bayNumber });
    if (!bay) return res.status(404).json({ error: 'Bay not found' });

    if (action === 'pause') {
      if (bay.paused) return res.json(bay);
      bay.paused = true;
      bay.pausedAt = new Date();
      bay.currentPauseReason = reason;
      await bay.save();
      return res.json(bay);
    }

    if (action === 'unpause') {
      if (!bay.paused) return res.json(bay);
      const resumedAt = new Date();
      const pausedAt = bay.pausedAt || resumedAt;
      const durationMs = resumedAt - pausedAt;
      const reasonToSave = bay.currentPauseReason || reason;
      bay.pauseEvents.push({ pausedAt, resumedAt, durationMs, reason: reasonToSave });
      bay.paused = false;
      bay.pausedAt = null;
      bay.currentPauseReason = '';
      if (bay.timer?.end) {
        bay.timer.end = new Date(new Date(bay.timer.end).getTime() + durationMs);
      }
      await bay.save();
      return res.json(bay);
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (err) {
    next(err);
  }
});

// Finish bay project and archive
router.post('/:bayNumber/finish', async (req, res, next) => {
  try {
    const bayNumber = parseInt(req.params.bayNumber, 10);
    const bay = await Bay.findOne({ bayNumber });
    if (!bay) return res.status(404).json({ error: 'Bay not found' });

    const projectNotes = Array.isArray(req.body?.projectNotes) ? req.body.projectNotes : [];
    const finished = await FinishedProject.create({
      bayNumber,
      projectName: bay.projectName,
      assignedTeam: bay.assignedTeam,
      timer: bay.timer,
      paused: bay.paused,
      pausedAt: bay.pausedAt,
      pauseEvents: bay.pauseEvents,
      currentPauseReason: bay.currentPauseReason,
      movedToDirect: bay.movedToDirect,
      delayReason: bay.delayReason,
      projectNotes
    });

    await Bay.deleteOne({ bayNumber });
    res.json({ success: true, finished });
  } catch (err) {
    next(err);
  }
});

// DELETE bay
router.delete('/:bayNumber', async (req, res, next) => {
  try {
    const bayNumber = parseInt(req.params.bayNumber, 10);
    await Bay.deleteOne({ bayNumber });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
