const mongoose = require('mongoose');
const JobCosting = require('./JobCostingModel');

// Reuse the same connection (InductoTrackDb) that job costing uses
const jobsConnection = JobCosting.db;

const companySchema = new mongoose.Schema({}, { strict: false, collection: 'Companies' });

module.exports = jobsConnection.models.Company || jobsConnection.model('Company', companySchema, 'Companies');
