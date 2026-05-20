const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const Bay = require('../../models/BayModel');
const DirectProject = require('../../models/DirectProjectModel');
const FinishedProject = require('../../models/FinishedProjectModel');
const JobCosting = require('../../models/JobCostingModel');
const Company = require('../../models/CompanyModel');

const FIXED_RATE_NORMAL = 590.16;
const FIXED_RATE_OT15 = 885.24;
const FIXED_RATE_OT20 = 1180.32;
const EMPTY_OBJECT_ID = '000000000000000000000000';

function numberFromDecimal(value, fallback = 0) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  if (typeof value.toString === 'function') {
    const parsed = Number(value.toString());
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function decimalOf(value) {
  return mongoose.Types.Decimal128.fromString(String(numberFromDecimal(value, 0)));
}

function toApiJob(job) {
  const revenue = numberFromDecimal(job.Revenue, 0);
  const rate = numberFromDecimal(job.Rate, FIXED_RATE_NORMAL);
  const rateOt15 = numberFromDecimal(job.RateOt15, 0);
  const rateOt20 = numberFromDecimal(job.RateOt20, 0);
  const allocRate = numberFromDecimal(job.AllocRate, rate);
  const allocRateOt15 = numberFromDecimal(job.AllocRateOt15, 0);
  const allocRateOt20 = numberFromDecimal(job.AllocRateOt20, 0);

  const effectiveRateOt15 = rateOt15 > 0 ? rateOt15 : rate * 1.5;
  const effectiveRateOt20 = rateOt20 > 0 ? rateOt20 : rate * 2;
  const effectiveAllocRateOt15 = allocRateOt15 > 0 ? allocRateOt15 : allocRate * 1.5;
  const effectiveAllocRateOt20 = allocRateOt20 > 0 ? allocRateOt20 : allocRate * 2;

  const actualNormal = numberFromDecimal(job.ActualNormal, 0);
  const actualOt15 = numberFromDecimal(job.ActualOt15, 0);
  const actualOt20 = numberFromDecimal(job.ActualOt20, 0);
  const allocNormal = numberFromDecimal(job.AllocNormal, 0);
  const allocOt15 = numberFromDecimal(job.AllocOt15, 0);
  const allocOt20 = numberFromDecimal(job.AllocOt20, 0);

  const materials = Array.isArray(job.Materials) ? job.Materials.map((row) => ({
    item: row.Item || '',
    description: row.Description || '',
    qty: numberFromDecimal(row.Qty, 0),
    costPrice: numberFromDecimal(row.CostPrice, 0)
  })) : [];

  const technicians = Array.isArray(job.Technicians) ? job.Technicians.map((row) => ({
    technicianId: row.TechnicianId || null,
    technicianName: row.TechnicianName || '',
    hours: numberFromDecimal(row.Hours, 0),
    isMainTechnician: Boolean(row.IsMainTechnician)
  })) : [];

  const materialRowsTotal = materials.reduce((sum, row) => sum + (numberFromDecimal(row.qty) * numberFromDecimal(row.costPrice)), 0);
  const actualMaterialCost = numberFromDecimal(job.ActualMaterialCost, materialRowsTotal);
  const totalMaterialCost = materialRowsTotal;
  const totalLabourCost = (actualNormal * rate) + (actualOt15 * effectiveRateOt15) + (actualOt20 * effectiveRateOt20);
  const totalCost = actualMaterialCost + totalLabourCost;
  const grossProfit = revenue - totalCost;
  const actualHours = actualNormal + actualOt15 + actualOt20;
  const allocatedHours = allocNormal + allocOt15 + allocOt20;
  const hoursVariance = allocatedHours - actualHours;
  const hoursCostImpact = hoursVariance * (allocRate > 0 ? allocRate : rate);

  return {
    _id: job._id,
    companyId: job.CompanyId || null,
    jobNo: job.JobNo || '',
    customerOrderNo: job.CustomerOrderNo || '',
    ticketNo: job.TicketNo || '',
    quoteNo: job.QuoteNo || '',
    category: job.Category || 'Other General',
    description: job.Description || '',
    status: job.Status || 'Draft',
    dateCreated: job.DateCreated,
    dateUpdated: job.DateUpdated,
    revenue,
    rate,
    rateOt15,
    rateOt20,
    allocRate,
    allocRateOt15,
    allocRateOt20,
    effectiveRateOt15,
    effectiveRateOt20,
    effectiveAllocRateOt15,
    effectiveAllocRateOt20,
    actualNormal,
    actualOt15,
    actualOt20,
    allocNormal,
    allocOt15,
    allocOt20,
    actualMaterialCost,
    materials,
    technicians,
    projectSource: job.ProjectSource || '',
    projectId: job.ProjectId || null,
    projectName: job.ProjectName || '',
    bayNumber: job.BayNumber || null,
    companyName: job.CompanyName || '',
    totalMaterialCost,
    totalLabourCost,
    totalCost,
    grossProfit,
    markupPercent: totalCost > 0 ? (grossProfit / totalCost) * 100 : 0,
    grossMarginPercent: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
    costPercent: revenue > 0 ? (totalCost / revenue) * 100 : 0,
    hoursVariance,
    hoursCostImpact
  };
}

async function generateJobNo() {
  const latest = await JobCosting.findOne({ JobNo: { $regex: /^\d+$/ } })
    .sort({ DateCreated: -1 })
    .select({ JobNo: 1 })
    .lean();

  const parsed = Number.parseInt(latest?.JobNo || '0', 10);
  const next = Number.isFinite(parsed) ? parsed + 1 : 1;
  return String(next);
}

function sanitizePayload(body = {}) {
  const parseNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };

  const parseObjectId = (value) => {
    if (mongoose.Types.ObjectId.isValid(value)) return value;
    return EMPTY_OBJECT_ID;
  };

  const materials = Array.isArray(body.materials) ? body.materials.map((row) => ({
    item: (row?.item || '').toString().trim(),
    description: (row?.description || '').toString().trim(),
    qty: parseNumber(row?.qty),
    costPrice: parseNumber(row?.costPrice)
  })) : [];

  const technicians = Array.isArray(body.technicians) ? body.technicians.map((row) => ({
    technicianId: mongoose.Types.ObjectId.isValid(row?.technicianId) ? row.technicianId : null,
    technicianName: (row?.technicianName || '').toString().trim(),
    hours: parseNumber(row?.hours),
    isMainTechnician: Boolean(row?.isMainTechnician)
  })) : [];

  return {
    CompanyId: parseObjectId(body.companyId),
    JobNo: (body.jobNo || '').toString().trim(),
    CustomerOrderNo: (body.customerOrderNo || '').toString().trim(),
    TicketNo: (body.ticketNo || '').toString().trim(),
    QuoteNo: (body.quoteNo || '').toString().trim(),
    Category: (body.category || 'Other General').toString().trim(),
    Description: (body.description || '').toString().trim(),
    Status: (body.status || 'Draft').toString().trim(),

    Revenue: decimalOf(parseNumber(body.revenue)),
    AllocNormal: decimalOf(parseNumber(body.allocNormal)),
    AllocOt15: decimalOf(parseNumber(body.allocOt15)),
    AllocOt20: decimalOf(parseNumber(body.allocOt20)),
    ActualNormal: decimalOf(parseNumber(body.actualNormal)),
    ActualOt15: decimalOf(parseNumber(body.actualOt15)),
    ActualOt20: decimalOf(parseNumber(body.actualOt20)),
    ActualMaterialCost: decimalOf(
      parseNumber(body.actualMaterialCost) || materials.reduce((sum, row) => sum + (parseNumber(row.qty) * parseNumber(row.costPrice)), 0)
    ),

    Rate: decimalOf(parseNumber(body.rate) || FIXED_RATE_NORMAL),
    RateOt15: decimalOf(parseNumber(body.rateOt15) || FIXED_RATE_OT15),
    RateOt20: decimalOf(parseNumber(body.rateOt20) || FIXED_RATE_OT20),
    AllocRate: decimalOf(parseNumber(body.allocRate) || parseNumber(body.rate) || FIXED_RATE_NORMAL),
    AllocRateOt15: decimalOf(parseNumber(body.allocRateOt15)),
    AllocRateOt20: decimalOf(parseNumber(body.allocRateOt20)),
    NormalHours: decimalOf(parseNumber(body.actualNormal)),
    Ot15Hours: decimalOf(parseNumber(body.actualOt15)),
    Ot20Hours: decimalOf(parseNumber(body.actualOt20)),

    Materials: materials.map((row) => ({
      Item: row.item,
      Description: row.description,
      Qty: decimalOf(row.qty),
      CostPrice: decimalOf(row.costPrice)
    })),
    Technicians: technicians.map((row) => ({
      TechnicianId: row.technicianId,
      TechnicianName: row.technicianName,
      Hours: decimalOf(row.hours),
      IsMainTechnician: row.isMainTechnician
    })),

    ProjectSource: (body.projectSource || '').toString().trim() || null,
    ProjectId: mongoose.Types.ObjectId.isValid(body.projectId) ? body.projectId : null,
    ProjectName: (body.projectName || '').toString().trim(),
    BayNumber: body.bayNumber ? parseInt(body.bayNumber, 10) : null,
    CompanyName: (body.companyName || '').toString().trim()
  };
}

router.get('/companies', async (_req, res, next) => {
  try {
    const companies = await Company.find().sort({ Name: 1 }).lean();
    res.json(companies.map((c) => ({
      _id: c._id,
      name: c.Name || c.CompanyName || c.name || ''
    })));
  } catch (err) {
    next(err);
  }
});

router.get('/projects', async (_req, res, next) => {
  try {
    const [bays, directProjects, finishedProjects] = await Promise.all([
      Bay.find({ projectName: { $nin: [null, ''] } }).select({ projectName: 1, bayNumber: 1, currentProjectType: 1, assignedTeam: 1 }).lean(),
      DirectProject.find().select({ projectName: 1, bayNumber: 1, technicianName: 1, status: 1 }).lean(),
      FinishedProject.find().select({ projectName: 1, bayNumber: 1, completedAt: 1 }).sort({ completedAt: -1 }).limit(200).lean()
    ]);

    const options = [];

    bays.forEach((project) => {
      options.push({
        source: 'bay',
        id: project._id,
        projectName: project.projectName || `Bay ${project.bayNumber}`,
        bayNumber: project.bayNumber,
        label: `Bay ${project.bayNumber} - ${project.projectName || 'Untitled'}`,
        technicians: Array.isArray(project.assignedTeam) ? project.assignedTeam : []
      });
    });

    directProjects.forEach((project) => {
      options.push({
        source: 'direct',
        id: project._id,
        projectName: project.projectName || `Direct Project ${project._id}`,
        bayNumber: project.bayNumber,
        technicianName: project.technicianName || '',
        status: project.status,
        label: `Direct (Bay ${project.bayNumber}) - ${project.projectName || 'Untitled'}`
      });
    });

    finishedProjects.forEach((project) => {
      options.push({
        source: 'finished',
        id: project._id,
        projectName: project.projectName || `Finished Project ${project._id}`,
        bayNumber: project.bayNumber,
        completedAt: project.completedAt,
        label: `Finished (Bay ${project.bayNumber}) - ${project.projectName || 'Untitled'}`
      });
    });

    res.json(options);
  } catch (err) {
    next(err);
  }
});

router.get('/', async (_req, res, next) => {
  try {
    const jobs = await JobCosting.find()
      .sort({ DateUpdated: -1 })
      .limit(200)
      .lean();
    res.json(jobs.map(toApiJob));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const job = await JobCosting.findById(req.params.id).lean();
    if (!job) return res.status(404).json({ error: 'Job costing record not found' });
    res.json(toApiJob(job));
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const payload = sanitizePayload(req.body);

    if (payload.ProjectId && !mongoose.Types.ObjectId.isValid(payload.ProjectId)) {
      return res.status(400).json({ error: 'Invalid projectId' });
    }

    if (!payload.JobNo) {
      payload.JobNo = await generateJobNo();
    }

    payload.DateCreated = new Date();
    payload.DateUpdated = new Date();

    const job = await JobCosting.create(payload);
    res.status(201).json(toApiJob(job));
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const payload = sanitizePayload(req.body);
    if (!payload.JobNo) {
      payload.JobNo = await generateJobNo();
    }

    const job = await JobCosting.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job costing record not found' });

    payload.DateUpdated = new Date();
    Object.assign(job, payload);
    await job.save();
    res.json(toApiJob(job));
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const result = await JobCosting.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: 'Job costing record not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;