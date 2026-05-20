const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Equipment = require('../../models/EquipmentModel');
const config = require('../../config/config');

const router = express.Router();

const ALLOWED_CATEGORIES = [
  'Spare Parts',
  'Coil Repair',
  'Retrofit',
  'Other Repairs',
  'Other General'
];

const UPLOAD_DIR = config.media.equipmentUploadsDir;
const EQUIPMENT_UPLOAD_URL_PREFIX = config.media.equipmentUploadsUrlPath;
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const safeSegment = value => (value || 'general')
  .toString()
  .trim()
  .replace(/\s+/g, '-')
  .replace(/[^a-zA-Z0-9._-]/g, '')
  .toLowerCase();

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const safeId = safeSegment(req.body?.equipmentId);
    const dest = path.join(UPLOAD_DIR, safeId);
    fs.mkdir(dest, { recursive: true }, (err) => cb(err, dest));
  },
  filename: (_req, file, cb) => {
    const safeName = (file.originalname || 'photo').replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '');
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    cb(null, `${unique}-${safeName}`);
  }
});

const fileFilter = (_req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  return cb(new Error('Only image uploads are allowed'));
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

router.get('/', async (_req, res, next) => {
  try {
    const { equipmentId } = _req.query || {};
    if (equipmentId) {
      const trimmed = equipmentId.toString().trim();
      if (!trimmed) return res.json(null);
      const item = await Equipment.findOne({
        equipmentId: { $regex: new RegExp(`^${escapeRegex(trimmed)}$`, 'i') }
      }).sort({ createdAt: -1 }).lean();
      return res.json(item || null);
    }

    const items = await Equipment.find().sort({ createdAt: -1 }).lean();
    return res.json(items);
  } catch (err) {
    next(err);
  }
});

router.post('/', upload.array('photos', 10), async (req, res, next) => {
  try {
    const { category, equipmentId, equipmentName, issueDescription, customerName, customerContact } = req.body || {};
    if (!category || !ALLOWED_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: 'Please select a valid category.' });
    }
    if (!equipmentId || !equipmentName || !issueDescription) {
      return res.status(400).json({ error: 'Equipment ID, name, and issue description are required.' });
    }

    const payload = {
      category,
      equipmentId: equipmentId.trim(),
      equipmentName: equipmentName.trim(),
      issueDescription: issueDescription.trim(),
      customerName: customerName ? customerName.trim() : '',
      customerContact: customerContact ? customerContact.trim() : '',
      status: 'in-workshop',
      checkedOutAt: null
    };

    if (Array.isArray(req.files) && req.files.length) {
      const safeId = safeSegment(equipmentId);
      payload.photoUrls = req.files.map((f) => `${EQUIPMENT_UPLOAD_URL_PREFIX}/${safeId}/${f.filename}`);
      payload.photoFilenames = req.files.map(f => f.filename);
    }

    const saved = await Equipment.create(payload);
    res.status(201).json(saved);
  } catch (err) {
    next(err);
  }
});

router.use((err, _req, res, next) => {
  if (err instanceof multer.MulterError || err.message?.toLowerCase().includes('upload')) {
    return res.status(400).json({ error: err.message || 'Upload failed' });
  }
  return next(err);
});

// Delete equipment and its folder
router.delete('/:id', async (req, res, next) => {
  try {
    const equipment = await Equipment.findById(req.params.id).lean();
    if (!equipment) return res.status(404).json({ error: 'Equipment not found' });

    if (equipment.status === 'checked-out') {
      return res.json({ success: true, status: equipment.status });
    }

    await Equipment.updateOne(
      { _id: req.params.id },
      { $set: { status: 'checked-out', checkedOutAt: new Date() } }
    );

    res.json({ success: true, status: 'checked-out' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
