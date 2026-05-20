const express = require('express');
const path = require('path');
const fs = require('fs');
const VisitorInduction = require('../../models/VisitorInductionModel');
const config = require('../../config/config');

const router = express.Router();

const SIGNATURE_DIR = config.media.visitorSignaturesDir;
const VISITOR_SIGNATURE_URL_PREFIX = config.media.visitorSignaturesUrlPath;
fs.mkdirSync(SIGNATURE_DIR, { recursive: true });

const parseDataUrl = (dataUrl) => {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:image\/(png|jpeg);base64,(.+)$/i);
  if (!match) return null;
  return { ext: match[1].toLowerCase(), data: match[2] };
};

const saveSignature = (parsed) => {
  if (!parsed) return null;
  const filename = `signature-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${parsed.ext}`;
  const filePath = path.join(SIGNATURE_DIR, filename);
  fs.writeFileSync(filePath, Buffer.from(parsed.data, 'base64'));
  return `${VISITOR_SIGNATURE_URL_PREFIX}/${filename}`;
};

router.get('/', async (req, res, next) => {
  try {
    const type = (req.query?.type || '').toString().trim().toLowerCase();
    const filter = type === 'visitor' || type === 'workshop' || type === 'delivery' ? { visitorType: type } : {};
    const records = await VisitorInduction.find(filter)
      .sort({ createdAt: -1 })
      .lean();
    res.json(records);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const record = await VisitorInduction.findById(req.params.id).lean();
    if (!record) {
      return res.status(404).json({ error: 'Visitor record not found.' });
    }
    res.json(record);
  } catch (err) {
    if (err?.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid visitor record ID.' });
    }
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const payload = req.body || {};
    const visitorType = payload.visitorType === 'workshop'
      ? 'workshop'
      : payload.visitorType === 'delivery'
        ? 'delivery'
        : 'visitor';
    const parsedSignature = parseDataUrl(payload.signatureData);

    if (!payload.inductionDate) {
      return res.status(400).json({ error: 'Induction date is required.' });
    }

    if (visitorType === 'workshop' && !payload.validUntil) {
      return res.status(400).json({ error: 'Valid until is required for workshop inductions.' });
    }

    if (!payload.visitor?.company || !payload.visitor?.contactNo || !payload.visitor?.name) {
      return res.status(400).json({ error: 'Visitor details are required.' });
    }

    if (visitorType === 'workshop' && !payload.visitor?.idNumber) {
      return res.status(400).json({ error: 'ID / passport number is required for workshop inductions.' });
    }

    const medical = payload.medical || {};
    if (visitorType === 'workshop') {
      const medicalFields = ['diabetes', 'epilepsy', 'hypertension', 'tuberculosis', 'asthma', 'vision', 'hearing', 'drugs', 'alcohol'];
      const missingMedical = medicalFields.some((field) => !medical[field]);
      if (missingMedical) {
        return res.status(400).json({ error: 'Please complete all medical declarations.' });
      }
    }

    if (!parsedSignature) {
      return res.status(400).json({ error: 'Signature is required.' });
    }

    const signatureUrl = saveSignature(parsedSignature);

    const record = await VisitorInduction.create({
      visitorType,
      inductionDate: new Date(payload.inductionDate),
      validUntil: payload.validUntil ? new Date(payload.validUntil) : null,
      ppe: {
        safetyHelmet: payload.ppe?.safetyHelmet || {},
        safetyBoots: payload.ppe?.safetyBoots || {},
        overalls: payload.ppe?.overalls || {},
        eyeProtection: payload.ppe?.eyeProtection || {},
        hearingProtection: payload.ppe?.hearingProtection || {},
        gloves: payload.ppe?.gloves || {},
        safetyHarness: payload.ppe?.safetyHarness || {},
        heightsTraining: Boolean(payload.ppe?.heightsTraining)
      },
      medical: {
        diabetes: medical.diabetes,
        epilepsy: medical.epilepsy,
        hypertension: medical.hypertension,
        tuberculosis: medical.tuberculosis,
        asthma: medical.asthma,
        vision: medical.vision,
        hearing: medical.hearing,
        drugs: medical.drugs,
        alcohol: medical.alcohol
      },
      visitor: {
        company: payload.visitor?.company,
        contactNo: payload.visitor?.contactNo,
        name: payload.visitor?.name,
        idNumber: payload.visitor?.idNumber || null
      },
      delivery: visitorType === 'delivery'
        ? {
            company: payload.visitor?.company,
            contactNo: payload.visitor?.contactNo,
            name: payload.visitor?.name,
            idNumber: payload.visitor?.idNumber || null
          }
        : {},
      signatureUrl
    });

    res.status(201).json({ success: true, recordId: record._id, signatureUrl });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
