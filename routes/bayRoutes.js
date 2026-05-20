// Bay Routes - Modular routing for bay pages
const express = require('express');
const router = express.Router();
const path = require('path');

// Bay 1 Route
router.get('/bay1', (req, res) => {
  res.sendFile(path.join(__dirname, '../views', 'bay1.html'));
});

// Bay 2 Route
router.get('/bay2', (req, res) => {
  res.sendFile(path.join(__dirname, '../views', 'bay2.html'));
});

// Bay 3 Route
router.get('/bay3', (req, res) => {
  res.sendFile(path.join(__dirname, '../views', 'bay3.html'));
});

// Bay 4 Route
router.get('/bay4', (req, res) => {
  res.sendFile(path.join(__dirname, '../views', 'bay4.html'));
});

// Bay 5 Route
router.get('/bay5', (req, res) => {
  res.sendFile(path.join(__dirname, '../views', 'bay5.html'));
});

// Bay 6 Route
router.get('/bay6', (req, res) => {
  res.sendFile(path.join(__dirname, '../views', 'bay6.html'));
});

module.exports = router;
