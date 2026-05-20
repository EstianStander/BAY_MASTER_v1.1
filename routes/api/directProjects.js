const express = require('express');
const router = express.Router();
const Bay = require('../../models/BayModel');
const DirectProject = require('../../models/DirectProjectModel');

function toDate(value) {
  return value ? new Date(value) : null;
}

router.get('/', async (_req, res, next) => {
  try {
    const projects = await DirectProject.find().sort({ createdAt: -1 }).lean();
    res.json(projects);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const projectName = (req.body?.projectName || '').trim();
    const technicianName = (req.body?.technicianName || '').trim();
    const bayNumber = req.body?.bayNumber ? parseInt(req.body.bayNumber, 10) : null;
    const start = toDate(req.body?.timer?.start || req.body?.start);
    const end = toDate(req.body?.timer?.end || req.body?.end);
    if (!projectName || !technicianName || !start || !end) {
      return res.status(400).json({ error: 'projectName, technicianName, start, and end are required.' });
    }
    if (!bayNumber) {
      return res.status(400).json({ error: 'bayNumber is required. Please select a bay.' });
    }

    const bay = await Bay.findOne({ bayNumber });
    if (!bay) return res.status(400).json({ error: `Bay ${bayNumber} not found.` });
    if (bay.currentProjectType === 'direct') return res.status(400).json({ error: 'Bay already hosts a direct project.' });

    const now = new Date();
    const hasExistingProject = bay.projectName && bay.projectName.trim() !== '';
    const displacedProject = hasExistingProject ? {
      projectName: bay.projectName,
      assignedTeam: bay.assignedTeam,
      timer: bay.timer,
      paused: true,
      pausedAt: now,
      currentPauseReason: `Direct project: ${projectName}`,
      pauseEvents: bay.pauseEvents || [],
      delayReason: bay.delayReason || ''
    } : null;

    bay.displacedProject = displacedProject;
    bay.currentProjectType = 'direct';
    bay.directProject = {
      projectName,
      technicianName,
      timer: { start, end },
      paused: false,
      pausedAt: null,
      status: 'active'
    };
    bay.projectName = projectName;
    bay.assignedTeam = [technicianName];
    bay.timer = { start, end };
    bay.paused = false;
    bay.pausedAt = null;
    bay.currentPauseReason = '';
    bay.pauseEvents = [];
    bay.movedToDirect = true;
    await bay.save();

    const direct = await DirectProject.create({ projectName, technicianName, bayNumber: bay.bayNumber, timer: { start, end } });
    bay.directProjectId = direct._id;
    await bay.save();
    res.json({ success: true, direct });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/pause', async (req, res, next) => {
  try {
    const action = req.body?.action;
    const direct = await DirectProject.findById(req.params.id);
    if (!direct || direct.status !== 'active') return res.status(404).json({ error: 'Direct project not found' });
    const bay = await Bay.findOne({ bayNumber: direct.bayNumber });

    if (action === 'pause') {
      if (!direct.paused) {
        const pausedAt = new Date();
        direct.paused = true;
        direct.pausedAt = pausedAt;
        if (bay) {
          bay.paused = true;
          bay.pausedAt = pausedAt;
          bay.currentPauseReason = 'Direct project paused';
          if (bay.directProject) {
            bay.directProject.paused = true;
            bay.directProject.pausedAt = pausedAt;
          }
          await bay.save();
        }
        await direct.save();
      }
      return res.json(direct);
    }

    if (action === 'unpause') {
      if (direct.paused) {
        const now = new Date();
        const pauseDuration = now - (direct.pausedAt || now);
        direct.timer.end = new Date(new Date(direct.timer.end).getTime() + pauseDuration);
        direct.paused = false;
        direct.pausedAt = null;
        if (bay) {
          if (bay.directProject?.timer?.end) {
            bay.directProject.timer.end = direct.timer.end;
          }
          bay.paused = false;
          bay.pausedAt = null;
          bay.currentPauseReason = '';
          if (bay.directProject) {
            bay.directProject.paused = false;
            bay.directProject.pausedAt = null;
          }
          await bay.save();
        }
        await direct.save();
      }
      return res.json(direct);
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/finish', async (req, res, next) => {
  try {
    const direct = await DirectProject.findById(req.params.id);
    if (!direct || direct.status === 'completed') return res.status(404).json({ error: 'Direct project not found' });

    const now = new Date();
    direct.status = 'completed';
    direct.completedAt = now;
    if (Array.isArray(req.body?.projectNotes)) direct.projectNotes = req.body.projectNotes;
    await direct.save();

    const bay = await Bay.findOne({ bayNumber: direct.bayNumber });
    if (bay && bay.displacedProject) {
      const displaced = bay.displacedProject;
      const pausedAt = displaced.pausedAt || now;
      const resumeAt = now;
      const durationMs = resumeAt - pausedAt;
      const pauseEvents = displaced.pauseEvents || [];
      pauseEvents.push({ pausedAt, resumedAt: resumeAt, durationMs, reason: displaced.currentPauseReason || `Direct project: ${direct.projectName}` });

      if (displaced.timer?.end) {
        displaced.timer.end = new Date(new Date(displaced.timer.end).getTime() + durationMs);
      }

      bay.projectName = displaced.projectName || null;
      bay.assignedTeam = displaced.assignedTeam || [];
      bay.timer = displaced.timer || { start: null, end: null };
      bay.paused = false;
      bay.pausedAt = null;
      bay.currentPauseReason = '';
      bay.pauseEvents = pauseEvents;
      bay.delayReason = displaced.delayReason || '';
      bay.movedToDirect = false;
      bay.currentProjectType = 'bay';
      bay.directProject = null;
      bay.directProjectId = null;
      bay.displacedProject = null;
      await bay.save();
    } else if (bay) {
      // No displaced project — bay was empty before the direct project; just clear it
      bay.projectName = null;
      bay.assignedTeam = [];
      bay.timer = { start: null, end: null };
      bay.paused = false;
      bay.pausedAt = null;
      bay.currentPauseReason = '';
      bay.pauseEvents = [];
      bay.movedToDirect = false;
      bay.currentProjectType = 'bay';
      bay.directProject = null;
      bay.directProjectId = null;
      bay.displacedProject = null;
      await bay.save();
    }

    res.json({ success: true, direct });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const direct = await DirectProject.findById(req.params.id);
    if (!direct) return res.status(404).json({ error: 'Direct project not found' });

    const updates = {};
    if (req.body.projectName) updates.projectName = req.body.projectName.trim();
    if (req.body.technicianName) updates.technicianName = req.body.technicianName.trim();
    const start = toDate(req.body?.timer?.start || req.body?.start);
    const end = toDate(req.body?.timer?.end || req.body?.end);
    if (start) updates['timer.start'] = start;
    if (end) updates['timer.end'] = end;

    Object.assign(direct, updates);
    await direct.save();

    const bay = await Bay.findOne({ bayNumber: direct.bayNumber });
    if (bay && bay.directProject) {
      if (updates.projectName) bay.directProject.projectName = updates.projectName;
      if (updates.technicianName) {
        bay.directProject.technicianName = updates.technicianName;
        bay.assignedTeam = [updates.technicianName];
      }
      if (start) bay.directProject.timer.start = start;
      if (end) bay.directProject.timer.end = end;
      if (start || end) bay.timer = { start: bay.directProject.timer.start, end: bay.directProject.timer.end };
      bay.projectName = bay.directProject.projectName;
      await bay.save();
    }

    res.json({ success: true, direct });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
