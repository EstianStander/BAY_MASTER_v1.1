const express = require('express');
const router = express.Router();
const Technician = require('../../models/TechnicianModel');

const seedData = [
  { name: 'David Mphalehle' },
  { name: 'Spha Mthembu' },
  { name: 'Bernard Maano', stockHours: 1800 },
  { name: 'N Stanley Sebe' },
  { name: 'Sipho Zitha' },
  { name: 'Thinus Mostert' },
  { name: 'Johannes Loubser' }
];

async function ensureSeed() {
  const count = await Technician.countDocuments();
  if (count === 0) {
    await Technician.insertMany(seedData);
  }
}

router.get('/', async (_req, res, next) => {
  try {
    await ensureSeed();
    const techs = await Technician.find().sort({ name: 1 }).lean();
    res.json(techs);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
