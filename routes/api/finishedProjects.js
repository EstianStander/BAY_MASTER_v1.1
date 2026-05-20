const express = require('express');
const router = express.Router();
const FinishedProject = require('../../models/FinishedProjectModel');

// List all finished projects ordered by most recent completion
router.get('/', async (_req, res, next) => {
  try {
    const projects = await FinishedProject.find()
      .sort({ completedAt: -1, createdAt: -1 })
      .lean();
    res.json(projects);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
